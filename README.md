# Location Socket Service

A simplified real-time location sharing and geofencing microservice built with Node.js, TypeScript, and Socket.IO.

## 🎯 **Features**

### Real-time Location Sharing

- **WebSocket-based communication** for instant location updates
- **Location history tracking** with configurable retention
- **Nearby user detection** with distance calculations
- **Bulk location updates** for mobile apps

### Simplified Geofencing

- **Fixed 250m radius** for all geofences
- **Real-time geofence monitoring** with entry/exit detection
- **User-based geofence management**
- **Geofence event logging** and statistics

### Security & Performance

- **JWT-based authentication**
- **In-memory rate limiting** to prevent abuse
- **TypeScript** for type safety and better development experience
- **Structured logging** with Winston

## 🏗️ **Architecture**

```
src/
├── types/           # TypeScript interfaces
├── services/        # Business logic
│   ├── locationService.ts      # Location management
│   └── geofencingService.ts    # Geofencing logic
├── routes/          # HTTP API endpoints
│   ├── locationRoutes.ts       # Location API
│   └── geofenceRoutes.ts       # Geofence API
├── socket/          # WebSocket handling
│   └── socketHandler.ts         # Socket event handlers
├── middleware/      # Express middleware
│   ├── authMiddleware.ts        # JWT authentication
│   └── rateLimiter.ts           # Rate limiting
├── utils/           # Utilities
│   └── logger.ts                # Logging configuration
└── server.ts        # Main application
```

## 🚀 **Quick Start**

### Prerequisites

- Node.js 18+
- npm or yarn

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the environment template and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# JWT Configuration
JWT_SECRET=your_jwt_secret_here

# Geofencing Configuration
GEOFENCING_ENABLED=true
GEOFENCING_CHECK_INTERVAL=5000

# Socket.IO Configuration
SOCKET_CORS_ORIGIN=http://localhost:3000
SOCKET_PING_TIMEOUT=60000
SOCKET_PING_INTERVAL=25000

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_BLOCK_DURATION=3600000
```

### 3. Build and Start

```bash
# Build TypeScript
npm run build

# Start the service
npm start

# Development mode
npm run dev
```

## 📡 **API Endpoints**

### Authentication

All API endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Location Endpoints

#### Get User Location

```http
GET /api/locations/me
```

#### Update User Location

```http
POST /api/locations/me
Content-Type: application/json

{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "accuracy": 10,
  "speed": 5.5,
  "heading": 90
}
```

#### Get Location History

```http
GET /api/locations/me/history?limit=50
```

#### Get Nearby Users

```http
GET /api/locations/nearby?latitude=40.7128&longitude=-74.0060&radius=1000
```

#### Bulk Location Update

```http
POST /api/locations/bulk
Content-Type: application/json

{
  "locations": [
    {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### Geofence Endpoints

#### Create Geofence

```http
POST /api/geofences
Content-Type: application/json

{
  "name": "Downtown Area",
  "description": "Central business district",
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

#### Get User Geofences

```http
GET /api/geofences
```

#### Update Geofence

```http
PUT /api/geofences/:geofenceId
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description"
}
```

#### Delete Geofence

```http
DELETE /api/geofences/:geofenceId
```

#### Toggle Geofence Status

```http
PATCH /api/geofences/:geofenceId/toggle
```

#### Get Geofence Events

```http
GET /api/geofences/:geofenceId/events?limit=50&type=entry
```

## 🔌 **WebSocket Events**

### Client to Server

#### Update Location

```javascript
socket.emit("update_location", {
  latitude: 40.7128,
  longitude: -74.006,
  accuracy: 10,
  speed: 5.5,
  heading: 90,
});
```

#### Create Geofence

```javascript
socket.emit("create_geofence", {
  name: "New Area",
  description: "Description",
  latitude: 40.7128,
  longitude: -74.006,
});
```

#### Get User Geofences

```javascript
socket.emit("get_my_geofences");
```

#### Get Geofence Events

```javascript
socket.emit("get_geofence_events", "geofence_id");
```

### Server to Client

#### Connection Confirmation

```javascript
socket.on("connected", (data) => {
  console.log("Connected:", data.message);
  console.log("User:", data.user);
});
```

#### Location Updated

```javascript
socket.on("location_updated", (data) => {
  console.log("Location updated:", data.message);
});
```

#### Geofence Events

```javascript
socket.on("geofence_events", (data) => {
  console.log("Geofence events:", data);
});
```

#### Geofence Created

```javascript
socket.on("geofence_created", (data) => {
  console.log("Geofence created:", data.name);
});
```

## ⚙️ **Configuration**

### Environment Variables

| Variable                    | Description                  | Default                 |
| --------------------------- | ---------------------------- | ----------------------- |
| `NODE_ENV`                  | Environment mode             | `development`           |
| `PORT`                      | Service port                 | `3001`                  |
| `JWT_SECRET`                | JWT signing secret           | `your_jwt_secret_here`  |
| `GEOFENCING_ENABLED`        | Enable geofencing            | `true`                  |
| `GEOFENCING_CHECK_INTERVAL` | Geofence check interval (ms) | `5000`                  |
| `SOCKET_CORS_ORIGIN`        | Socket.IO CORS origin        | `http://localhost:3000` |
| `LOG_LEVEL`                 | Logging level                | `info`                  |

### Rate Limiting

- **Window**: 15 minutes
- **Max Requests**: 100 per window
- **Block Duration**: 1 hour

### Geofencing

- **Fixed Radius**: 250 meters for all geofences
- **Check Interval**: 5 seconds (configurable)
- **Event Types**: entry, exit, location_update

## 🧪 **Testing**

### Run Tests

```bash
npm test
```

### Test Coverage

```bash
npm run test:coverage
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## 🔧 **Development**

### Project Structure

```
src/
├── types/           # TypeScript interfaces
├── services/        # Business logic
├── routes/          # HTTP API endpoints
├── socket/          # WebSocket handling
├── middleware/      # Express middleware
├── utils/           # Utilities
└── server.ts        # Main application
```

### Adding New Features

1. **Service Layer**: Add business logic in `src/services/`
2. **API Routes**: Add HTTP endpoints in `src/routes/`
3. **Socket Events**: Add WebSocket handlers in `src/socket/`
4. **Types**: Update interfaces in `src/types/`

### Code Style

- **ESLint** configuration for consistent code style
- **TypeScript** for type safety
- **Prettier** for code formatting

## 🚨 **Troubleshooting**

### Common Issues

#### TypeScript Build Errors

```bash
# Clean and rebuild
rm -rf dist/
npm run build
```

#### Authentication Errors

- Verify JWT secret in `.env`
- Check token format and expiration
- Ensure proper Authorization header

#### Socket Connection Issues

- Check CORS configuration
- Verify authentication token
- Check network connectivity

#### Performance Issues

- Monitor memory usage
- Check rate limiting settings
- Review logging levels

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev
```

## 📝 **License**

This project is licensed under the MIT License.

## 🤝 **Contributing**

For support and questions:

- **Issues**: Create a GitHub issue
- **Documentation**: Check this README and inline code comments

## 📋 **Changelog**

### Version 2.0.0

- Converted to TypeScript
- Removed crew functionality
- Removed Redis dependency
- Fixed 250m geofence radius
- Simplified architecture

### Version 1.0.0

- Initial release
- Real-time location sharing
- Basic geofencing

**Built with ❤️ for real-time location tracking and geofencing**
