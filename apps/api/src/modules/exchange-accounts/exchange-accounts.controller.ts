import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ExchangeAccountsService } from './exchange-accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';

@Controller('accounts')
export class ExchangeAccountsController {
  constructor(private readonly service: ExchangeAccountsService) {}

  @Post()
  async create(@Body() dto: CreateAccountDto) {
    return this.service.createAccount(dto);
  }

  @Get()
  async list(@Query('userId') userId?: string) {
    return this.service.listAccounts(userId);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.getAccount(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAccountStatusDto,
  ) {
    return this.service.updateStatus(id, dto.isActive);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.deleteAccount(id);
  }
}
