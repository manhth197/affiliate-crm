import type { INestApplication, NestApplicationOptions } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import type { AppConfig } from './config/env.validation';
import { RealtimeIoAdapter } from './realtime/realtime-io.adapter';

export const API_PREFIX = 'api/v1';
export const DOCS_PATH = 'api/docs';

/** Options for NestFactory.create: keep the raw body so webhook HMACs can be verified. */
export const APP_OPTIONS: NestApplicationOptions = { rawBody: true };

/** HTTP setup shared by main.ts, the OpenAPI export and e2e tests. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.setGlobalPrefix(API_PREFIX);
  // Reads the crm_rt refresh-token cookie into request.cookies.
  app.use(cookieParser());
  app.enableCors({
    origin: origins,
    // Lets the web app send the refresh-token cookie; only ever for the
    // configured origins above (never with a wildcard).
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    // Lets the browser read the file name of the CSV export.
    exposedHeaders: ['Content-Disposition'],
    // Browsers may cache the preflight answer for 10 minutes.
    maxAge: 600,
  });
  app.useWebSocketAdapter(new RealtimeIoAdapter(app, origins));
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Affiliate CRM API')
    .setDescription(
      'REST API for the Affiliate CRM. Source of truth: docs/api-contract.md. ' +
        'Money is VND as integers; dates are ISO 8601 UTC.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('crm_rt', {
      type: 'apiKey',
      in: 'cookie',
      name: 'crm_rt',
      description:
        'httpOnly refresh-token cookie (set by login/register/refresh)',
    })
    .build();
  return SwaggerModule.createDocument(app, config, {
    // "AuthController.login" -> "Auth_login"
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}
