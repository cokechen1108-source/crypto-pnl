import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class TradeListQueryDto {
  @IsString()
  accountId: string;

  @IsOptional()
  @IsString()
  symbol?: string;

  /** 按日期筛选：yyyy-MM-dd，返回该日有入场或出场的交易 */
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  pageSize?: number = 200;
}
