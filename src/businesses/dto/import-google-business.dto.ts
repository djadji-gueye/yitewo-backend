import { IsOptional, IsString, Length } from 'class-validator';

export class ImportGoogleBusinessDto {
  @IsString()
  @Length(2, 200)
  query: string;

  @IsOptional()
  @IsString()
  city?: string;
}
