import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { BusinessListingSource, BusinessListingStatus } from '@prisma/client';

export class CreateBusinessListingDto {
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() googlePlaceId?: string;
  @IsOptional() @IsString() externalSourceId?: string;
  @IsString() @Length(2, 200) name: string;
  @IsOptional() @IsString() category?: string;
  @IsString() @Length(2, 200) city: string;
  @IsOptional() @IsString() zone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail({}, { message: "L'email n'est pas valide." }) email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsEnum(BusinessListingSource) source?: BusinessListingSource;
  @IsOptional() @IsEnum(BusinessListingStatus) status?: BusinessListingStatus;
}
