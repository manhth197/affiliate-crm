import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { STATUS_CODES } from 'node:http';
import { ErrorResponseDto } from './error-response.dto';

/**
 * Documents error responses in Swagger with the shared error schema:
 * `@ApiErrors(400, 404, 409)`.
 */
export function ApiErrors(
  ...statuses: number[]
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        type: ErrorResponseDto,
        description: STATUS_CODES[status],
      }),
    ),
  );
}
