import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiErrors } from '../common/errors/api-errors.decorator';
import { Role } from '../generated/prisma/enums';
import {
  ReportOverviewDto,
  ReportRangeQueryDto,
  TopAffiliateDto,
  TopAffiliatesQueryDto,
} from './dto/report.dto';
import { resolveReportRange } from './report-range';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@ApiErrors(400, 401, 403)
@Roles(Role.STAFF, Role.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Pipeline and commission overview for [from, to)',
    description:
      'Defaults to the last 30 Vietnam calendar days. Max range 366 days.',
  })
  @ApiOkResponse({ type: ReportOverviewDto })
  overview(@Query() query: ReportRangeQueryDto): Promise<ReportOverviewDto> {
    return this.reports.overview(resolveReportRange(query.from, query.to));
  }

  @Get('top-affiliates')
  @ApiOperation({ summary: 'Best affiliates in [from, to)' })
  @ApiOkResponse({ type: [TopAffiliateDto] })
  topAffiliates(
    @Query() query: TopAffiliatesQueryDto,
  ): Promise<TopAffiliateDto[]> {
    return this.reports.topAffiliates(
      resolveReportRange(query.from, query.to),
      query.limit,
    );
  }
}
