import { Server, Socket } from "socket.io";
import logger from "../utils/logger";
import locationService from "../services/locationService";
import geofencingService from "../services/geofencingService";
import { ConnectedUser, LocationData } from "../types";

// Extend Socket to include user property
interface AuthenticatedSocket extends Socket {
  user: ConnectedUser;
}

class SocketHandler {
  private connectedUsers: Map<string, ConnectedUser> = new Map();

  // Handle new socket connection
  handleConnection(socket: AuthenticatedSocket, io: Server): void {
    try {
      const user = socket.user;
      if (!user) {
        logger.error("No user data in socket connection");
        socket.disconnect();
        return;
      }

      // Store connected user
      this.connectedUsers.set(socket.id, {
        id: user.id,
        name: user.name,
        roles: user.roles,
        connectedAt: new Date(),
      });

      // Set up event handlers
      this.handleLocationUpdates(socket, io);
      this.handleGeofencingEvents(socket, io);

      // Handle disconnection
      socket.on("disconnect", () => {
        this.handleDisconnection(socket, io);
      });

      // Handle errors
      socket.on("error", (error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
      });

      logger.info(
        `User ${user.name} (${user.id}) connected with socket ${socket.id}`
      );

      // Emit connection confirmation
      socket.emit("connected", {
        message: "Successfully connected to location service",
        user: {
          id: user.id,
          name: user.name,
        },
      });
    } catch (error) {
      logger.error("Error handling socket connection:", error);
      socket.disconnect();
    }
  }

  // Handle location updates from clients
  handleLocationUpdates(socket: AuthenticatedSocket, io: Server): void {
    socket.on("update_location", async (data: LocationData) => {
      try {
        const user = socket.user;
        const { latitude, longitude, accuracy, timestamp, speed, heading } =
          data;

        // Validate location data
        if (!this.validateLocationData(data)) {
          socket.emit("location_error", { message: "Invalid location data" });
          return;
        }

        const locationData: LocationData = {
          user_id: user.id,
          latitude,
          longitude,
          accuracy,
          timestamp: timestamp || new Date(),
          speed,
          heading,
        };

        // Update location in service
        await locationService.updateUserLocation(locationData);

        // Check geofencing
        const geofenceEvents = await geofencingService.checkGeofences(
          locationData
        );
        if (geofenceEvents.length > 0) {
          socket.emit("geofence_events", geofenceEvents);
        }

        // Confirm location update
        socket.emit("location_updated", {
          message: "Location updated successfully",
          timestamp: new Date(),
        });
      } catch (error) {
        logger.error("Error updating location:", error);
        socket.emit("location_error", {
          message: "Failed to update location",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  // Handle geofencing events
  handleGeofencingEvents(socket: AuthenticatedSocket, io: Server): void {
    // Get user's geofences
    socket.on("get_my_geofences", async () => {
      try {
        const user = socket.user;
        const geofences = await geofencingService.getUserGeofences(user.id);
        socket.emit("my_geofences", geofences);
      } catch (error) {
        logger.error("Error getting user geofences:", error);
        socket.emit("geofence_error", { message: "Failed to get geofences" });
      }
    });

    // Create new geofence
    socket.on(
      "create_geofence",
      async (geofenceData: {
        name: string;
        description?: string;
        latitude: number;
        longitude: number;
      }) => {
        try {
          const user = socket.user;
          const geofence = await geofencingService.createGeofence({
            ...geofenceData,
            created_by: user.id,
          });

          socket.emit("geofence_created", geofence);
        } catch (error) {
          logger.error("Error creating geofence:", error);
          socket.emit("geofence_error", {
            message: "Failed to create geofence",
          });
        }
      }
    );

    // Get geofence events
    socket.on("get_geofence_events", async (geofenceId?: string) => {
      try {
        const events = await geofencingService.getGeofenceEvents(geofenceId);
        socket.emit("geofence_events", events);
      } catch (error) {
        logger.error("Error getting geofence events:", error);
        socket.emit("geofence_error", {
          message: "Failed to get geofence events",
        });
      }
    });
  }

  // Handle socket disconnection
  handleDisconnection(socket: AuthenticatedSocket, io: Server): void {
    try {
      const user = this.connectedUsers.get(socket.id);
      if (user) {
        // Update user status
        locationService.updateUserStatus(user.id, "offline");

        // Remove from connected users
        this.connectedUsers.delete(socket.id);

        logger.info(`User ${user.name} (${user.id}) disconnected`);
      }
    } catch (error) {
      logger.error("Error handling disconnection:", error);
    }
  }

  // Validate location data
  validateLocationData(data: any): data is LocationData {
    const { latitude, longitude, accuracy } = data;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return false;
    }

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return false;
    }

    if (accuracy && (typeof accuracy !== "number" || accuracy < 0)) {
      return false;
    }

    return true;
  }

  // Get connection info
  getConnectionInfo(): {
    totalConnections: number;
    connectedUsers: ConnectedUser[];
  } {
    const connectedUsers = Array.from(this.connectedUsers.values());

    return {
      totalConnections: this.connectedUsers.size,
      connectedUsers,
    };
  }
}

export default new SocketHandler();
