import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { ErrorCode } from './error-codes';

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

  /** Machine-readable code on business errors (403 disabled account, 409, 422). */
  @ApiProperty({
    enum: Object.values(ErrorCode),
    enumName: 'ErrorCode',
    required: false,
  })
  code?: ErrorCode;
  /** @example "Validation failed" */
  message!: string;
  details?: ErrorDetailDto[];
}
