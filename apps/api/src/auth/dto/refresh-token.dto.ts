import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

@ApiSchema({ name: 'RefreshTokenRequest' })
export class RefreshTokenDto {
  /**
   * Deprecated (contract v0.6): omit it and the API uses the `crm_rt`
   * httpOnly cookie instead. Still accepted for older clients.
   */
  @ApiProperty({ required: false, deprecated: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  refreshToken?: string;
}
