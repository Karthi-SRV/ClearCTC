import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const adminToken = this.config.get<string>('ADMIN_TOKEN');
    if (!adminToken) return false;
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.headers['x-admin-token'] === adminToken;
  }
}
