// Admin DTOs capture the lightweight moderation and list-query payloads used in the demo.
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { SanitizePlainText, SanitizeQueryText } from '../../common/sanitization/sanitize.decorator';

export class AdminQueryDto {
  @IsOptional()
  @SanitizeQueryText()
  @IsString()
  @MaxLength(100)
  search?: string;

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

export class BanUserDto {
  @IsOptional()
  @SanitizePlainText()
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  reason?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays?: number;
}
