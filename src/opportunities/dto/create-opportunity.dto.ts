import { IsString, IsOptional, IsArray, IsEnum, IsBoolean } from 'class-validator';
import { OpportunityCategory } from '@prisma/client';

export class CreateOpportunityDto {
  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsEnum(OpportunityCategory)
  category: OpportunityCategory;

  @IsString()
  location: string;

  @IsString()
  description: string;

  @IsOptional() @IsString()
  price?: string;

  @IsOptional() @IsString()
  badge?: string;

  @IsOptional() @IsArray()
  details?: string[];

  @IsOptional() @IsString()
  imageUrl?: string;

  @IsOptional() @IsString()
  contact?: string;

  @IsOptional() @IsBoolean()
  isPublished?: boolean;

  @IsOptional() @IsBoolean()
  isExternal?: boolean;

  @IsOptional() @IsString()
  sourceUrl?: string;

  @IsOptional() @IsString()
  sourceName?: string;
}
