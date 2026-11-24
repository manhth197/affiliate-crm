import { ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;

export class PaginationQueryDto {
  /** 1-based page number. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /** Items per page (max 100). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 20;
}

@ApiSchema({ name: 'PageMeta' })
export class PageMetaDto {
  /** @example 1 */
  page!: number;
  /** @example 20 */
  pageSize!: number;
  /** Total number of items across all pages. @example 134 */
  total!: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMetaDto;
}

/** Prisma `skip`/`take` for a page. */
export function pageArgs(query: PaginationQueryDto): {
  skip: number;
  take: number;
} {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function toPage<T>(
  data: T[],
  total: number,
  query: PaginationQueryDto,
): Paginated<T> {
  return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
}
