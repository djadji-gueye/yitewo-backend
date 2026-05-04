import { IsString, IsOptional, IsBoolean, IsArray, IsNumber } from 'class-validator';

export class CreatePartnerDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  name: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  contact: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsArray()
  categories?: string[];

  @IsOptional()
  @IsArray()
  serviceCategories?: string[];
}
