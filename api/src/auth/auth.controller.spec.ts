import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { login: jest.fn() } }],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  it('login delegates to AuthService and returns the result', () => {
    authService.login.mockReturnValue({ accessToken: 'token' });
    const result = controller.login({ email: 'admin@shop.com', password: 'secret' });
    expect(authService.login).toHaveBeenCalledWith({ email: 'admin@shop.com', password: 'secret' });
    expect(result).toEqual({ accessToken: 'token' });
  });
});
