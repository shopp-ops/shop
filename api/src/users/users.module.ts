import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isStandardDatabaseDriver } from '../database/database-driver';
import { USER_MODEL, mongoUserSchema } from './entities/mongo-user.schema';
import { User } from './entities/user.entity';
import { MongoUsersRepository } from './repositories/mongo-users.repository';
import { PostgresUsersRepository } from './repositories/postgres-users.repository';
import { UsersRepository } from './repositories/users.repository';

const useStandardDatabase = isStandardDatabaseDriver();

@Module({
  imports: useStandardDatabase
    ? [TypeOrmModule.forFeature([User])]
    : [
        MongooseModule.forFeature([
          { name: USER_MODEL, schema: mongoUserSchema },
        ]),
      ],
  providers: [
    useStandardDatabase
      ? {
          provide: UsersRepository,
          useClass: PostgresUsersRepository,
        }
      : {
          provide: UsersRepository,
          useClass: MongoUsersRepository,
        },
  ],
  exports: [UsersRepository],
})
export class UsersModule {}
