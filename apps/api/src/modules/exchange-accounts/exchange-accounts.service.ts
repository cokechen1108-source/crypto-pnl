import { Injectable, NotFoundException } from '@nestjs/common';
import { ExchangeAccount, ExchangeName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { CreateAccountDto } from './dto/create-account.dto';

@Injectable()
export class ExchangeAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  private normalizeCredential(value: string): string {
    // Remove invisible characters commonly introduced by copy/paste.
    return value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  }

  async createAccount(dto: CreateAccountDto): Promise<ExchangeAccount> {
    const apiKey = this.normalizeCredential(dto.apiKey);
    const apiSecret = this.normalizeCredential(dto.apiSecret);
    const apiPassphrase = dto.apiPassphrase
      ? this.normalizeCredential(dto.apiPassphrase)
      : null;
    return this.prisma.exchangeAccount.create({
      data: {
        userId: dto.userId,
        exchange: dto.exchange,
        name: dto.name,
        apiKey: {
          create: {
            encryptedKey: this.encryption.encrypt(apiKey),
            encryptedSecret: this.encryption.encrypt(apiSecret),
            encryptedPassphrase: apiPassphrase
              ? this.encryption.encrypt(apiPassphrase)
              : null,
          },
        },
      },
    });
  }

  async listAccounts(userId?: string): Promise<ExchangeAccount[]> {
    return this.prisma.exchangeAccount.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAccount(accountId: string): Promise<ExchangeAccount> {
    const account = await this.prisma.exchangeAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async updateStatus(
    accountId: string,
    isActive: boolean,
  ): Promise<ExchangeAccount> {
    await this.getAccount(accountId);
    return this.prisma.exchangeAccount.update({
      where: { id: accountId },
      data: { isActive },
    });
  }

  async deleteAccount(accountId: string): Promise<ExchangeAccount> {
    await this.getAccount(accountId);
    return this.prisma.exchangeAccount.delete({
      where: { id: accountId },
    });
  }

  async getCredentials(accountId: string): Promise<{
    exchange: ExchangeName;
    apiKey: string;
    apiSecret: string;
    apiPassphrase?: string | null;
  }> {
    const account = await this.prisma.exchangeAccount.findUnique({
      where: { id: accountId },
      include: { apiKey: true },
    });
    if (!account?.apiKey) {
      throw new NotFoundException('API key not found');
    }
    const apiKey = this.normalizeCredential(this.encryption.decrypt(account.apiKey.encryptedKey));
    const apiSecret = this.normalizeCredential(this.encryption.decrypt(account.apiKey.encryptedSecret));
    const apiPassphrase = account.apiKey.encryptedPassphrase
      ? this.normalizeCredential(this.encryption.decrypt(account.apiKey.encryptedPassphrase))
      : null;
    return {
      exchange: account.exchange,
      apiKey,
      apiSecret,
      apiPassphrase,
    };
  }
}
