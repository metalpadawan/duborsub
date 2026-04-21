// Comment DTOs describe create, edit, vote, and pagination payloads for discussions.
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { SanitizePlainText } from '../../common/sanitization/sanitize.decorator';

export class CreateCommentDto {
  @SanitizePlainText()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateCommentDto {
  @SanitizePlainText()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

export class VoteCommentDto {
  @IsInt()
  @IsIn([1, -1])
  value: 1 | -1;
}

export class CommentsQueryDto {
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
