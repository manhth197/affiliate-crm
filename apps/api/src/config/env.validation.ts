// Must load before the class below is defined so its property types are recorded.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { parsePartnerWebhooks } from '../webhooks/partners';
import {
  IsEnum,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Every environment variable the API reads. Validated once at startup so a
 * misconfigured deployment fails fast instead of at the first request.
 *
 * The explicit `: number` annotations are required: class-transformer reads
 * the target type from decorator metadata, which TypeScript only emits for
 * annotated properties.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @Matches(/^postgres(ql)?:\/\//, { message: 'must be a postgresql:// URL' })
  DATABASE_URL!: string;

  @Matches(/^rediss?:\/\//, { message: 'must be a redis:// URL' })
  REDIS_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsInt()
  @Min(60)
  JWT_ACCESS_TTL_SECONDS: number = 900;

  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS: number = 7;

  @IsInt()
  @Min(1)
  AUTH_THROTTLE_LIMIT: number = 10;

  @IsInt()
  @Min(1)
  AUTH_THROTTLE_TTL_SECONDS: number = 60;

  /** Comma-separated list of allowed browser origins. */
  @IsString()
  CORS_ORIGINS: string = 'http://localhost:5173';

  /**
   * JSON array of partners allowed to call the status webhook:
   * [{ "id": "an-phat", "name": "Tài chính An Phát", "secret": "..." }].
   * `name` must equal Product.partnerName of the leads that partner may update.
   */
  @IsString()
  PARTNER_WEBHOOKS: string = '[]';

  /** How often to re-enqueue missing commissions (safety net). 0 disables it. */
  @IsInt()
  @Min(0)
  COMMISSION_RECONCILE_MINUTES: number = 10;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  // enableImplicitConversion turns "3000" into 3000 using the property types above.
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });
  const lines = errors.map(
    (e) =>
      `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
  );
  if (typeof env.PARTNER_WEBHOOKS === 'string') {
    try {
      parsePartnerWebhooks(env.PARTNER_WEBHOOKS);
    } catch (error) {
      lines.push(`  - PARTNER_WEBHOOKS: ${(error as Error).message}`);
    }
  }
  if (lines.length > 0) {
    throw new Error(`Invalid environment variables:\n${lines.join('\n')}`);
  }
  return env;
}

/** Typed ConfigService: `config.get('PORT', { infer: true })` returns a number. */
export type AppConfig = EnvironmentVariables;
