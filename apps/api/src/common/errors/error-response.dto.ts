import { ApiProperty, ApiSchema } from '@nestjs/swagger';

/** One invalid field in a 400 response. */
@ApiSchema({ name: 'ErrorDetail' })
export class ErrorDetailDto {
  /** Dotted path of the invalid field, e.g. "customerPhone". */
  field!: string;
  message!: string;
}

/** Shape of every error response (see "Errors" in docs/api-contract.md). */
@ApiSchema({ name: 'ErrorResponse' })
export class ErrorResponseDto {
  @ApiProperty({ type: 'integer', example: 400 })
  statusCode!: number;
  /** @example "Bad Request" */
  error!: string;
  /** @example "Validation failed" */
  message!: string;
  details?: ErrorDetailDto[];
}
