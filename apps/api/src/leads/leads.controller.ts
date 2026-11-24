import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Readable } from 'node:stream';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { vnDate } from '../common/dates';
import { ApiErrors } from '../common/errors/api-errors.decorator';
import { Role } from '../generated/prisma/enums';
import { LeadActivityDto, LeadDto, PaginatedLeadsDto } from './dto/lead.dto';
import {
  AddLeadNoteDto,
  AssignLeadDto,
  ChangeLeadStatusDto,
  CreateLeadDto,
} from './dto/lead-requests.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@ApiErrors(401)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @ApiOperation({
    summary: 'List leads (paginated, filterable)',
    description:
      'Affiliates only get their own leads (affiliateId is ignored) with customer phone and national ID masked.',
  })
  @ApiOkResponse({ type: PaginatedLeadsDto })
  @ApiErrors(400)
  list(
    @Query() query: ListLeadsQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PaginatedLeadsDto> {
    return this.leads.list(query, user);
  }

  // Declared before ':id' so "export.csv" is not taken for an id.
  @Get('export.csv')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Export leads as CSV (admin)',
    description:
      'Same filters and sort as GET /leads; pagination is ignored. UTF-8 with BOM for Excel.',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiErrors(400, 403)
  exportCsv(
    @Query() query: ListLeadsQueryDto,
    @CurrentUser() user: AuthUser,
  ): StreamableFile {
    return new StreamableFile(
      Readable.from(this.leads.exportCsv(query, user)),
      {
        type: 'text/csv; charset=utf-8',
        disposition: `attachment; filename="leads-${vnDate(new Date())}.csv"`,
      },
    );
  }

  @Post()
  @Roles(Role.AFFILIATE)
  @ApiOperation({ summary: 'Submit a lead (affiliate)' })
  @ApiCreatedResponse({ type: LeadDto })
  @ApiErrors(400, 403, 409, 422)
  create(
    @Body() dto: CreateLeadDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LeadDto> {
    return this.leads.create(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a lead (owner, staff, admin)' })
  @ApiOkResponse({ type: LeadDto })
  @ApiErrors(400, 403, 404)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<LeadDto> {
    return this.leads.findOne(id, user);
  }

  @Patch(':id/status')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({
    summary: 'Move a lead through the pipeline',
    description:
      'NEW→CONTACTED→SUBMITTED→APPROVED→DISBURSED, or any open status→REJECTED. Invalid transition or concurrent change → 409.',
  })
  @ApiOkResponse({ type: LeadDto })
  @ApiErrors(400, 403, 404, 409)
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeLeadStatusDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LeadDto> {
    return this.leads.changeStatus(id, dto, user);
  }

  @Patch(':id/assign')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Assign a lead to a staff member' })
  @ApiOkResponse({ type: LeadDto })
  @ApiErrors(400, 403, 404, 422)
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignLeadDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LeadDto> {
    return this.leads.assign(id, dto.staffId, user);
  }

  @Post(':id/notes')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Add an internal note (not visible to affiliates)' })
  @ApiCreatedResponse({ type: LeadActivityDto })
  @ApiErrors(400, 403, 404)
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddLeadNoteDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LeadActivityDto> {
    return this.leads.addNote(id, dto.note, user);
  }

  @Get(':id/activities')
  @ApiOperation({
    summary: 'Lead timeline, newest first',
    description: 'Affiliates do not see NOTE entries.',
  })
  @ApiOkResponse({ type: [LeadActivityDto] })
  @ApiErrors(400, 403, 404)
  activities(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<LeadActivityDto[]> {
    return this.leads.activities(id, user);
  }
}
