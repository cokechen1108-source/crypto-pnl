import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ExchangeName } from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(ExchangeName)
  exchange: ExchangeName;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsString()
  @IsNotEmpty()
  apiSecret: string;

  @IsString()
  @IsOptional()
  apiPassphrase?: string;
}
