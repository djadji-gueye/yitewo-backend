import { IsString, IsOptional } from 'class-validator';

export class CreateServiceRequestDto {
  @IsString()
  service: string;

  @IsString()
  city: string;

  @IsString()
  quarter: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  customerName?: string;

  @IsOptional() @IsString()
  customerPhone?: string;
}
