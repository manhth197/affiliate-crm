import { ApiSchema } from '@nestjs/swagger';

/**
 * A request body without fields: `{}` or nothing. With the global
 * ValidationPipe (forbidNonWhitelisted) any property is rejected with 400,
 * e.g. a leftover `refreshToken` from an old client.
 */
@ApiSchema({ name: 'EmptyRequest' })
export class EmptyBodyDto {}
