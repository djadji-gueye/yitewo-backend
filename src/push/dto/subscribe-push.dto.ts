import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

class PushKeysDto {
  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}

export class SubscribePushDto {
  // Présent quand l'abonné est un Partner (partner-portal / prestataire-portal)
  @IsOptional()
  @IsString()
  token?: string;

  @IsString()
  endpoint: string;

  @IsObject()
  keys: PushKeysDto;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class UnsubscribePushDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsString()
  endpoint: string;
}

export class TestPushDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;
}
