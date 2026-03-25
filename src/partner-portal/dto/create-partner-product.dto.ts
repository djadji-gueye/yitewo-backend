import { IsString, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreatePartnerProductDto {
  @IsString()
  name: string;

  @IsInt() @Min(0)
  price: number;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  imageUrl?: string;

  @IsString()
  token: string; // portal token for auth
}
