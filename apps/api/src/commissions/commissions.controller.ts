import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
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
import { CommissionsService } from './commissions.service';
import {
  CancelCommissionDto,
  CommissionDto,
  CommissionSummaryDto,
  ListCommissionsQueryDto,
  PaginatedCommissionsDto,
} from './dto/commission.dto';

@ApiTags('commissions')
@ApiBearerAuth()
@ApiErrors(401)
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List commissions',
    description: 'Affiliates only see their own (affiliateId is ignored).',
  })
  @ApiOkResponse({ type: PaginatedCommissionsDto })
  @ApiErrors(400)
  list(
    @Query() query: ListCommissionsQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PaginatedCommissionsDto> {
    return this.commissions.list(query, user);
  }

  @Get('summary')
  @Roles(Role.AFFILIATE)
  @ApiOperation({ summary: 'Commission totals for the logged-in affiliate' })
  @ApiOkResponse({ type: CommissionSummaryDto })
  @ApiErrors(403)
  summary(@CurrentUser() user: AuthUser): Promise<CommissionSummaryDto> {
    return this.commissions.summary(user.id);
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve a PENDING commission (admin)' })
  @ApiOkResponse({ type: CommissionDto })
  @ApiErrors(400, 403, 404, 409)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<CommissionDto> {
    return this.commissions.approve(id, user.id);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Cancel a commission (admin)',
    description:
      'Allowed for PENDING or APPROVED commissions not yet in a payout.',
  })
  @ApiOkResponse({ type: CommissionDto })
  @ApiErrors(400, 403, 404, 409)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelCommissionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CommissionDto> {
    return this.commissions.cancel(id, dto.reason, user.id);
  }
}
