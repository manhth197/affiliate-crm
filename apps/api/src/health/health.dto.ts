import { ApiProperty, ApiSchema } from '@nestjs/swagger';

export type ProbeStatus = 'up' | 'down';

@ApiSchema({ name: 'Health' })
export class HealthDto {
  @ApiProperty({ enum: ['ok', 'error'] })
  status!: 'ok' | 'error';

  @ApiProperty({ enum: ['up', 'down'] })
  db!: ProbeStatus;

  @ApiProperty({ enum: ['up', 'down'] })
  redis!: ProbeStatus;
}
