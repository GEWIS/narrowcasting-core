import { AudioAnalysis, AudioFeatures, PlaybackState, Track } from '@fostertheweb/spotify-web-sdk';
import SpotifyApiHandler from './spotify-api-handler';
import { MusicEmitter } from '../events';
import { BeatEvent, TrackChangeEvent, TrackPropertiesEvent } from '../events/music-emitter-events';
import logger from '../../logger';

export default class SpotifyTrackHandler {
  private static instance: SpotifyTrackHandler;

  private initialized = false;

  private syncLoopTimer?: NodeJS.Timeout;

  private readonly api: SpotifyApiHandler;

  private playStateUpdateTime: Date = new Date();

  /** Currently playing state. Can be defined if not playing anything */
  private playState: PlaybackState | undefined;

  private currentlyPlayingFeatures: AudioFeatures | undefined;

  private currentlyPlayingAnalysis: AudioAnalysis | undefined;

  private beatEvents: {
    event: BeatEvent;
    timeout: NodeJS.Timeout;
  }[];

  public musicEmitter: MusicEmitter;

  private ping = false;

  private constructor() {
    this.api = SpotifyApiHandler.getInstance();
    setInterval(this.syncLoop.bind(this), 5000);
    this.syncLoop().then(() => {});
    this.beatEvents = [];
  }

  public static getInstance() {
    if (this.instance == null) {
      this.instance = new SpotifyTrackHandler();
    }
    return this.instance;
  }

  public async init(emitter: MusicEmitter) {
    if (this.initialized) throw new Error('SpotifyTrackHandler is already initialized!');
    this.musicEmitter = emitter;
    this.initialized = true;
  }

  private asTrackChangeEvent(item: Track, state: PlaybackState): TrackChangeEvent {
    return {
      title: item.name,
      artists: item.artists.map((a) => a.name),
      cover: item.album.images[0].url,
      startTime: new Date(this.playStateUpdateTime.getTime() - state.progress_ms),
      trackURI: item.uri,
    };
  }

  /**
   * Try to pause Spotify playback
   */
  public pausePlayback() {
    if (!this.api.client || !this.playState || !this.playState.device || !this.playState.device.id)
      return;

    try {
      this.api.client?.player.pausePlayback(this.playState.device.id);
    } catch (e) {
      logger.fatal(e);
    }
  }

  /**
   * Try to resume Spotify playback on the same device as used before
   */
  public resumePlayback() {
    if (!this.api.client || !this.playState || !this.playState.device || !this.playState.device.id)
      return;

    try {
      this.api.client?.player.startResumePlayback(this.playState.device.id);
    } catch (e) {
      logger.fatal(e);
    }
  }

  /**
   * Stop the beat events and delete them
   * @private
   */
  private stopBeatEvents() {
    this.beatEvents.forEach((e) => {
      clearTimeout(e.timeout);
    });
    this.beatEvents = [];
  }

  private setNextTrackEvent(state: PlaybackState): void {
    if (!state.is_playing) return;
    if (this.syncLoopTimer) {
      clearTimeout(this.syncLoopTimer);
      this.syncLoopTimer = undefined;
    }

    this.syncLoopTimer = setTimeout(
      this.syncLoop.bind(this),
      state.item.duration_ms - state.progress_ms + 10,
    );
  }

  private setBeatEvents(track?: AudioAnalysis) {
    this.stopBeatEvents();

    const progress = this.playState?.progress_ms || 0;

    this.beatEvents = track
      ? track.beats
          .filter((b) => b.start * 1000 >= progress)
          .map((beat) => {
            const segment = track.segments.find(
              (s) => s.start <= beat.start && s.start + s.duration >= beat.start,
            );
            const section = track.sections.find(
              (s) => s.start <= beat.start && s.start + s.duration >= beat.start,
            );
            const tatum = track.tatums.find(
              (s) => s.start <= beat.start && s.start + s.duration >= beat.start,
            );

            const beatEvent = {
              beat,
              segment,
              section,
              tatum,
            };
            const timeout = setTimeout(
              this.syncBeat.bind(this, beatEvent),
              beat.start * 1000 - progress,
            );
            return {
              event: beatEvent,
              timeout,
            };
          })
      : [];
  }

  /**
   * Main event loop to get the currently playing song
   * @private
   */
  private async syncLoop() {
    if (!this.api.client) return;

    try {
      const state = await this.api.client.player.getCurrentlyPlayingTrack();
      this.playStateUpdateTime = new Date();

      // If Spotify started playing a track, starts playing a new track or resumes playing audio...
      if (
        state &&
        state.currently_playing_type === 'track' &&
        (!this.playState ||
          this.playState.item?.id !== state.item?.id ||
          (!this.playState.is_playing && state.is_playing))
      ) {
        this.currentlyPlayingFeatures = await this.api.client.tracks.audioFeatures(state.item.id);
        this.currentlyPlayingAnalysis = await this.api.client.tracks.audioAnalysis(state.item.id);

        this.emitTrackFeatures(this.currentlyPlayingFeatures);
        this.setNextTrackEvent(state);

        const item = state.item as Track;
        this.musicEmitter.emitSpotify('change_track', [
          this.asTrackChangeEvent(item, state),
        ] as TrackChangeEvent[]);

        logger.info(
          `Now playing: ${item.artists.map((a) => a.name).join(', ')} - ${item.name} (${item.uri})`,
        );
      }

      if ((!state || !state.is_playing) && this.playState && this.playState.is_playing) {
        this.stopBeatEvents();
        this.currentlyPlayingFeatures = undefined;
        this.currentlyPlayingAnalysis = undefined;
        this.musicEmitter.emitSpotify('stop');
        logger.info('Spotify paused/stopped');
      }

      this.playState = state;

      this.setBeatEvents(this.currentlyPlayingAnalysis);
    } catch (e) {
      logger.fatal(e);
    }
  }

  /**
   * Event loop that is called at every beat of the currently playing track
   * @private
   */
  private async syncBeat(event: BeatEvent) {
    if (!this.playState || !this.playState.is_playing) return;

    if (process.env.LOG_AUDIO_BEATS === 'true') {
      let beat = '';

      if (this.ping) beat += 'beat:   . ';
      if (!this.ping) beat += 'beat:  .  ';
      this.ping = !this.ping;

      beat += `: ${event.beat.start} (${event.beat.confidence}) - ${event.section?.start} - ${event.section?.loudness}`;
      logger.info(beat);
    }

    this.musicEmitter.emitSpotify('beat', event);
  }

  /**
   * Send the features of the currently playing track to all handlers
   * @param features
   * @private
   */
  private emitTrackFeatures(features: AudioFeatures) {
    const event: TrackPropertiesEvent = {
      bpm: features.tempo,
      danceability: features.danceability,
      energy: features.energy,
      loudness: features.loudness,
      valence: features.valence,
    };
    this.musicEmitter.emitSpotify('features', event);
  }
}
