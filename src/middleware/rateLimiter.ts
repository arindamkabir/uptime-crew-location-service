import { Request, Response, NextFunction } from "express";
import { Socket } from "socket.io";
import logger from "../utils/logger";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private windowMs: number;
  private maxRequests: number;
  private blockDuration: number;

  constructor() {
    this.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"); // 15 minutes
    this.maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100");
    this.blockDuration = parseInt(
      process.env.RATE_LIMIT_BLOCK_DURATION || "3600000"
    ); // 1 hour
  }

  // Generate key for rate limiting
  private generateKey(req: Request): string {
    return (req as any).user ? `user:${(req as any).user.id}` : `ip:${req.ip}`;
  }

  // Check if request is within rate limit
  private checkLimit(key: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetTime) {
      // Reset or create new entry
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs,
      };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    // Increment count
    entry.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  // Clean up old entries
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime + this.blockDuration) {
        this.limits.delete(key);
      }
    }
  }

  // HTTP rate limiter middleware
  middleware(req: Request, res: Response, next: NextFunction): void | Response {
    try {
      const key = this.generateKey(req);
      const result = this.checkLimit(key);

      if (!result.allowed) {
        const retryAfter = Math.round((result.resetTime - Date.now()) / 1000);

        res.set("Retry-After", retryAfter.toString());
        res.set("X-RateLimit-Limit", this.maxRequests.toString());
        res.set("X-RateLimit-Remaining", "0");
        res.set("X-RateLimit-Reset", new Date(result.resetTime).toISOString());

        logger.warn(`Rate limit exceeded for ${req.ip}`);

        return res.status(429).json({
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: retryAfter,
        });
      }

      // Set rate limit headers
      res.set("X-RateLimit-Limit", this.maxRequests.toString());
      res.set("X-RateLimit-Remaining", result.remaining.toString());
      res.set("X-RateLimit-Reset", new Date(result.resetTime).toISOString());

      next();
    } catch (error) {
      logger.error("Rate limiter error:", error);
      next();
    }
  }

  // Socket rate limiter middleware
  socketMiddleware(socket: Socket, next: (err?: Error) => void): void {
    try {
      const key = `socket:${
        (socket as any).user ? (socket as any).user.id : socket.id
      }`;
      const result = this.checkLimit(key);

      if (!result.allowed) {
        logger.warn(`Socket rate limit exceeded for ${socket.id}`);
        return next(new Error("Rate limit exceeded. Please try again later."));
      }

      next();
    } catch (error) {
      logger.error("Socket rate limiter error:", error);
      next();
    }
  }

  // Start cleanup interval
  startCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }
}

// Create instance and start cleanup
const rateLimiter = new RateLimiter();
rateLimiter.startCleanup();

// Bind the middleware method to the instance
const boundMiddleware = rateLimiter.middleware.bind(rateLimiter);
const boundSocketMiddleware = rateLimiter.socketMiddleware.bind(rateLimiter);

export default {
  middleware: boundMiddleware,
  socketMiddleware: boundSocketMiddleware,
};
