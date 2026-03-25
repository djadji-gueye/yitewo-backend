import { IsString, IsOptional } from 'class-validator';

export class CreateInterestDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsOptional() @IsString()
  message?: string;
}
