// AuthController translates HTTP requests into auth service calls and handles
// the refresh cookie lifecycle that the browser depends on.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { TrustedOriginGuard } from '../common/guards/trusted-origin.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { DeleteAccountDto, ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, VerifyEmailDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
@UseGuards(TrustedOriginGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res() res: Response) {
    const session = await this.authService.login(dto, req.ip ?? '', req.headers['user-agent'] ?? '');
    res.cookie('refresh_token', session.refreshToken, this.getRefreshCookieOptions());
    res.json({
      user: session.user,
      accessToken: session.accessToken,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res() res: Response) {
    const rawToken = req.cookies?.refresh_token;
    const session = await this.authService.refresh(rawToken, req.ip ?? '', req.headers['user-agent'] ?? '');
    res.cookie('refresh_token', session.refreshToken, this.getRefreshCookieOptions());
    res.json({ accessToken: session.accessToken });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async logout(@Req() req: Request, @Res() res: Response) {
    await this.authService.logout(req.cookies?.refresh_token);
    res.clearCookie('refresh_token', this.getRefreshCookieOptions());
    res.send();
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: { id: string }) {
    return this.authService.getMe(user.id);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  resendVerification(@CurrentUser() user: { id: string }) {
    return this.authService.resendVerification(user.id);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async deleteAccount(@CurrentUser() user: { id: string }, @Body() dto: DeleteAccountDto, @Res() res: Response) {
    const result = await this.authService.deleteAccount(user.id, dto.password);
    res.clearCookie('refresh_token', this.getRefreshCookieOptions());
    res.json(result);
  }

  private getRefreshCookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
      sameSite: this.config.getOrThrow<'lax' | 'strict' | 'none'>('COOKIE_SAME_SITE'),
      maxAge: this.authService.getRefreshTokenTtlMs(),
      path: '/api/v1/auth',
    };
  }
}
