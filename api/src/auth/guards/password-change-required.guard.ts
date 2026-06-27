import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

@Injectable()
export class PasswordChangeRequiredGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();

    if (request.user?.mustChangePassword) {
      throw new ForbiddenException('Password change required');
    }

    return true;
  }
}
