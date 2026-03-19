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
