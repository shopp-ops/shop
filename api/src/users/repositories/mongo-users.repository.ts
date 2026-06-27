import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { HydratedDocument, Model } from 'mongoose';
import { MongoUser, USER_MODEL } from '../entities/mongo-user.schema';
import {
  CreateUserInput,
  UserRecord,
  UsersRepository,
} from './users.repository';

@Injectable()
export class MongoUsersRepository extends UsersRepository {
  constructor(
    @InjectModel(USER_MODEL)
    private readonly userModel: Model<MongoUser>,
  ) {
    super();
  }

  count(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.userModel.findOne({ email }).lean().exec();
    return user ? this.toUserRecord(user) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.userModel.findById(id).lean().exec();
    return user ? this.toUserRecord(user) : null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const created = await this.userModel.create({
      _id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      mustChangePassword: input.mustChangePassword ?? true,
      role: input.role ?? 'admin',
    });

    return this.toUserRecord(created);
  }

  async updatePassword(
    id: string,
    passwordHash: string,
  ): Promise<UserRecord | null> {
    const updated = await this.userModel
      .findByIdAndUpdate(
        id,
        { passwordHash, mustChangePassword: false },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();

    return updated ? this.toUserRecord(updated) : null;
  }

  private toUserRecord(
    user:
      | HydratedDocument<MongoUser>
      | MongoUser
      | (MongoUser & { _id: string }),
  ): UserRecord {
    return {
      id: user._id,
      email: user.email,
      passwordHash: user.passwordHash,
      mustChangePassword: user.mustChangePassword,
      role: user.role,
    };
  }
}
