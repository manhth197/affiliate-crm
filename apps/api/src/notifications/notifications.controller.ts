import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiErrors } from '../common/errors/api-errors.decorator';
import {
  ListNotificationsQueryDto,
  NotificationDto,
  PaginatedNotificationsDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@ApiErrors(401)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'My notifications, newest first' })
  @ApiOkResponse({ type: PaginatedNotificationsDto })
  @ApiErrors(400)
  list(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PaginatedNotificationsDto> {
    return this.notifications.list(user.id, query);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  @ApiNoContentResponse()
  markAllRead(@CurrentUser() user: AuthUser): Promise<void> {
    return this.notifications.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read (owner)' })
  @ApiOkResponse({ type: NotificationDto })
  @ApiErrors(400, 403, 404)
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<NotificationDto> {
    return this.notifications.markRead(id, user.id);
  }
}
