import { IsOptional, IsString } from 'class-validator';

export class UpdateBusinessListingStatusDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
