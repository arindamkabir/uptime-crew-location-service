# Location Tracking System Testing Guide

## Prerequisites

### 1. Install Dependencies

**Frontend Dependencies:**

```bash
cd uptime-crew-app-frontend
npm install socket.io-client @vis.gl/react-google-maps
```

**Node.js Service Dependencies:**

```bash
cd uptime-crew-location-service
npm install  # Should already be installed
```

### 2. Environment Variables

**Frontend (.env.local):**

```env
NEXT_PUBLIC_LOCATION_SERVICE_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_MAP_API_KEY=your_google_maps_api_key_here
NEXT_PUBLIC_PUSHER_APP_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_APP_CLUSTER=your_pusher_cluster
```

**Node.js Service (.env):**

```env
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
SOCKET_CORS_ORIGIN=http://localhost:3000
GEOFENCING_ENABLED=true
GEOFENCING_CHECK_INTERVAL=1000
```

## Testing Steps

### Phase 1: Node.js Service Testing

#### 1.1 Start the Location Service

```bash
cd uptime-crew-location-service
npm run dev
# or
node dist/server.js
```

#### 1.2 Test Health Endpoint

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "Location Socket Service",
  "version": "1.0.0"
}
```

#### 1.3 Test Location API (with authentication)

```bash
# Test location update
curl -X POST http://localhost:3001/api/locations/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10
  }'
```

#### 1.4 Test Geofence API

```bash
# Create geofence
curl -X POST http://localhost:3001/api/geofences/service-request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "serviceRequestId": "test-sr-123",
    "customerLocation": {
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  }'
```

### Phase 2: Frontend Testing

#### 2.1 Start Frontend Development Server

```bash
cd uptime-crew-app-frontend
npm run dev
```

#### 2.2 Test Location Tracking Hook

Create a test component to verify location tracking:

```tsx
// TestLocationTracking.tsx
import React from "react";
import useLocationTracking from "@/lib/hooks/api/useLocationTracking";

