module.exports = {
  apps: [
    {
      name: "uptime-location-service",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        HOST: "0.0.0.0",
        LOG_LEVEL: "info",
        JWT_SECRET: process.env.JWT_SECRET || "your_jwt_secret_here",
        API_KEY_HEADER: "X-API-Key",
        LARAVEL_API_URL:
          process.env.LARAVEL_API_URL || "https://api.uptimecrew.lol",
        LARAVEL_API_KEY: process.env.LARAVEL_API_KEY || "",
        GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "",
        GEOFENCING_ENABLED: "true",
        GEOFENCING_CHECK_INTERVAL: "5000",
        DEFAULT_GEOFENCE_RADIUS: "1000",
        SOCKET_CORS_ORIGIN:
          process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000",
        SOCKET_PING_TIMEOUT: "60000",
        SOCKET_PING_INTERVAL: "25000",
        RATE_LIMIT_WINDOW_MS: "900000",
        RATE_LIMIT_MAX_REQUESTS: "100",
      },

      // ✅ Redirect PM2 logs to stdout/stderr for Docker
      log_file: "/dev/stdout",
      out_file: "/dev/stdout",
      error_file: "/dev/stderr",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      max_memory_restart: "1G",
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: "10s",
      watch: false,
      ignore_watch: ["node_modules", "logs", "dist"],
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      autorestart: true,
      source_map_support: true,
    },
  ],
};
