import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import {
  CreateUserInput,
  UserRecord,
  UsersRepository,
} from './users.repository';

@Injectable()
export class PostgresUsersRepository extends UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {
    super();
  }

  count(): Promise<number> {
    return this.repo.count();
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.repo.findOneBy({ email });
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.repo.findOneBy({ id });
  }

  create(input: CreateUserInput): Promise<UserRecord> {
    const user = this.repo.create({
      email: input.email,
      passwordHash: input.passwordHash,
      mustChangePassword: input.mustChangePassword ?? true,
      role: input.role ?? 'admin',
    });

    return this.repo.save(user);
  }

  async updatePassword(
    id: string,
    passwordHash: string,
  ): Promise<UserRecord | null> {
    const user = await this.repo.findOneBy({ id });
    if (!user) {
      return null;
    }

    user.passwordHash = passwordHash;
    user.mustChangePassword = false;
    return this.repo.save(user);
  }

  findAll(): Promise<UserRecord[]> {
    return this.repo.find();
  }

  async insert(record: UserRecord): Promise<void> {
    await this.repo.save({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      mustChangePassword: record.mustChangePassword,
      role: record.role,
    });
  }

  async clear(): Promise<void> {
    await this.repo.createQueryBuilder().delete().execute();
  }
}
