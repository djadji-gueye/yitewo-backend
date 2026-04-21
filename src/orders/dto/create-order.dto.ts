import { IsString, IsInt, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional() @IsString()
  productId?: string;

  @IsOptional() @IsString()
  partnerProductId?: string;

  @IsInt() @Min(1)
  quantity: number;

  @IsInt() @Min(0)
  unitPrice: number;
}

export class CreateOrderDto {
  @IsString()
  city: string;

  @IsString()
  quarter: string;

  @IsInt() @Min(0)
  deliveryFee: number;

  @IsInt() @Min(0)
  totalPrice: number;

  @IsOptional() @IsString()
  customerName?: string;

  @IsOptional() @IsString()
  customerPhone?: string;

  @IsOptional() @IsString()
  note?: string;

  @IsOptional() @IsString()
  partnerId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
