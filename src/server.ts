import express from "express";
import http from "http";
import socketIo from "socket.io";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";

import logger from "./utils/logger";
import socketHandler from "./socket/socketHandler";
import geofencingService from "./services/geofencingService";
import locationService from "./services/locationService";
import authMiddleware from "./middleware/authMiddleware";
import rateLimiter from "./middleware/rateLimiter";

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new socketIo.Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT || "60000"),
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL || "25000"),
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN ||
      process.env.SOCKET_CORS_ORIGIN ||
      "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-API-Key",
    ],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
app.use(rateLimiter.middleware);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Location Socket Service",
    version: "1.0.0",
  });
});

// API endpoints
import locationRoutes from "./routes/locationRoutes";
import geofenceRoutes from "./routes/geofenceRoutes";

app.use("/api/locations", authMiddleware.authenticate, locationRoutes);
app.use("/api/geofences", authMiddleware.authenticate, geofenceRoutes);

// Socket connection handling
io.use(authMiddleware.socketAuth);
io.use(rateLimiter.socketMiddleware);

io.on("connection", (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  // Type assertion after authentication middleware has run
  socketHandler.handleConnection(socket as any, io);
});

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong",
    });
  }
);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "The requested resource was not found",
  });
});

const PORT = parseInt(process.env.PORT || "3001");
const HOST = process.env.HOST || "0.0.0.0";

// Start server
server.listen(PORT, HOST, () => {
  logger.info(`Location Socket Service running on ${HOST}:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);

  // Initialize services
  geofencingService.initialize();
  locationService.initialize();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

export { app, server, io };
