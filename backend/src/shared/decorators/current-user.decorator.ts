import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthPayload } from '../../features/auth/auth.service.js';

/** Extracts the authenticated user's JWT payload from the request. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthPayload =>
    ctx.switchToHttp().getRequest<{ user: AuthPayload }>().user,
);
