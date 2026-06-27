import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '../users/repositories/users.repository';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let users: jest.Mocked<UsersRepository>;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('secret', 10);
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersRepository,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            updatePassword: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed-token') },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService);
    users = module.get(UsersRepository);
  });

  const adminUser = () => ({
    id: 'user-1',
    email: 'admin@shop.com',
    passwordHash,
    mustChangePassword: false,
    role: 'admin',
  });

  describe('login', () => {
    it('returns accessToken for valid credentials', async () => {
      users.findByEmail.mockResolvedValue(adminUser());
      const result = await service.login({
        email: 'admin@shop.com',
        password: 'secret',
      });
      expect(result).toEqual({ accessToken: 'signed-token' });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        role: 'admin',
      });
    });

    it('throws UnauthorizedException for wrong password', async () => {
      users.findByEmail.mockResolvedValue(adminUser());
      await expect(
        service.login({ email: 'admin@shop.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException for unknown email', async () => {
      users.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'other@shop.com', password: 'secret' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('verifies the current password, hashes the new one, and clears the flag', async () => {
      users.findById.mockResolvedValue({
        ...adminUser(),
        mustChangePassword: true,
      });
      await service.changePassword('user-1', {
        currentPassword: 'secret',
        newPassword: 'new-password',
      });

      expect(users.updatePassword).toHaveBeenCalledTimes(1);
      const [id, newHash] = users.updatePassword.mock.calls[0];
      expect(id).toBe('user-1');
      expect(await bcrypt.compare('new-password', newHash)).toBe(true);
    });

    it('throws UnauthorizedException when the current password is wrong', async () => {
      users.findById.mockResolvedValue({
        ...adminUser(),
        mustChangePassword: true,
      });
      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrong',
          newPassword: 'new-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(users.updatePassword).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the user is missing', async () => {
      users.findById.mockResolvedValue(null);
      await expect(
        service.changePassword('ghost', {
          currentPassword: 'secret',
          newPassword: 'new-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
