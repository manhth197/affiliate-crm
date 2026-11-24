import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QueueName } from '../queues/queues';
import type { NotificationMessage } from './notification-messages';
import { NotificationsService } from './notifications.service';

@Processor(QueueName.Notifications, { concurrency: 10 })
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationMessage>): Promise<{ id: string }> {
    const notification = await this.notifications.deliver(job.data);
    return { id: notification.id };
  }
}
