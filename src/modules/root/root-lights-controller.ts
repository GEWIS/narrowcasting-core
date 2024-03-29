import { Body, Get, Post, Route, Security, Tags } from 'tsoa';
import { Controller } from '@tsoa/runtime';
import RootLightsService, {
  LightsControllerCreateParams,
  LightsControllerResponse,
  LightsGroupCreateParams,
  LightsGroupResponse,
  LightsMovingHeadRgbCreateParams,
  LightsMovingHeadWheelCreateParams,
  LightsParCreateParams,
  MovingHeadRgbResponse,
  MovingHeadWheelResponse,
  ParResponse,
} from './root-lights-service';
import { LIGHTS_EFFECTS } from '../lights/effects';
import {
  RgbColor,
  rgbColorDefinitions,
  rgbColors,
  RgbColorSpecification,
} from '../lights/color-definitions';
import { SecurityGroup } from '../../helpers/security';

interface LightsColorResponse {
  color: RgbColor;
  spec: RgbColorSpecification;
}

@Route('lights')
@Tags('Lights')
export class RootLightsController extends Controller {
  @Security('local', ['*'])
  @Get('controller')
  public async getLightsControllers(): Promise<LightsControllerResponse[]> {
    const controllers = await new RootLightsService().getAllControllers();
    return controllers.map((c) => RootLightsService.toLightsControllerResponse(c));
  }

  @Security('local', ['*'])
  @Get('controller/{id}')
  public async getSingleLightsController(
    id: number,
  ): Promise<LightsControllerResponse | undefined> {
    const controller = await new RootLightsService().getSingleController(id);
    if (!controller) {
      this.setStatus(404);
      return undefined;
    }
    return RootLightsService.toLightsControllerResponse(controller);
  }

  @Security('local', [SecurityGroup.ADMIN])
  @Post('controller')
  public async createLightsController(
    @Body() params: LightsControllerCreateParams,
  ): Promise<LightsControllerResponse> {
    return new RootLightsService().createController(params);
  }

  @Security('local', ['*'])
  @Get('group')
  public async getLightsGroups(): Promise<LightsGroupResponse[]> {
    const groups = await new RootLightsService().getAllLightsGroups();
    return groups.map((g) => RootLightsService.toLightsGroupResponse(g));
  }

  @Security('local', ['*'])
  @Get('group/{id}')
  public async getSingleLightsGroup(id: number): Promise<LightsGroupResponse | undefined> {
    const group = await new RootLightsService().getSingleLightsGroup(id);
    if (!group) {
      this.setStatus(404);
      return undefined;
    }
    return RootLightsService.toLightsGroupResponse(group);
  }

  @Security('local', [SecurityGroup.ADMIN])
  @Post('controller/{controllerId}/group')
  public async createLightsGroup(
    controllerId: number,
    @Body() params: LightsGroupCreateParams,
  ): Promise<LightsGroupResponse | undefined> {
    const group = await new RootLightsService().createLightGroup(controllerId, params);
    if (!group) {
      this.setStatus(404);
      return undefined;
    }
    return RootLightsService.toLightsGroupResponse(group);
  }

  @Security('local', [SecurityGroup.ADMIN])
  @Get('fixture/par')
  public async getAllLightsPars(): Promise<ParResponse[]> {
    const pars = await new RootLightsService().getAllLightsPars();
    return pars.map((p) => RootLightsService.toParResponse(p));
  }

  @Security('local', [SecurityGroup.ADMIN])
  @Post('fixture/par')
  public async createLightsPar(@Body() params: LightsParCreateParams): Promise<ParResponse> {
    const par = await new RootLightsService().createLightsPar(params);
    return RootLightsService.toParResponse(par);
  }

  @Security('local', [SecurityGroup.ADMIN])
  @Get('fixture/moving-head/rgb')
  public async getAllLightsMovingHeadsRgb(): Promise<MovingHeadRgbResponse[]> {
    const movingHeads = await new RootLightsService().getAllMovingHeadRgbs();
    return movingHeads.map((m) => RootLightsService.toMovingHeadRgbResponse(m));
  }

  @Security('local', [SecurityGroup.ADMIN])
  @Post('fixture/moving-head/rgb')
  public async createLightsMovingHeadRgb(
    @Body() params: LightsMovingHeadRgbCreateParams,
  ): Promise<MovingHeadRgbResponse> {
    const movingHead = await new RootLightsService().createMovingHeadRgb(params);
    return RootLightsService.toMovingHeadRgbResponse(movingHead);
  }

  @Security('local', [SecurityGroup.ADMIN])
  @Get('fixture/moving-head/wheel')
  public async getAllLightsMovingHeadsWheel(): Promise<MovingHeadWheelResponse[]> {
    const movingHeads = await new RootLightsService().getAllMovingHeadWheels();
    return movingHeads.map((m) => RootLightsService.toMovingHeadWheelResponse(m));
  }

  @Security('local', [SecurityGroup.ADMIN])
  @Post('fixture/moving-head/wheel')
  public async createLightsMovingHeadWheel(
    @Body() params: LightsMovingHeadWheelCreateParams,
  ): Promise<MovingHeadWheelResponse> {
    const movingHead = await new RootLightsService().createMovingHeadWheel(params);
    return RootLightsService.toMovingHeadWheelResponse(movingHead);
  }

  @Security('local', ['*'])
  @Get('effects')
  public getAllLightsEffects() {
    return LIGHTS_EFFECTS.map((e) => e.name);
  }

  @Security('local', ['*'])
  @Get('colors')
  public getAllLightsColors(): LightsColorResponse[] {
    return rgbColors.map(
      (color: RgbColor): LightsColorResponse => ({
        color,
        spec: rgbColorDefinitions[color],
      }),
    );
  }
}
