import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const vals: Record<string, string> = {
                ADMIN_EMAIL: 'admin@shop.com',
                ADMIN_PASSWORD: 'secret',
                JWT_SECRET: 'test-secret',
              };
              return vals[key];
            },
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
  });

  it('returns accessToken for valid credentials', () => {
    const result = service.login({
      email: 'admin@shop.com',
      password: 'secret',
    });
    expect(result).toEqual({ accessToken: 'signed-token' });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'admin',
      role: 'admin',
    });
  });

  it('throws UnauthorizedException for wrong password', () => {
    expect(() =>
      service.login({ email: 'admin@shop.com', password: 'wrong' }),
    ).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for wrong email', () => {
    expect(() =>
      service.login({ email: 'other@shop.com', password: 'secret' }),
    ).toThrow(UnauthorizedException);
  });
});
