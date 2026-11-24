import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiErrors } from '../common/errors/api-errors.decorator';
import { Role } from '../generated/prisma/enums';
import { StaffMemberDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('staff')
@ApiBearerAuth()
@ApiErrors(401, 403)
@Roles(Role.STAFF, Role.ADMIN)
@Controller('staff')
export class StaffController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Active STAFF and ADMIN users who can be assigned leads',
  })
  @ApiOkResponse({ type: [StaffMemberDto] })
  list(): Promise<StaffMemberDto[]> {
    return this.users.listStaff();
  }
}
