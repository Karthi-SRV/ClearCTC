import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import LokiTransport from 'winston-loki';

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, context, trace }) => {
    const ctx = context ? `[${context}] ` : '';
    const stack = trace ? `\n${trace}` : '';
    return `${timestamp} ${ctx}${level}: ${message}${stack}`;
  }),
);

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const transports: winston.transport[] = [
          new winston.transports.Console({ format: consoleFormat }),
        ];

        const lokiUrl = config.get<string>('LOKI_URL');
        if (lokiUrl) {
          transports.push(
            new LokiTransport({
              host: lokiUrl,
              labels: {
                app: 'clearctc',
                env: config.get<string>('NODE_ENV', 'development'),
              },
              format: winston.format.json(),
              gracefulShutdown: true,
              onConnectionError: (err: Error) =>
                console.error('Loki transport error', err.message),
            }),
          );
        }

        return { transports };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
