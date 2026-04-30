import { IsString, IsOptional, IsDateString, IsInt, Min } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  partnerId: string;

  @IsString()
  plan: string; // pro | business | enterprise

  @IsString()
  @IsOptional()
  billing?: string; // mensuel | annuel

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RecordPaymentDto {
  @IsString()
  subscriptionId: string;

  @IsInt()
  @Min(0)
  amount: number; // FCFA

  @IsString()
  method: string; // wave | orange_money | autre

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ConfirmPaymentDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReportPaymentDto {
  @IsString()
  partnerId: string;

  @IsString()
  plan: string;

  @IsString()
  method: string; // wave | orange_money

  @IsString()
  @IsOptional()
  reference?: string; // numéro de transaction

  @IsString()
  @IsOptional()
  billing?: string;
}
