import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { OpportunityCategory } from '@prisma/client';

export class SubmitOpportunityDto {
  @IsString()
  title: string;

  @IsEnum(OpportunityCategory)
  category: OpportunityCategory;

  @IsString()
  location: string;

  @IsString()
  description: string;

  @IsOptional() @IsString()
  price?: string;

  @IsString()
  contact: string;

  // Image principale (rétrocompatibilité)
  @IsOptional() @IsString()
  imageUrl?: string;

  // Galerie jusqu'à 5 images
  @IsOptional() @IsArray() @IsString({ each: true })
  imageUrls?: string[];
}
