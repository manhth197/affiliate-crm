import { BadRequestException } from '@nestjs/common';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MinLength,
  ValidateNested,
  validateSync,
} from 'class-validator';
import {
  flattenValidationErrors,
  validationExceptionFactory,
} from './validation-exception.factory';

class Address {
  @IsString()
  city!: string;
}

class Signup {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @ValidateNested()
  @Type(() => Address)
  address!: Address;
}

function errorsFor(input: object) {
  return validateSync(plainToInstance(Signup, input));
}

describe('validation errors', () => {
  it('produces one { field, message } per failed constraint, without repeating the field name', () => {
    const details = flattenValidationErrors(
      errorsFor({ email: 'nope', password: 'short', address: { city: 'HN' } }),
    );
    expect(details).toEqual([
      { field: 'email', message: 'must be an email' },
      {
        field: 'password',
        message: 'must be longer than or equal to 8 characters',
      },
    ]);
  });

  it('uses dotted paths for nested objects', () => {
    const details = flattenValidationErrors(
      errorsFor({
        email: 'a@b.vn',
        password: '12345678',
        address: { city: 1 },
      }),
    );
    expect(details).toEqual([
      { field: 'address.city', message: 'must be a string' },
    ]);
  });

  it('wraps the details in a 400 with the contract message', () => {
    const exception = validationExceptionFactory(errorsFor({}));
    expect(exception).toBeInstanceOf(BadRequestException);
    expect(exception.getResponse()).toMatchObject({
      message: 'Validation failed',
      details: expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
      ]),
    });
  });
});
