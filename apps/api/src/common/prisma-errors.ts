import { Prisma } from '../generated/prisma/client';

/**
 * True when `error` is a unique-constraint violation (P2002), optionally on a
 * specific column. Checks both the classic `meta.target` and the shape that
 * driver adapters report.
 */
export function isUniqueViolation(error: unknown, column?: string): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  if (!column) {
    return true;
  }
  return uniqueViolationFields(error).some((field) => field.includes(column));
}

function uniqueViolationFields(
  error: Prisma.PrismaClientKnownRequestError,
): string[] {
  const meta = error.meta as
    | {
        target?: string | string[];
        driverAdapterError?: {
          cause?: { constraint?: { fields?: string[]; index?: string } };
        };
      }
    | undefined;
  const fields: string[] = [];
  if (Array.isArray(meta?.target)) fields.push(...meta.target);
  else if (typeof meta?.target === 'string') fields.push(meta.target);
  const constraint = meta?.driverAdapterError?.cause?.constraint;
  if (constraint?.fields) fields.push(...constraint.fields);
  if (constraint?.index) fields.push(constraint.index);
  return fields;
}
