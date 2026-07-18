import { IsString, IsOptional, IsBoolean, IsArray, IsNumber, IsEmail } from 'class-validator';

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

  // Optionnel au niveau DTO (les Prestataires peuvent s'inscrire sans email).
  // ⚠️ Obligatoire pour type=Marchand/Restaurant : vérifié dans PartnersService.create()
  // pour donner un message d'erreur clair plutôt qu'un 400 générique de class-validator.
  @IsOptional()
  @IsEmail({}, { message: "L'adresse email n'est pas valide" })
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
