import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '../../generated/prisma/client';
import { toErrorResponse } from './all-exceptions.filter';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: 'test',
  });
}

describe('toErrorResponse', () => {
  it('formats a simple HttpException', () => {
    expect(
      toErrorResponse(new ConflictException('Email is already registered')),
    ).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'Email is already registered',
    });
  });

  it('uses the default message when none is given', () => {
    expect(toErrorResponse(new NotFoundException())).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Not Found',
    });
  });

  it('keeps validation details', () => {
    const exception = new BadRequestException({
      message: 'Validation failed',
      details: [{ field: 'email', message: 'must be an email' }],
    });
    expect(toErrorResponse(exception)).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: [{ field: 'email', message: 'must be an email' }],
    });
  });

  it('joins array messages (Nest default validation format)', () => {
    const exception = new BadRequestException(['a is wrong', 'b is wrong']);
    expect(toErrorResponse(exception).message).toBe('a is wrong; b is wrong');
  });

  it('accepts a string response body', () => {
    expect(
      toErrorResponse(new HttpException('Nope', HttpStatus.FORBIDDEN)),
    ).toEqual({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Nope',
    });
  });

  it('formats rate-limit errors as 429', () => {
    expect(toErrorResponse(new ThrottlerException('Slow down'))).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Slow down',
    });
  });

  it('maps unique-constraint violations to 409 and missing records to 404', () => {
    expect(toErrorResponse(prismaError('P2002')).statusCode).toBe(409);
    expect(toErrorResponse(prismaError('P2025')).statusCode).toBe(404);
  });

  it('hides unknown errors behind a generic 500', () => {
    expect(
      toErrorResponse(new Error('connection string with password')),
    ).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
    expect(toErrorResponse(prismaError('P1001')).statusCode).toBe(500);
  });

  it('does not treat ForbiddenException specially', () => {
    expect(toErrorResponse(new ForbiddenException()).statusCode).toBe(403);
  });
});
