import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

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

    @IsString()
    contact: string;

    @IsOptional()
    @IsString()
    message?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    // 🔥 NOUVEAU
    @IsOptional()
    @IsArray()
    serviceCategories?: string[];

    @IsOptional()
    @IsString()
    profileImageUrl?: string;

    @IsOptional()
    @IsString()
    bannerUrl?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    lat?: number;

    @IsOptional()
    lng?: number;
    @IsOptional()
    @IsArray()
    categories?: string[];
}
// Ajout pour les prestataires de services
