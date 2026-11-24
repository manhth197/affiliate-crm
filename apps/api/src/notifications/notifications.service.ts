import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { pageArgs, toPage } from '../common/dto/pagination.dto';
import type { Notification, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationJob, QueueName } from '../queues/queues';
import { RealtimeEvent, RealtimeGateway } from '../realtime/realtime.gateway';
import type {
  ListNotificationsQueryDto,
  NotificationDto,
  PaginatedNotificationsDto,
} from './dto/notification.dto';
import type { NotificationMessage } from './notification-messages';

export function toNotificationDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: (n.data ?? {}) as Record<string, string>,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    @InjectQueue(QueueName.Notifications) private readonly queue: Queue,
  ) {}

  /**
   * Queued, not written inline: the request that caused it (e.g. a status
   * change) does not wait for it, and a failed delivery is retried.
   */
  async enqueue(message: NotificationMessage): Promise<void> {
    await this.queue.add(NotificationJob.Send, message);
  }

  /** Called by the worker: store, then push to the user's open sockets. */
  async deliver(message: NotificationMessage): Promise<NotificationDto> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: message.userId,
        type: message.type,
        title: message.title,
        body: message.body,
        data: message.data,
      },
    });
    const dto = toNotificationDto(notification);
    this.realtime.emitToUser(
      message.userId,
      RealtimeEvent.NotificationNew,
      dto,
    );
    return dto;
  }

  async list(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<PaginatedNotificationsDto> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unread && { readAt: null }),
    };
    const [items, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      ...toPage(items.map(toNotificationDto), total, query),
      unreadCount,
    };
  }

  async markRead(id: string, userId: string): Promise<NotificationDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException('You can only read your own notifications');
    }
    if (notification.readAt) {
      return toNotificationDto(notification);
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return toNotificationDto(updated);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
