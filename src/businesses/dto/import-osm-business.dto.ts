import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class ImportOsmBusinessDto {
  @IsString()
  @Length(2, 120)
  city: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
