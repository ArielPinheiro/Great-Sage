/**
 * Simple in-memory rate limiter.
 * Max 20 requests per IP per 60-second sliding window.
 */

import type { Request, Response, NextFunction } from 'express';

interface RateBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateBucket>();

const MAX_REQUESTS = 20;
const WINDOW_MS = 60_000; // 1 minute
const CLEANUP_INTERVAL_MS = 5 * 60_000; // Clean stale entries every 5 minutes

// Periodic cleanup of stale buckets
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
    if (bucket.timestamps.length === 0) {
      buckets.delete(ip);
    }
  }
}, CLEANUP_INTERVAL_MS);

export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';

  const now = Date.now();

  if (!buckets.has(ip)) {
    buckets.set(ip, { timestamps: [] });
  }

  const bucket = buckets.get(ip)!;

  // Prune timestamps outside the window
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);

  if (bucket.timestamps.length >= MAX_REQUESTS) {
    const oldestValid = bucket.timestamps[0];
    const retryAfter = Math.ceil((oldestValid + WINDOW_MS - now) / 1000);

    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Limite de requisicoes excedido. Aguarde um momento.',
    });
    return;
  }

  bucket.timestamps.push(now);
  next();
}
