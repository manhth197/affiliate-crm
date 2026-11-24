import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiErrors } from '../common/errors/api-errors.decorator';
import { Role } from '../generated/prisma/enums';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginatedUsersDto, UserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@ApiErrors(401, 403)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (admin)' })
  @ApiOkResponse({ type: PaginatedUsersDto })
  @ApiErrors(400)
  list(@Query() query: ListUsersQueryDto): Promise<PaginatedUsersDto> {
    return this.users.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a STAFF or ADMIN account' })
  @ApiCreatedResponse({ type: UserDto })
  @ApiErrors(400, 409)
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserDto> {
    return this.users.createStaff(dto, actor.id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a user (status, name, phone)',
    description:
      'Disabling a user revokes all their refresh tokens. Admins cannot disable themselves (422).',
  })
  @ApiOkResponse({ type: UserDto })
  @ApiErrors(400, 404, 422)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserDto> {
    return this.users.update(id, dto, actor.id);
  }
}
