import passport from 'passport';
import { Strategy as CustomStrategy } from 'passport-custom';
import { Request as ExRequest, Response as ExResponse } from 'express';
import { HttpStatusCode } from 'axios';
import { HttpApiException } from '../../../helpers/customError';
import database from '../../../database';
import { ApiKey } from '../entities';
import { SecurityGroup } from '../../../helpers/security';
import { User } from '../user';

passport.use(
  'apikey',
  new CustomStrategy(async (req, callback) => {
    if (!req.body || !req.body.key) {
      callback(new HttpApiException(HttpStatusCode.BadRequest, 'Missing API Key'), undefined);
    }

    const identity = await database.getRepository(ApiKey).findOne({
      where: { key: req.body.key },
      relations: { audio: true, lightsController: true, screen: true },
    });
    if (!identity) {
      callback(new HttpApiException(HttpStatusCode.NotFound, 'Key not found'), undefined);
      return;
    }

    const roles: string[] = [];
    const names: string[] = [];
    const ids: string[] = [];
    if (identity.audio) {
      roles.push(SecurityGroup.AUDIO_SUBSCRIBER);
      names.push(identity.audio.name);
      ids.push(`audio${identity.audio.id}`);
    }
    if (identity.screen) {
      roles.push(SecurityGroup.SCREEN_SUBSCRIBER);
      names.push(identity.screen.name);
      ids.push(`screen${identity.screen.id}`);
    }
    if (identity.lightsController) {
      roles.push(SecurityGroup.LIGHTS_SUBSCRIBER);
      names.push(identity.lightsController.name);
      ids.push(`lightsController${identity.lightsController.id}`);
    }

    callback(null, {
      id: ids.join('-'),
      name: names.join('-'),
      roles,
      audioId: identity.audio?.id,
      screenId: identity.screen?.id,
      lightsControllerId: identity.lightsController?.id,
    } as User);
  }),
);

export const apiKeyResponse = (req: ExRequest, res: ExResponse): void => {
  res.status(200).send(req.user);
};
