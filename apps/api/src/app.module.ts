import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CommissionsModule } from './commissions/commissions.module';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { validationExceptionFactory } from './common/validation/validation-exception.factory';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { LeadsModule } from './leads/leads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { QueuesModule } from './queues/queues.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisModule,
    QueuesModule,
    AuditModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    LeadsModule,
    CommissionsModule,
    NotificationsModule,
    RealtimeModule,
    WebhooksModule,
    HealthModule,
  ],
  providers: [
    // Registered as providers (not app.useGlobal*) so they also apply in e2e
    // tests that build the app from this module.
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true, // strip properties without decorators...
          forbidNonWhitelisted: true, // ...and reject requests that send them
          transform: true, // plain JSON -> DTO class instances
          exceptionFactory: validationExceptionFactory,
        }),
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
