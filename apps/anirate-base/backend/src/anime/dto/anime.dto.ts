// The anime DTOs define the catalog payloads and query parameters used by the UI.
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SanitizePlainText, SanitizeQueryText, SanitizeString } from '../../common/sanitization/sanitize.decorator';
import { IsSecureHttpUrl } from '../../common/validation/is-secure-http-url.decorator';

export class CreateAnimeDto {
  @SanitizePlainText()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @IsOptional()
  @SanitizePlainText()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @SanitizeString({ trim: true })
  @IsSecureHttpUrl()
  coverImageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1960)
  @Max(2100)
  releaseYear?: number;

  @IsOptional()
  @IsBoolean()
  hasDub?: boolean;

  @IsOptional()
  @IsIn(['airing', 'completed', 'upcoming'])
  status?: 'airing' | 'completed' | 'upcoming';

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  genreIds?: number[];
}

export class UpdateAnimeDto {
  @IsOptional()
  @SanitizePlainText()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @SanitizePlainText()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @SanitizeString({ trim: true })
  @IsSecureHttpUrl()
  coverImageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1960)
  @Max(2100)
  releaseYear?: number;

  @IsOptional()
  @IsBoolean()
  hasDub?: boolean;

  @IsOptional()
  @IsIn(['airing', 'completed', 'upcoming'])
  status?: 'airing' | 'completed' | 'upcoming';

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  genreIds?: number[];
}

export class AnimeQueryDto {
  @IsOptional()
  @SanitizeQueryText()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['airing', 'completed', 'upcoming'])
  status?: 'airing' | 'completed' | 'upcoming';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  genreId?: number;

  @IsOptional()
  @IsIn(['title', 'rating', 'year', 'votes'])
  sortBy?: 'title' | 'rating' | 'year' | 'votes';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

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
