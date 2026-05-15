import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpsertConfigDto {
    @IsString()
    @IsNotEmpty()
    phoneId: string;

    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsOptional()
    verifyToken: string;

    @IsString()
    @IsNotEmpty()
    groqApiKey: string;
}