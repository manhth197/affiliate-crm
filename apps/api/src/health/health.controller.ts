import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { HealthDto } from './health.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness and dependency check (DB, Redis)' })
  @ApiOkResponse({ type: HealthDto })
  @ApiServiceUnavailableResponse({
    type: HealthDto,
    description: 'A dependency is down',
  })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthDto> {
    const result = await this.health.check();
    // 503 lets load balancers and Docker healthchecks act on it; body stays the same shape.
    if (result.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
