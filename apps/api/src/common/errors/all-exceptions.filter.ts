import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { Prisma } from '../../generated/prisma/client';
import type { ErrorDetailDto, ErrorResponseDto } from './error-response.dto';

/**
 * Turns any thrown value into the contract's error shape:
 * `{ statusCode, error, message, details? }`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      // Only HTTP is handled here; WebSocket gateways register their own filter.
      this.logger.warn(
        `Unhandled ${host.getType()} exception: ${String(exception)}`,
      );
      return;
    }
    const body = toErrorResponse(exception);
    if (body.statusCode >= 500) {
      this.logger.error(
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : exception,
      );
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(body.statusCode)
      .json(body);
  }
}

export function toErrorResponse(exception: unknown): ErrorResponseDto {
  if (exception instanceof HttpException) {
    return fromHttpException(exception);
  }
  // Safety net for constraint violations that a service did not check explicitly.
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') {
      return build(HttpStatus.CONFLICT, 'Resource already exists');
    }
    if (exception.code === 'P2025') {
      return build(HttpStatus.NOT_FOUND, 'Resource not found');
    }
  }
  // Never leak internal error messages to clients.
  return build(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error');
}

function fromHttpException(exception: HttpException): ErrorResponseDto {
  const status = exception.getStatus();
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return build(status, response);
  }
  const { message, details } = response as {
    message?: unknown;
    details?: unknown;
  };
  let text: string;
  if (typeof message === 'string') {
    text = message;
  } else if (Array.isArray(message)) {
    text = message.join('; ');
  } else {
    text = exception.message;
  }
  return build(
    status,
    text,
    Array.isArray(details) ? (details as ErrorDetailDto[]) : undefined,
  );
}

function build(
  statusCode: number,
  message: string,
  details?: ErrorDetailDto[],
): ErrorResponseDto {
  return {
    statusCode,
    error: STATUS_CODES[statusCode] ?? 'Error',
    message,
    ...(details ? { details } : {}),
  };
}
