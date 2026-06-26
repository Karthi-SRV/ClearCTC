import * as net from 'net';
import { execSync } from 'child_process';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { collectDefaultMetrics, register } from 'prom-client';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module.js';
import { AiExceptionFilter } from './shared/filters/ai-exception.filter.js';
import { CompanyAiProfileService } from './core/data/company-ai-profile.service.js';

collectDefaultMetrics({ prefix: 'comp_copilot_' });

// Monitor parent process — exit immediately if nest --watch (our parent) dies
if (process.pid && process.ppid) {
  const ppidCheck = setInterval(() => {
    try {
      if (process.ppid === 1) {
        clearInterval(ppidCheck);
        process.exit(0);
      }
    } catch {
      clearInterval(ppidCheck);
      process.exit(0);
    }
  }, 1000);
  ppidCheck.unref();
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port);
  });
}

async function waitForPort(port: number, maxWaitMs = 8000): Promise<void> {
  const start = Date.now();
  let delay = 100;
  while (Date.now() - start < maxWaitMs) {
    if (await isPortFree(port)) return;
    console.log(`[bootstrap] Port ${port} busy — waiting ${delay}ms...`);
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 1000);
  }
  console.error(
    `[bootstrap] Port ${port} still busy after ${maxWaitMs / 1000}s. Exiting.`,
  );
  process.exit(1);
}

/**
 * Kill any process actively LISTENING on the port.
 * -sTCP:LISTEN ensures Docker/browser ESTABLISHED connections are not touched.
 */
function killPortListeners(port: number): void {
  if (process.env.NODE_ENV === 'production') return;
  if (process.platform !== 'darwin' && process.platform !== 'linux') return;
  try {
    const stdout = execSync(`lsof -t -i:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
    });
    const pids = stdout
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p && Number(p) !== process.pid);
    if (pids.length > 0) {
      console.log(
        `[bootstrap] Killing stale listener(s) on port ${port}: PID ${pids.join(', ')}`,
      );
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`);
        } catch {}
      }
    }
  } catch {
    // lsof exits non-zero when no match found — that's fine
  }
}

/**
 * Immediately exit to free the port.
 * nest --watch sends SIGTERM to the child process before spawning a new one.
 * We call closeAllConnections() first so the OS can reclaim the socket faster.
 */
function forceExit(server: net.Server, signal: string): void {
  console.log(
    `[bootstrap] Received ${signal}. Exiting to free port ${process.env.PORT ?? 3000}...`,
  );
  try {
    if (typeof (server as any).closeAllConnections === 'function') {
      (server as any).closeAllConnections();
    }
  } catch {}
  process.exit(0);
}

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3000);

  // ── Initialize NestJS ─────────────────────────────────────────────────────
  const app = await NestFactory.create(AppModule, {
    cors: true,
    bufferLogs: true,
    rawBody: true, // Preserve raw body for webhook signature verification
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const server = app.getHttpServer();

  // Disable keep-alive: connections won't linger and hold the port after exit
  server.keepAliveTimeout = 0;
  server.headersTimeout = 0;

  app.enableShutdownHooks();

  // SIGTERM is sent by nest --watch on every hot-reload
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
    process.on(signal, () => forceExit(server, signal));
  }

  process.on('exit', () => {
    try {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      server.close();
    } catch {}
  });

  app.enableCors({
    origin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  // Expose prom-client registry. Runs as raw Express middleware so it bypasses
  // the global JwtAuthGuard — Prometheus scrapes unauthenticated.
  app.use('/metrics', async (_req: any, res: any) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err: any) {
      res.status(500).end(err?.message ?? 'metrics error');
    }
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AiExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Comp Copilot API')
    .setDescription('API for Salary and Offer Comparisons')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // ── Port acquisition ──────────────────────────────────────────────────────
  // Done RIGHT BEFORE app.listen (not before NestFactory.create) to minimize
  // the gap between the port-free check and the actual listen() call.
  // By the time NestJS finishes initializing (~3s), the old process has already
  // received SIGTERM and exited — so this check+kill is nearly always instant.
  killPortListeners(port);
  await waitForPort(port, 8000);

  try {
    await app.listen(port);
    console.log(`[bootstrap] Server listening on port ${port}`);
  } catch (err: any) {
    console.error(`[bootstrap] Failed to listen on port ${port}:`, err);
    process.exit(1);
  }

  // Seed company data in the background (does not block request handling)
  const companySeed = app.get(CompanyAiProfileService);
  companySeed.seedOnStartup().catch((err: Error) => {
    console.error('[bootstrap] Company seed failed:', err?.message);
  });
}
bootstrap();
