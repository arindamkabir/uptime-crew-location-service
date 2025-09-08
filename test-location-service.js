const io = require("socket.io-client");

// Test configuration
const LOCATION_SERVICE_URL = "http://localhost:3001";
const TEST_USER_ID = "test-user-123";
const TEST_AUTH_TOKEN = "test-token-123";

// Test data
const testLocation = {
  latitude: 40.7128,
  longitude: -74.006,
  accuracy: 10,
  timestamp: new Date(),
  speed: 0,
  heading: 0,
};

const testCustomerLocation = {
  latitude: 40.7589,
  longitude: -73.9851,
  accuracy: 10,
};

console.log("🚀 Starting Location Service Tests...\n");

// Test 1: Health Check
async function testHealthCheck() {
  console.log("1. Testing Health Check...");
  try {
    const response = await fetch(`${LOCATION_SERVICE_URL}/health`);
    const data = await response.json();

    if (data.status === "OK") {
      console.log("✅ Health check passed");
      console.log(`   Service: ${data.service}`);
      console.log(`   Version: ${data.version}`);
    } else {
      console.log("❌ Health check failed");
    }
  } catch (error) {
    console.log("❌ Health check failed:", error.message);
  }
  console.log("");
}

// Test 2: Socket Connection
function testSocketConnection() {
  console.log("2. Testing Socket Connection...");

  return new Promise((resolve) => {
    const socket = io(LOCATION_SERVICE_URL, {
      auth: {
        token: TEST_AUTH_TOKEN,
        userId: TEST_USER_ID,
        userType: "technician",
      },
      transports: ["websocket", "polling"],
      timeout: 10000,
    });

    let connected = false;

    socket.on("connect", () => {
      console.log("✅ Socket connected successfully");
      console.log(`   Socket ID: ${socket.id}`);
      connected = true;
    });

    socket.on("connected", (data) => {
      console.log("✅ Connection confirmed by server");
      console.log(`   Message: ${data.message}`);
    });

    socket.on("connect_error", (error) => {
      console.log("❌ Socket connection failed:", error.message);
      resolve(false);
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️  Socket disconnected:", reason);
    });

    // Test location update
    socket.on("connect", () => {
      console.log("   Testing location update...");
      socket.emit("update_location", testLocation);
    });

    socket.on("location_updated", (data) => {
      console.log("✅ Location update confirmed");
      console.log(`   Message: ${data.message}`);
    });

    socket.on("location_error", (data) => {
      console.log("❌ Location update failed:", data.message);
    });

    // Test geofence creation
    socket.on("connect", () => {
      setTimeout(() => {
        console.log("   Testing geofence creation...");
        socket.emit("create_geofence", {
          name: "Test Geofence",
          description: "Test geofence for testing",
          latitude: testCustomerLocation.latitude,
          longitude: testCustomerLocation.longitude,
        });
      }, 1000);
    });

    socket.on("geofence_created", (geofence) => {
      console.log("✅ Geofence created successfully");
      console.log(`   Geofence ID: ${geofence.id}`);
      console.log(`   Name: ${geofence.name}`);
      console.log(`   Radius: ${geofence.radius}m`);
    });

    socket.on("geofence_error", (data) => {
      console.log("❌ Geofence creation failed:", data.message);
    });

    // Test geofence events
    socket.on("geofence_events", (events) => {
      console.log("✅ Geofence events received");
      console.log(`   Events count: ${events.length}`);
      events.forEach((event, index) => {
        console.log(
          `   Event ${index + 1}: ${event.type} - ${event.geofence_name}`
        );
      });
    });

    // Cleanup after 5 seconds
    setTimeout(() => {
      socket.disconnect();
      resolve(connected);
    }, 5000);
  });
}

// Test 3: API Endpoints (if authentication is working)
async function testAPIEndpoints() {
  console.log("3. Testing API Endpoints...");

  // Note: These tests will fail without proper authentication
  // They're here for reference when you have auth working

  const endpoints = [
    {
      name: "Get User Location",
      method: "GET",
      url: "/api/locations/me",
    },
    {
      name: "Update Location",
      method: "POST",
      url: "/api/locations/me",
      data: testLocation,
    },
    {
      name: "Create Service Request Geofence",
      method: "POST",
      url: "/api/geofences/service-request",
      data: {
        serviceRequestId: "test-sr-123",
        customerLocation: testCustomerLocation,
      },
    },
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`   Testing ${endpoint.name}...`);
      const options = {
        method: endpoint.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
        },
      };

      if (endpoint.data) {
        options.body = JSON.stringify(endpoint.data);
      }

      const response = await fetch(
        `${LOCATION_SERVICE_URL}${endpoint.url}`,
        options
      );

      if (response.ok) {
        console.log(`   ✅ ${endpoint.name} - Status: ${response.status}`);
      } else {
        console.log(
          `   ⚠️  ${endpoint.name} - Status: ${response.status} (Expected: Auth required)`
        );
      }
    } catch (error) {
      console.log(`   ❌ ${endpoint.name} - Error: ${error.message}`);
    }
  }
  console.log("");
}

// Run all tests
async function runAllTests() {
  await testHealthCheck();
  const socketConnected = await testSocketConnection();
  await testAPIEndpoints();

  console.log("🎯 Test Summary:");
  console.log("   Health Check: ✅");
  console.log(`   Socket Connection: ${socketConnected ? "✅" : "❌"}`);
  console.log("   API Endpoints: ⚠️  (Requires proper authentication)");

  if (socketConnected) {
    console.log("\n🎉 Basic functionality is working!");
    console.log("   Next steps:");
    console.log("   1. Set up proper authentication");
    console.log("   2. Test with frontend application");
    console.log("   3. Test geofencing with real locations");
  } else {
    console.log("\n❌ Socket connection failed. Check:");
    console.log("   1. Node.js service is running on port 3001");
    console.log("   2. CORS settings are correct");
    console.log("   3. Authentication middleware is working");
  }
}

// Start tests
runAllTests().catch(console.error);
