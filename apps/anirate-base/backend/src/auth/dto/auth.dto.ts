// These DTOs document and validate every auth payload that enters the API.
// Keeping them together makes it easy to see the shape of the full auth surface.
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { SanitizeEmail, SanitizePlainText, SanitizeString } from '../../common/sanitization/sanitize.decorator';

export class RegisterDto {
  @SanitizeString({ trim: true })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  username: string;

  @SanitizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#]).+$/)
  password: string;
}

export class LoginDto {
  @SanitizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

export class ForgotPasswordDto {
  @SanitizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @SanitizePlainText()
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#]).+$/)
  newPassword: string;
}

export class RefreshSessionDto {
  @IsOptional()
  @SanitizePlainText()
  @IsString()
  refreshToken?: string;
}

export class VerifyEmailDto {
  @SanitizePlainText()
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token: string;
}

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}
