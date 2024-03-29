import LightsEffect, { BaseLightsEffectCreateParams, LightsEffectBuilder } from '../lights-effect';
import { LightsGroup } from '../../entities';
import { RgbColor } from '../../color-definitions';

export interface WaveProps {
  /**
   * Color of the lights
   */
  color: RgbColor;

  /**
   * Relative size of the wave
   * @minimum 0
   * @maximum 1
   */
  size?: number;

  /**
   * How many ms each cycle of the wave takes
   * @isInt
   * @minimum 0
   */
  cycleTime?: number;
}

export type WaveCreateParams = BaseLightsEffectCreateParams & {
  type: 'Wave';
  props: WaveProps;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEFAULT_SIZE = 1;
const DEFAULT_CYCLE_TIME = 1000;

export default class Wave extends LightsEffect<WaveProps> {
  private cycleStartTick: Date = new Date();

  constructor(lightsGroup: LightsGroup, props: WaveProps) {
    super(lightsGroup);
    this.props = props;
  }

  public static build(props: WaveProps): LightsEffectBuilder<WaveProps, Wave> {
    return (lightsGroup) => new Wave(lightsGroup, props);
  }

  destroy(): void {}

  beat(): void {}

  private getProgression(currentTick: Date) {
    const cycleTime = this.props.cycleTime ?? DEFAULT_CYCLE_TIME;
    return Math.min(1, (currentTick.getTime() - this.cycleStartTick.getTime()) / cycleTime);
  }

  tick(): LightsGroup {
    const currentTick = new Date();
    const progression = this.getProgression(currentTick);
    if (progression >= 1) {
      this.cycleStartTick = currentTick;
    }
    const nrLights = this.lightsGroup.pars.length + this.lightsGroup.movingHeadRgbs.length;

    this.lightsGroup.pars
      .sort((p1, p2) => p2.firstChannel - p1.firstChannel)
      .forEach((p, i) => {
        const brightness = Math.sin((i / nrLights + progression) * 2 * Math.PI);
        p.fixture.setMasterDimmer(Math.max(0, brightness * 255));
        p.fixture.setColor(this.props.color);
      });
    this.lightsGroup.movingHeadRgbs
      .sort((p1, p2) => p2.firstChannel - p1.firstChannel)
      .forEach((p, i) => {
        const brightness = Math.sin((i / nrLights + progression) * 2 * Math.PI);
        p.fixture.setMasterDimmer(Math.max(0, brightness * 255));
        p.fixture.setColor(this.props.color);
      });

    return this.lightsGroup;
  }
}
