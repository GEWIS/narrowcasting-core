import { Response as ExResponse, Request as ExRequest, NextFunction, Express } from 'express';
import { ValidateError } from 'tsoa';
import { AxiosError } from 'axios';
import { ApiError as TrelloAPIError } from '@gewis/trello-client';
import { HttpApiException, HttpStatusCode } from './helpers/customError';
import logger from './logger';

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

      if (err) {
        logger.error(err);
        return res.status(500).json('Internal server error.');
      }

      next();
      return undefined;
    },
  );
}
