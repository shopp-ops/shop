import { NestFactory } from '@nestjs/core';
import { MongoOrdersRepository } from '../orders/repositories/mongo-orders.repository';
import { OrdersRepository } from '../orders/repositories/orders.repository';
import { PostgresOrdersRepository } from '../orders/repositories/postgres-orders.repository';
import { MongoProductsRepository } from '../products/repositories/mongo-products.repository';
import { PostgresProductsRepository } from '../products/repositories/postgres-products.repository';
import { ProductsRepository } from '../products/repositories/products.repository';
import { MongoUsersRepository } from '../users/repositories/mongo-users.repository';
import { PostgresUsersRepository } from '../users/repositories/postgres-users.repository';
import { UsersRepository } from '../users/repositories/users.repository';
import { MigrationModule } from './migration.module';

type Driver = 'postgres' | 'mongo';

const PAGE_SIZE = 100;

const parseDriver = (flag: string, value: string | undefined): Driver => {
  if (value !== 'postgres' && value !== 'mongo') {
    throw new Error(`${flag} must be "postgres" or "mongo" (got "${value}")`);
  }
  return value;
};

const getFlag = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

async function migrateProducts(
  source: ProductsRepository,
  target: ProductsRepository,
): Promise<number> {
  let page = 1;
  let migrated = 0;

  for (;;) {
    const { data } = await source.findAll({ page, limit: PAGE_SIZE });
    for (const record of data) {
      await target.insert(record);
      migrated += 1;
    }
    if (data.length < PAGE_SIZE) {
      break;
    }
    page += 1;
  }

  return migrated;
}

async function migrateOrders(
  source: OrdersRepository,
  target: OrdersRepository,
): Promise<number> {
  let page = 1;
  let migrated = 0;

  for (;;) {
    const { data } = await source.findAll({ page, limit: PAGE_SIZE });
    for (const record of data) {
      await target.insert(record);
      migrated += 1;
    }
    if (data.length < PAGE_SIZE) {
      break;
    }
    page += 1;
  }

  return migrated;
}

async function migrateUsers(
  source: UsersRepository,
  target: UsersRepository,
): Promise<number> {
  const users = await source.findAll();
  for (const record of users) {
    await target.insert(record);
  }
  return users.length;
}

async function main(): Promise<void> {
  const from = parseDriver('--from', getFlag('--from'));
  const to = parseDriver('--to', getFlag('--to'));

  if (from === to) {
    throw new Error('--from and --to must be different drivers');
  }

  const app = await NestFactory.createApplicationContext(MigrationModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const productRepos: Record<Driver, ProductsRepository> = {
      postgres: app.get(PostgresProductsRepository),
      mongo: app.get(MongoProductsRepository),
    };
    const orderRepos: Record<Driver, OrdersRepository> = {
      postgres: app.get(PostgresOrdersRepository),
      mongo: app.get(MongoOrdersRepository),
    };
    const userRepos: Record<Driver, UsersRepository> = {
      postgres: app.get(PostgresUsersRepository),
      mongo: app.get(MongoUsersRepository),
    };

    console.log(`Migrating ${from} -> ${to}`);

    // Wipe target first (order is irrelevant — no cross refs between sets).
    await orderRepos[to].clear();
    await productRepos[to].clear();
    await userRepos[to].clear();
    console.log('Cleared target collections/tables');

    const products = await migrateProducts(
      productRepos[from],
      productRepos[to],
    );
    console.log(`Migrated ${products} product(s)`);

    const orders = await migrateOrders(orderRepos[from], orderRepos[to]);
    console.log(`Migrated ${orders} order(s)`);

    const users = await migrateUsers(userRepos[from], userRepos[to]);
    console.log(`Migrated ${users} user(s)`);

    console.log('Migration complete');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
