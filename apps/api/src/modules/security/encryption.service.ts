import { Injectable } from '@nestjs/common';
import crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const rawKey = process.env.ENCRYPTION_KEY ?? '';
    let key = Buffer.from(rawKey, 'base64');
    if (key.length !== 32) {
      if (process.env.NODE_ENV !== 'production') {
        key = crypto.createHash('sha256').update('crypto-pnl-dev-secret').digest();
        console.warn(
          '[EncryptionService] ENCRYPTION_KEY 未设置或无效，开发环境使用默认密钥。生产环境请在 .env 中设置：ENCRYPTION_KEY="$(node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))")"',
        );
      } else {
        throw new Error(
          'ENCRYPTION_KEY must be base64-encoded 32 bytes for AES-256-GCM. Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
        );
      }
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString('base64'),
      encrypted.toString('base64'),
      tag.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const [ivB64, encryptedB64, tagB64] = payload.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
