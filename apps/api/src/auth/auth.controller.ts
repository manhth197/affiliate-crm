import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UnsupportedMediaTypeException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ErrorResponseDto } from '../common/errors/error-response.dto';
import { MeDto } from '../users/dto/user.dto';
import type { AuthUser } from './auth.types';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthResponseDto, TokenPairDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import {
  isJsonRequest,
  REFRESH_COOKIE,
  resolveRefreshToken,
} from './refresh-cookie';
import { RefreshCookieService } from './refresh-cookie.service';

const SET_COOKIE_HEADER = {
  'Set-Cookie': {
    description: `${REFRESH_COOKIE}=<refresh token>; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800 (+ Secure in production)`,
    schema: { type: 'string' },
  },
};

@ApiTags('auth')
@Controller('auth')
// Rate limit per IP against credential stuffing / brute force.
@UseGuards(ThrottlerGuard)
@ApiTooManyRequestsResponse({
  type: ErrorResponseDto,
  description: 'Rate limit exceeded',
})
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: RefreshCookieService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register an affiliate account' })
  @ApiCreatedResponse({ type: AuthResponseDto, headers: SET_COOKIE_HEADER })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Email already registered',
  })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.register(dto);
    this.cookies.set(response, result.refreshToken);
    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({ type: AuthResponseDto, headers: SET_COOKIE_HEADER })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Invalid email or password',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Account is disabled',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.login(dto);
    this.cookies.set(response, result.refreshToken);
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refreshCookie')
  @ApiOperation({
    summary: 'Exchange a refresh token for a new token pair',
    description:
      'Uses `refreshToken` from the body if present (deprecated), otherwise the `crm_rt` cookie; cookie calls must be `Content-Type: application/json`. ' +
      'Refresh tokens are single use: reusing an old one revokes the whole session (401). On 401/403 the cookie is cleared.',
  })
  @ApiOkResponse({ type: TokenPairDto, headers: SET_COOKIE_HEADER })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Missing, invalid, expired or reused refresh token',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Account is disabled',
  })
  @ApiUnsupportedMediaTypeResponse({
    type: ErrorResponseDto,
    description: 'Cookie call without Content-Type: application/json',
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TokenPairDto> {
    const { token, fromCookie } = resolveRefreshToken(
      dto.refreshToken,
      request,
    );
    if (fromCookie && token && !isJsonRequest(request)) {
      throw new UnsupportedMediaTypeException(
        'Cookie-based refresh requires Content-Type: application/json',
      );
    }
    if (!token) {
      throw new UnauthorizedException('Missing refresh token');
    }
    try {
      const pair = await this.auth.refresh(token);
      this.cookies.set(response, pair.refreshToken);
      return pair;
    } catch (error) {
      // A dead token should not keep being sent by the browser.
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        this.cookies.clear(response);
      }
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'End this session',
    description:
      'Revokes the refresh token from the body (deprecated) or the `crm_rt` cookie, and always clears the cookie.',
  })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async logout(
    @CurrentUser() user: AuthUser,
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const { token } = resolveRefreshToken(dto.refreshToken, request);
    if (token) {
      await this.auth.logout(user.id, token);
    }
    this.cookies.clear(response);
  }

  @Get('me')
  @SkipThrottle()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user' })
  @ApiOkResponse({ type: MeDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  me(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.auth.me(user.id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update my profile',
    description:
      'bankName / bankAccountNumber are for affiliates only (403 otherwise). The account number is only ever returned masked.',
  })
  @ApiOkResponse({ type: MeDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMeDto,
  ): Promise<MeDto> {
    return this.auth.updateMe(user, dto);
  }
}
