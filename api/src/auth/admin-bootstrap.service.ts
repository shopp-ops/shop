import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '../users/repositories/users.repository';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const existing = await this.users.count();
    if (existing > 0) {
      return;
    }

    const email = this.config.getOrThrow<string>('ADMIN_EMAIL');
    const password = this.config.getOrThrow<string>('ADMIN_PASSWORD');
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await this.users.create({
      email,
      passwordHash,
      mustChangePassword: true,
      role: 'admin',
    });

    this.logger.log(`Bootstrapped admin user ${email}`);
  }
}
