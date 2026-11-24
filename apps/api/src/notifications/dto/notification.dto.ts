import { ApiProperty, ApiSchema, IntersectionType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import {
  PageMetaDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { ToBoolean } from '../../common/validation/transforms';
import { NotificationType } from '../../generated/prisma/enums';

@ApiSchema({ name: 'Notification' })
export class NotificationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type!: NotificationType;

  /** @example "Lead LD-000123: Đã duyệt" */
  title!: string;

  body!: string;

  /** Flat string map, e.g. { "leadId": "…", "status": "APPROVED" }. */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { leadId: '0190…', leadCode: 'LD-000123', status: 'APPROVED' },
  })
  data!: Record<string, string>;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  readAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

@ApiSchema({ name: 'PaginatedNotifications' })
export class PaginatedNotificationsDto {
  data!: NotificationDto[];
  meta!: PageMetaDto;
  /** Unread notifications of the user (all pages). */
  unreadCount!: number;
}

class NotificationFiltersDto {
  /** true: only unread notifications. */
  @ApiProperty({ required: false, type: Boolean })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  unread?: boolean;
}

export class ListNotificationsQueryDto extends IntersectionType(
  NotificationFiltersDto,
  PaginationQueryDto,
) {}
