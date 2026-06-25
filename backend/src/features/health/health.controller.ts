import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from '../../shared/decorators/public.decorator.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly db: Connection) {}

  @Get()
  getHealth(): { status: string; db: string } {
    return {
      status: 'ok',
      db: this.db.readyState === 1 ? 'connected' : 'disconnected',
    };
  }
}
