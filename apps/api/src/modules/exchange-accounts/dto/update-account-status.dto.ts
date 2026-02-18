import { IsBoolean } from 'class-validator';

export class UpdateAccountStatusDto {
  @IsBoolean()
  isActive: boolean;
}
