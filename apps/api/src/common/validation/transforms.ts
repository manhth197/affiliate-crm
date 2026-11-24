import { Transform } from 'class-transformer';

/** Trims surrounding whitespace from string input. */
export const Trim = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** Trims and lower-cases string input (used for emails). */
export const TrimLowercase = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

/**
 * Query strings are always text: turns "true"/"false" into booleans and leaves
 * anything else for @IsBoolean() to reject.
 */
export const ToBoolean = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  });
