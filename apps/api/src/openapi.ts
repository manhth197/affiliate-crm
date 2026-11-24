/**
 * Writes the OpenAPI document to docs/openapi.json (repo root) so the web app
 * can generate its API types. Run with `npm run openapi:export`.
 *
 * It runs from the compiled dist/ output because the Swagger CLI plugin adds
 * DTO metadata at compile time (`nest build`). No DB or Redis connection is
 * opened: both clients connect lazily.
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from './app.module';
import { APP_OPTIONS, configureApp, createOpenApiDocument } from './app.setup';

const DEFAULT_OUTPUT = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'openapi.json',
);

async function exportOpenApi(outputFile: string): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    ...APP_OPTIONS,
    logger: ['error', 'warn'],
  });
  configureApp(app);
  const document = createOpenApiDocument(app);
  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  Logger.log(`OpenAPI document written to ${outputFile}`, 'OpenAPI');
}

exportOpenApi(
  process.argv[2] ? resolve(process.argv[2]) : DEFAULT_OUTPUT,
).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
