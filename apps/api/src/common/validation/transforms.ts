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
