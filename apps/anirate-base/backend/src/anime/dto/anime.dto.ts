// The anime DTOs define the catalog payloads and query parameters used by the UI.
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAnimeDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
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
  genreIds?: number[];
}

export class UpdateAnimeDto extends CreateAnimeDto {}

export class AnimeQueryDto {
  @IsOptional()
  @IsString()
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
