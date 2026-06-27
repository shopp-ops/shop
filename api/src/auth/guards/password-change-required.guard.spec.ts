import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PasswordChangeRequiredGuard } from './password-change-required.guard';

const contextWithUser = (user: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('PasswordChangeRequiredGuard', () => {
  const guard = new PasswordChangeRequiredGuard();

  it('allows access when mustChangePassword is false', () => {
    expect(
      guard.canActivate(
        contextWithUser({ userId: 'u', role: 'admin', mustChangePassword: false }),
      ),
    ).toBe(true);
  });

  it('throws ForbiddenException when mustChangePassword is true', () => {
    expect(() =>
      guard.canActivate(
        contextWithUser({ userId: 'u', role: 'admin', mustChangePassword: true }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows access when no user is present', () => {
    expect(guard.canActivate(contextWithUser(undefined))).toBe(true);
  });
});
