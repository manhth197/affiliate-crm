import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import type { ErrorDetailDto } from '../errors/error-response.dto';

/**
 * Flattens class-validator errors (including nested objects) into
 * `[{ field: "address.city", message: "must be a string" }]`.
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath?: string,
): ErrorDetailDto[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message: stripPropertyName(message, error.property),
    }));
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

/** class-validator says "email must be an email"; the field is already in `field`. */
function stripPropertyName(message: string, property: string): string {
  const prefix = `${property} `;
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    message: 'Validation failed',
    details: flattenValidationErrors(errors),
  });
}
