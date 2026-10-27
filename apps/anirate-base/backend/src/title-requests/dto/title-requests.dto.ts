// Title requests: what a visitor sends in, and how an admin settles it.
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { SanitizeMultilineText, SanitizePlainText, SanitizeString } from '../../common/sanitization/sanitize.decorator';
import { IsSecureHttpUrl } from '../../common/validation/is-secure-http-url.decorator';

export class CreateTitleRequestDto {
  @SanitizePlainText()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @IsOptional()
  @SanitizeMultilineText()
  @IsString()
  @MaxLength(1000)
  details?: string;

  @IsOptional()
  @SanitizeString({ trim: true })
  @IsSecureHttpUrl()
  link?: string;

  // A field people never see; anything in it marks the request as a bot's.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class TitleRequestQueryDto {
  @IsOptional()
  @IsIn(['pending', 'added', 'rejected'])
  status: 'pending' | 'added' | 'rejected' = 'pending';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class ResolveTitleRequestDto {
  @IsIn(['added', 'rejected'])
  status: 'added' | 'rejected';

  // The catalogue entry the request was added as.
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/)
  animeId?: string;

  @IsOptional()
  @SanitizePlainText()
  @IsString()
  @MaxLength(500)
  note?: string;
}
