import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthPayload } from '../../features/auth/auth.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthPayload }>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing Bearer token');

    try {
      request.user = this.jwt.verify<AuthPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  private extractToken(req: Request): string | null {
    const auth = req.headers.authorization ?? '';
    const [type, token] = auth.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
