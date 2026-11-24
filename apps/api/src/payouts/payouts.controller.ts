import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiErrors } from '../common/errors/api-errors.decorator';
import { Role } from '../generated/prisma/enums';
import {
  GeneratePayoutsDto,
  JobAcceptedDto,
  ListPayoutsQueryDto,
  PaginatedPayoutsDto,
  PayoutDto,
} from './dto/payout.dto';
import { PayoutsService } from './payouts.service';

@ApiTags('payouts')
@ApiBearerAuth()
@ApiErrors(401)
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get()
  @ApiOperation({
    summary: 'List payouts',
    description: 'Affiliates only see their own (affiliateId is ignored).',
  })
  @ApiOkResponse({ type: PaginatedPayoutsDto })
  @ApiErrors(400)
  list(
    @Query() query: ListPayoutsQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PaginatedPayoutsDto> {
    return this.payouts.list(query, user);
  }

  @Post('generate')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Generate DRAFT payouts for a month (background job)',
    description:
      'Groups APPROVED commissions created in the month (Vietnam calendar) per affiliate. Safe to run again: DRAFT payouts are topped up, CONFIRMED/PAID ones are left alone.',
  })
  @ApiAcceptedResponse({ type: JobAcceptedDto })
  @ApiErrors(400, 403)
  generate(
    @Body() dto: GeneratePayoutsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<JobAcceptedDto> {
    return this.payouts.requestGeneration(dto.month, user.id);
  }

  @Patch(':id/confirm')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'DRAFT → CONFIRMED (admin)' })
  @ApiOkResponse({ type: PayoutDto })
  @ApiErrors(400, 403, 404, 409)
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PayoutDto> {
    return this.payouts.confirm(id, user.id);
  }

  @Patch(':id/mark-paid')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'CONFIRMED → PAID (admin)',
    description: 'Also marks its commissions PAID and notifies the affiliate.',
  })
  @ApiOkResponse({ type: PayoutDto })
  @ApiErrors(400, 403, 404, 409)
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PayoutDto> {
    return this.payouts.markPaid(id, user.id);
  }
}
