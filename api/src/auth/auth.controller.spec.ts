import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './strategies/jwt.strategy';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: { login: jest.fn(), changePassword: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  it('login delegates to AuthService and returns the result', async () => {
    authService.login.mockResolvedValue({ accessToken: 'token' });
    const result = await controller.login({
      email: 'admin@shop.com',
      password: 'secret',
    });
    expect(authService.login).toHaveBeenCalledWith({
      email: 'admin@shop.com',
      password: 'secret',
    });
    expect(result).toEqual({ accessToken: 'token' });
  });

  it('changePassword delegates to AuthService with the user id', async () => {
    authService.changePassword.mockResolvedValue(undefined);
    const user: AuthenticatedUser = {
      userId: 'user-1',
      role: 'admin',
      mustChangePassword: true,
    };
    const dto = { currentPassword: 'old', newPassword: 'new-password' };
    await controller.changePassword({ user }, dto);
    expect(authService.changePassword).toHaveBeenCalledWith('user-1', dto);
  });
});
