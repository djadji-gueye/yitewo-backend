import { IsString, IsOptional, IsEnum } from 'class-validator';
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
}
