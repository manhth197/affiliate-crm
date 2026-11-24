// Must load before the class below is defined so its property types are recorded.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
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
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  // enableImplicitConversion turns "3000" into 3000 using the property types above.
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const lines = errors.map(
      (e) =>
        `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
    );
    throw new Error(`Invalid environment variables:\n${lines.join('\n')}`);
  }
  return env;
}

/** Typed ConfigService: `config.get('PORT', { infer: true })` returns a number. */
export type AppConfig = EnvironmentVariables;
