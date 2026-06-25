import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiParseError } from '../../core/ai/ai-parse.error.js';

@Catch(AiParseError)
export class AiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AiExceptionFilter.name);

  catch(exception: AiParseError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    this.logger.error(`AI parse failure: ${exception.message}`);
    res.status(HttpStatus.BAD_GATEWAY).json({
      error: 'AI response could not be parsed. Please try again.',
    });
  }
}
