import BaseLightsHandler from '../handlers/base-lights-handler';
import { Server } from 'socket.io';
import { MusicEmitter } from '../events';
import { RandomEffectsHandler } from '../handlers/lights';
import SetEffectsHandler from '../handlers/lights/set-effects-handler';
import DevelopEffectsHandler from '../handlers/lights/develop-effects-handler';
import { ScenesHandler } from '../handlers/lights/scenes-handler';
import EffectSequenceHandler from '../handlers/lights/effect-sequence-handler';
import TimeTrailRaceLightsHandler from '../handlers/lights/time-trail-race-lights-handler';
import { FeatureFlagManager } from '../server-settings';
import BaseHandler from '../handlers/base-handler';
import BaseAudioHandler from '../handlers/base-audio-handler';
import SimpleAudioHandler from '../handlers/audio/simple-audio-handler';
import { SocketioNamespaces } from '../../socketio-namespaces';
import BaseScreenHandler from '../handlers/base-screen-handler';
import {
  CenturionScreenHandler,
  CurrentlyPlayingTrackHandler,
  GewisPosterScreenHandler,
  HubbleClosedPosterScreenHandler,
  HubbleLastcallPosterScreenHandler,
  HubblePosterScreenHandler,
  RoomResponsibleLegacyHandler,
  StageEffectsHandler,
  TimeTrailRaceScreenHandler,
} from '../handlers/screen';

/**
 * Object to create the set of all handlers belonging to each listener
 */
export default class HandlerFactory {
  private ffm: FeatureFlagManager;

  constructor(
    private io: Server,
    private musicEmitter: MusicEmitter,
  ) {
    this.ffm = FeatureFlagManager.getInstance();
  }

  /**
   * Creates the handler if the handler is enabled
   * @param Handler
   * @param creator
   * @private
   */
  private createHandler<T extends BaseHandler<any>>(
    Handler: new (...args: any[]) => T,
    creator: () => T,
  ): T | null {
    if (!this.ffm.handlerIsEnabled(Handler)) return null;
    return creator();
  }

  public createAudioHandlers(): BaseAudioHandler[] {
    const audioHandlers: (BaseAudioHandler | null)[] = [
      this.createHandler(
        SimpleAudioHandler,
        () => new SimpleAudioHandler(this.io.of(SocketioNamespaces.AUDIO), this.musicEmitter),
      ),
    ];
    return audioHandlers.filter((h) => h != null);
  }

  public createLightHandlers(): BaseLightsHandler[] {
    // Create all light handlers
    const lightsHandlers: (BaseLightsHandler | null)[] = [
      this.createHandler(RandomEffectsHandler, () => new RandomEffectsHandler()),
      this.createHandler(SetEffectsHandler, () => new SetEffectsHandler()),
      this.createHandler(DevelopEffectsHandler, () => new DevelopEffectsHandler()),
      this.createHandler(ScenesHandler, () => new ScenesHandler()),
      this.createHandler(EffectSequenceHandler, () => new EffectSequenceHandler(this.musicEmitter)),
      this.createHandler(TimeTrailRaceLightsHandler, () => new TimeTrailRaceLightsHandler()),
    ];
    return lightsHandlers.filter((h) => h != null);
  }

  public createScreenHandlers(): BaseScreenHandler[] {
    const socket = this.io.of(SocketioNamespaces.SCREEN);
    const screenHandlers: (BaseScreenHandler | null)[] = [
      this.createHandler(
        CurrentlyPlayingTrackHandler,
        () => new CurrentlyPlayingTrackHandler(socket),
      ),
      this.createHandler(CenturionScreenHandler, () => new CenturionScreenHandler(socket)),
      this.createHandler(GewisPosterScreenHandler, () => new GewisPosterScreenHandler(socket)),
      this.createHandler(HubblePosterScreenHandler, () => new HubblePosterScreenHandler(socket)),
      this.createHandler(HubbleClosedPosterScreenHandler, () => new HubbleClosedPosterScreenHandler(socket)),
      this.createHandler(HubbleLastcallPosterScreenHandler, () => new HubbleLastcallPosterScreenHandler(socket)),
      this.createHandler(StageEffectsHandler, () => new StageEffectsHandler(socket)),
      this.createHandler(TimeTrailRaceScreenHandler, () => new TimeTrailRaceScreenHandler(socket)),
      this.createHandler(
        RoomResponsibleLegacyHandler,
        () => new RoomResponsibleLegacyHandler(socket),
      ),
    ];
    return screenHandlers.filter((h) => h != null);
  }
}
