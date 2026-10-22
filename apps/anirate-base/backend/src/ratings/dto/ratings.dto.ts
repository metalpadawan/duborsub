// Rating DTOs keep score payloads narrow and explicit: 1-5 only.
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpsertRatingDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  subRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  dubRating?: number;
}

export class MyRatingsQueryDto {
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
