import { Response as ExResponse, Request as ExRequest, NextFunction, Express } from 'express';
import { ValidateError } from 'tsoa';
import { AxiosError } from 'axios';
import { HttpApiException, HttpStatusCode } from './helpers/customError';
import logger from './logger';
import { ApiError as TrelloAPIError } from './modules/handlers/screen/poster/trello/client';
import ModeDisabledError from './modules/modes/mode-disabled-error';
import { InvalidStateError } from './modules/modes/time-trail-race/time-trail-race-invalid-state-error';

export function setupErrorHandler(app: Express) {
  app.use((req: ExRequest, res: ExResponse) => {
    res.status(HttpStatusCode.NotFound).send({
      message: 'Not Found',
    });
  });

  app.use(
    (err: unknown, req: ExRequest, res: ExResponse, next: NextFunction): ExResponse | void => {
      if (err instanceof ValidateError) {
        logger.warn(`Caught '${HttpStatusCode.BadRequest} - Bad Request' for ${req.path}.`);
        return res.status(HttpStatusCode.BadRequest).json({
          message: 'Bad Request',
          details: err?.fields,
        });
      }

      if (err instanceof HttpApiException) {
        logger.warn(`Caught '${err.statusCode} - ${err.name}' for ${req.path}.`);
        return res.status(err.statusCode).json({
          message: err.name,
          details: err.message,
        });
      }

      if (err instanceof TrelloAPIError) {
        logger.error(`Caught '${err.message} - ${err.name}' for ${req.path}.`);
        return res.status(500).json('Internal server error.');
      }

      if (err instanceof AxiosError) {
        logger.error(`Caught '${err.message} - ${err.name}' for ${req.path}.`);
        return res.status(500).json('Internal server error.');
      }

      if (err instanceof ModeDisabledError) {
        return res.status(404).json(err.message);
      }

      if (err instanceof InvalidStateError) {
        return res.status(428).json(err.message);
      }

      if (err) {
        logger.error(err);
        return res.status(500).json('Internal server error.');
      }

      next();
      return undefined;
    },
  );
}
