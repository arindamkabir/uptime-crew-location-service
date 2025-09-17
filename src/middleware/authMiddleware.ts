import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { Socket } from "socket.io";
import logger from "../utils/logger";

class AuthMiddleware {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || "your_jwt_secret_here";
  }

  // HTTP authentication middleware
  authenticate(
    req: Request,
    res: Response,
    next: NextFunction
  ): void | Response {
    try {
      const token = this.extractToken(req);

      if (!token) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "No authentication token provided",
        });
      }

      const decoded = jwt.verify(token, this.jwtSecret) as any;

      if (!decoded || !decoded.user_id) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Invalid or expired token",
        });
      }

      // Add user info to request
      (req as any).user = {
        id: decoded.user_id,
        name: decoded.name || "Unknown User",
        roles: decoded.roles || [],
      };

      next();
    } catch (error) {
      logger.error("Authentication error:", error);
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication failed",
      });
    }
  }

  // Socket authentication middleware
  socketAuth(socket: Socket, next: (err?: Error) => void): void {
    try {
      // Debug logging
      logger.info("Socket handshake auth data:", {
        auth: socket.handshake.auth,
        headers: socket.handshake.headers,
        socketId: socket.id,
      });

      const userData = socket.handshake.auth?.userData;

      if (!userData || !userData.id) {
        logger.warn("Socket authentication failed: No user data provided", {
          auth: socket.handshake.auth,
          userData: userData,
        });
        return next(new Error("User data required"));
      }

      // Add user info to socket
      (socket as any).user = {
        id: userData.id,
        name: userData.fname + " " + userData.lname,
        email: userData.email,
        user_type: userData.user_type,
        roles: [userData.user_type],
      };

      logger.info("Socket authentication successful:", {
        userId: userData.id,
        userName: userData.fname + " " + userData.lname,
        userEmail: userData.email,
        userType: userData.user_type,
        socketId: socket.id,
      });

      next();
    } catch (error) {
      logger.error("Socket authentication error:", error);
      next(new Error("Authentication failed"));
    }
  }

  // Extract token from request headers
  extractToken(req: Request): string | null {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      return req.headers.authorization.substring(7);
    }
    return (
      (req.headers.authorization as string) ||
      (req.headers["x-access-token"] as string) ||
      (req.query.token as string) ||
      null
    );
  }

  // Optional authentication (for public endpoints)
  optionalAuth(req: Request, res: Response, next: NextFunction): void {
    try {
      const token = this.extractToken(req);

      if (token) {
        const decoded = jwt.verify(token, this.jwtSecret) as any;
        if (decoded && decoded.user_id) {
          (req as any).user = {
            id: decoded.user_id,
            name: decoded.name || "Unknown User",
            roles: decoded.roles || [],
          };
        }
      }

      next();
    } catch (error) {
      // Continue without authentication
      next();
    }
  }

  // Role-based access control
  requireRole(role: string) {
    return (
      req: Request,
      res: Response,
      next: NextFunction
    ): void | Response => {
      if (!(req as any).user) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      if (!(req as any).user.roles || !(req as any).user.roles.includes(role)) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Insufficient permissions",
        });
      }

      next();
    };
  }
}

export default new AuthMiddleware();
