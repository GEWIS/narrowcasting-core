import { Strategy as CustomStrategy } from 'passport-custom';
import passport from 'passport';
import { NextFunction, Request as ExRequest, Response as ExResponse } from 'express';

passport.use('mock', new CustomStrategy(
  (req, callback) => {
    callback(null, {
      name: 'mock',
      roles: ['PRIV - Narrowcasting Test Admin'],
    });
  },
));

export const mockLogin = (
  req: ExRequest,
  res: ExResponse,
) => {
  res.status(204).send();
};
