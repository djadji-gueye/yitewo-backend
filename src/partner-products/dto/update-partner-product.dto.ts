import { IsString, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';

export class UpdatePartnerProductDto {
  @IsString()
  token: string;

  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsInt() @Min(0)
  price?: number;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  imageUrl?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
