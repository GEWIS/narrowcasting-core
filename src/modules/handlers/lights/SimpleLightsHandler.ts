import BaseLightsHandler from '../base-lights-handler';
import { LightsGroup } from '../../lights/entities';
import { BeatEvent } from '../../events/MusicEmitter';
import { rgbColorDefinitions } from '../../lights/ColorDefinitions';

export default class SimpleLightsHandler extends BaseLightsHandler {
  private ping = false;

  private lastBeat = new Date().getTime(); // in ms since epoch;

  private beatLength: number = 1; // in ms;

  tick(): LightsGroup[] {
    const beatProgression = Math.max(
      1 - ((new Date().getTime() - this.lastBeat) / this.beatLength),
      0,
    );

    return this.entities.map((g) => {
      g.pars.forEach((p, i) => {
        if (i % 2 === (this.ping ? 1 : 0)) {
          p.par.setCurrentValues({
            masterDimChannel: 255 * beatProgression,
            ...rgbColorDefinitions.pink,
          });
        } else {
          p.par.setMasterDimmer(0);
        }
      });
      return g;
    });
  }

  beat(event: BeatEvent): void {
    this.lastBeat = new Date().getTime();
    this.beatLength = event.beat.duration * 1000;
    this.ping = !this.ping;
  }
}