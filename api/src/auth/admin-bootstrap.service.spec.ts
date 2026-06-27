import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '../users/repositories/users.repository';
import { AdminBootstrapService } from './admin-bootstrap.service';

describe('AdminBootstrapService', () => {
  let service: AdminBootstrapService;
  let users: jest.Mocked<UsersRepository>;

  const config = {
    getOrThrow: (key: string) =>
      ({ ADMIN_EMAIL: 'admin@shop.com', ADMIN_PASSWORD: 'secret' })[key],
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminBootstrapService,
        { provide: ConfigService, useValue: config },
        {
          provide: UsersRepository,
          useValue: { count: jest.fn(), create: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AdminBootstrapService);
    users = module.get(UsersRepository);
  });

  it('creates the admin with a bcrypt hash and mustChangePassword when none exist', async () => {
    users.count.mockResolvedValue(0);
    await service.onApplicationBootstrap();

    expect(users.create).toHaveBeenCalledTimes(1);
    const input = users.create.mock.calls[0][0];
    expect(input.email).toBe('admin@shop.com');
    expect(input.mustChangePassword).toBe(true);
    expect(await bcrypt.compare('secret', input.passwordHash)).toBe(true);
  });

  it('does nothing when an admin already exists', async () => {
    users.count.mockResolvedValue(1);
    await service.onApplicationBootstrap();
    expect(users.create).not.toHaveBeenCalled();
  });
});