const TestLocationTracking = () => {
  const {
    location,
    error,
    isTracking,
    isConnected,
    geofenceEvents,
    startTracking,
    stopTracking,
    isSupported,
  } = useLocationTracking();

  return (
    <div className="p-4">
      <h2>Location Tracking Test</h2>

      <div className="space-y-2">
        <p>Supported: {isSupported ? "Yes" : "No"}</p>
        <p>Connected: {isConnected ? "Yes" : "No"}</p>
        <p>Tracking: {isTracking ? "Yes" : "No"}</p>
        {error && <p className="text-red-500">Error: {error}</p>}
      </div>

      {location && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h3>Current Location</h3>
          <p>Lat: {location.latitude}</p>
          <p>Lng: {location.longitude}</p>
          <p>Accuracy: {location.accuracy}m</p>
          <p>
            Speed: {location.speed ? Math.round(location.speed * 3.6) : "N/A"}{" "}
            km/h
          </p>
        </div>
      )}

      <div className="mt-4 space-x-2">
        <button
          onClick={startTracking}
          className="px-4 py-2 bg-blue-500 text-white rounded"
          disabled={isTracking}
        >
          Start Tracking
        </button>
        <button
          onClick={stopTracking}
          className="px-4 py-2 bg-red-500 text-white rounded"
          disabled={!isTracking}
        >
          Stop Tracking
        </button>
      </div>

      {geofenceEvents.length > 0 && (
        <div className="mt-4">
          <h3>Geofence Events ({geofenceEvents.length})</h3>
          <div className="space-y-1">
            {geofenceEvents.slice(-5).map((event, index) => (
              <div key={index} className="text-sm p-2 bg-yellow-100 rounded">
                {event.type} - {event.geofence_name} at{" "}
                {new Date(event.timestamp).toLocaleTimeString()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestLocationTracking;
```

#### 2.3 Test Location Tracker Component

```tsx
// TestLocationTracker.tsx
import React from "react";
import LocationTracker from "@/Components/Organisms/LocationTracking/LocationTracker";
import GeofenceStatus from "@/Components/Organisms/LocationTracking/GeofenceStatus";

const TestLocationTracker = () => {
  // Test coordinates (New York City)
  const testCustomerLocation = {
    lat: 40.7128,
    lng: -74.006,
  };

  return (
    <div className="space-y-4">
      <h2>Location Tracker Test</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LocationTracker
          serviceRequestId="test-sr-123"
          customerLocation={testCustomerLocation}
          showGeofence={true}
          geofenceRadius={50}
          height="400px"
        />

        <GeofenceStatus
          serviceRequestId="test-sr-123"
          customerLocation={testCustomerLocation}
        />
      </div>
    </div>
  );
};

export default TestLocationTracker;
```

### Phase 3: Socket.IO Testing

#### 3.1 Test Socket Connection

Add this to your test component:

```tsx
import useLocationSocket from "@/lib/hooks/api/useLocationSocket";

const TestSocketConnection = () => {
  const { socket, isConnected, error } = useLocationSocket();

  return (
    <div className="p-4">
      <h3>Socket Connection Test</h3>
      <p>Connected: {isConnected ? "Yes" : "No"}</p>
      {error && <p className="text-red-500">Error: {error}</p>}
      {socket && (
        <div>
          <p>Socket ID: {socket.id}</p>
          <p>Transport: {socket.io.engine.transport.name}</p>
        </div>
      )}
    </div>
  );
};
```

### Phase 4: Geofencing Testing

#### 4.1 Test Geofence Creation

1. Open browser developer tools
2. Navigate to a page with location tracking
3. Check console for geofence creation logs
4. Verify geofence appears on map

#### 4.2 Test Geofence Events

1. Move your device/change location in browser
2. Watch for geofence entry/exit events in console
3. Verify events appear in the UI

### Phase 5: Integration Testing

#### 5.1 Full Flow Test

1. **Start as Technician:**

   - Login as technician
   - Accept a service request
   - Verify location tracking starts automatically
   - Check geofence is created around customer location

2. **Test Real-time Updates:**

   - Open two browser windows (technician + customer)
   - Move technician location
   - Verify customer sees technician movement
   - Test geofence entry/exit notifications

3. **Test Error Handling:**
   - Disable location permissions
   - Disconnect from internet
   - Test with invalid coordinates

## Debugging Tips

### Console Logs to Watch For:

```javascript
// Location tracking
"Location update confirmed: {data}";
"Geofence events received: [events]";
"Connected to location service";

// Errors
"Location tracking error: [error]";
"Socket not connected, cannot send location update";
"Connection failed: [error]";
```

### Common Issues:

1. **CORS Errors:**

   - Check SOCKET_CORS_ORIGIN in Node.js service
   - Verify frontend URL matches

2. **Authentication Errors:**

   - Ensure auth token is properly set
   - Check token format and expiration

3. **Location Permission Denied:**

   - Test on HTTPS (required for geolocation)
   - Check browser permissions

4. **Socket Connection Failed:**
   - Verify Node.js service is running
   - Check firewall/network settings

## Performance Testing

### Load Testing:

```bash
# Test with multiple concurrent connections
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/locations/me \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"latitude": 40.7128, "longitude": -74.0060}' &
done
```

### Memory Usage:

- Monitor Node.js service memory usage
- Check for memory leaks in location history
- Verify cleanup of old geofence events

## Production Testing Checklist

- [ ] HTTPS enabled for geolocation
- [ ] Environment variables configured
- [ ] Database connections working
- [ ] Socket.IO scaling properly
- [ ] Error handling working
- [ ] Location accuracy acceptable
- [ ] Geofence calculations correct
- [ ] Real-time updates working
- [ ] UI responsive and user-friendly
- [ ] Performance acceptable under load
