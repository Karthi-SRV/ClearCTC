import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Tracks AI endpoint usage per authenticated user, not per IP.
// Falls back to IP when the request carries no JWT payload (shouldn't happen
// on JWT-guarded routes, but prevents an unhandled edge case).
@Injectable()
export class AiThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.sub ?? req.ip ?? 'anonymous';
  }

  protected async getErrorMessage(): Promise<string> {
    return 'AI rate limit exceeded: maximum 3 requests per hour. Please try again later.';
  }
}
