import { Server, Socket } from "socket.io";
import logger from "../utils/logger";
import locationService from "../services/locationService";
import geofencingService from "../services/geofencingService";
import { ConnectedUser, LocationData } from "../types";
import axios from "axios";

// Extend Socket to include user property
interface AuthenticatedSocket extends Socket {
  user: ConnectedUser;
}

class SocketHandler {
  private connectedUsers: Map<string, ConnectedUser> = new Map();
  private laravelApiUrl: string;
  private proximityAlerts: Map<string, Set<string>> = new Map(); // Track proximity alerts sent per geofence

  constructor() {
    this.laravelApiUrl =
      process.env.LARAVEL_API_URL || "https://api.uptimecrew.lol";
  }

  // Handle new socket connection
  handleConnection(socket: AuthenticatedSocket, io: Server): void {
    try {
      const user = socket.user;

      if (!user) {
        logger.error("No user data in socket connection");
        socket.disconnect();
        return;
      }

      // Log authenticated user information
      logger.info("User authenticated and connected:", {
        socketId: socket.id,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userType: user.user_type,
        roles: user.roles,
        connectedAt: new Date().toISOString(),
      });

      // Store connected user
      this.connectedUsers.set(socket.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        user_type: user.user_type,
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

        // If user is a technician, broadcast location to customers watching this service
        if (user.user_type === "technician") {
          this.broadcastTechnicianLocation(io, user.id, locationData);
        }

        // Check geofencing
        const geofenceEvents = await geofencingService.checkGeofences(
          locationData
        );
        if (geofenceEvents.length > 0) {
          socket.emit("geofence_events", geofenceEvents);

          // Check for proximity alerts (customer and technician in same geofence)
          await this.checkAndEmitProximityAlerts(
            socket,
            io,
            geofenceEvents,
            user
          );
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

    // Allow customers to subscribe to technician location updates
    socket.on(
      "subscribe_technician_location",
      (data: { technicianId: string; serviceRequestId: string }) => {
        const { technicianId, serviceRequestId } = data;
        const roomName = `technician_${technicianId}_service_${serviceRequestId}`;
        socket.join(roomName);
        logger.info(
          `User ${socket.user.id} subscribed to technician ${technicianId} location updates`
        );
        socket.emit("subscription_confirmed", {
          technicianId,
          serviceRequestId,
        });
      }
    );

    // Allow customers to unsubscribe from technician location updates
    socket.on(
      "unsubscribe_technician_location",
      (data: { technicianId: string; serviceRequestId: string }) => {
        const { technicianId, serviceRequestId } = data;
        const roomName = `technician_${technicianId}_service_${serviceRequestId}`;
        socket.leave(roomName);
        logger.info(
          `User ${socket.user.id} unsubscribed from technician ${technicianId} location updates`
        );
      }
    );
  }

  // Handle geofencing events
  handleGeofencingEvents(socket: AuthenticatedSocket, io: Server): void {
    // Get user's geofences
    socket.on("get_my_geofences", async () => {
      try {
        // For testing without auth, create a mock user
        const user = socket.user || {
          id: "test-user-123",
          name: "Test User",
          roles: ["technician"],
        };
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
          // For testing without auth, create a mock user
          const user = socket.user || {
            id: "test-user-123",
            name: "Test User",
            roles: ["technician"],
          };
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

  // Broadcast technician location to all customers subscribed to their updates
  broadcastTechnicianLocation(
    io: Server,
    technicianId: string,
    locationData: LocationData
  ): void {
    try {
      // Get all active geofences for this technician to find associated service requests
      const geofences = geofencingService.getActiveGeofences();
      const serviceRequestIds = new Set<string>();

      // Find service requests associated with this technician
      for (const geofence of geofences) {
        const geofenceAny = geofence as any;
        if (geofenceAny.serviceRequestId) {
          serviceRequestIds.add(geofenceAny.serviceRequestId);
        }
      }

      // Broadcast to all relevant rooms
      serviceRequestIds.forEach((serviceRequestId) => {
        const roomName = `technician_${technicianId}_service_${serviceRequestId}`;
        io.to(roomName).emit("technician_location_update", {
          technicianId,
          serviceRequestId,
          location: {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            accuracy: locationData.accuracy,
            speed: locationData.speed,
            heading: locationData.heading,
            timestamp: locationData.timestamp,
          },
        });
      });

      // Also broadcast to a general room for this technician (for backward compatibility)
      io.emit("technician_location_broadcast", {
        technicianId,
        location: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          speed: locationData.speed,
          heading: locationData.heading,
          timestamp: locationData.timestamp,
        },
      });
    } catch (error) {
      logger.error("Error broadcasting technician location:", error);
    }
  }

  // Check and emit proximity alerts
  async checkAndEmitProximityAlerts(
    socket: AuthenticatedSocket,
    io: Server,
    geofenceEvents: any[],
    currentUser: ConnectedUser
  ): Promise<void> {
    try {
      for (const event of geofenceEvents) {
        if (event.type === "location_update" || event.type === "entry") {
          const geofenceId = event.geofence_id;

          // Get all users in this geofence
          const geofence = geofencingService
            .getActiveGeofences()
            .find((g) => g.id === geofenceId);
          if (!geofence || !(geofence as any).serviceRequestId) {
            continue;
          }

          const usersInGeofence = await geofencingService.getUsersInGeofence(
            geofence
          );
          const userIds = usersInGeofence.map((u) => u.user_id);

          // Check if we have both customer and technician
          const hasCustomer = userIds.some((userId) => {
            const connectedUser = Array.from(this.connectedUsers.values()).find(
              (u) => u.id === userId
            );
            return connectedUser?.user_type === "customer";
          });

          const hasTechnician = userIds.some((userId) => {
            const connectedUser = Array.from(this.connectedUsers.values()).find(
              (u) => u.id === userId
            );
            return connectedUser?.user_type === "technician";
          });

          // If both customer and technician are present, emit proximity alert
          if (hasCustomer && hasTechnician) {
            // Check if we've already sent this alert
            const alertKey = `${geofenceId}-${currentUser.id}`;
            const sentAlerts =
              this.proximityAlerts.get(geofenceId) || new Set();

            if (!sentAlerts.has(currentUser.id)) {
              // Fetch vehicle details from Laravel
              const vehicleDetails = await this.fetchVehicleDetails(
                (geofence as any).serviceRequestId
              );

              // Emit to technician
              const technicianSocket = this.findUserSocket(
                io,
                userIds,
                "technician"
              );
              if (technicianSocket && currentUser.user_type === "technician") {
                technicianSocket.emit("proximity_alert", {
                  message: "You are approaching the customer",
                  geofence_id: geofenceId,
                  service_request_id: (geofence as any).serviceRequestId,
                  vehicle_details: vehicleDetails,
                  timestamp: new Date(),
                });
              }

              // Emit to customer
              const customerSocket = this.findUserSocket(
                io,
                userIds,
                "customer"
              );
              if (customerSocket && currentUser.user_type === "customer") {
                customerSocket.emit("proximity_alert", {
                  message: "The technician is approaching",
                  geofence_id: geofenceId,
                  service_request_id: (geofence as any).serviceRequestId,
                  vehicle_details: vehicleDetails,
                  timestamp: new Date(),
                });
              }

              // Mark alert as sent
              sentAlerts.add(currentUser.id);
              this.proximityAlerts.set(geofenceId, sentAlerts);

              logger.info(`Proximity alert sent for geofence ${geofenceId}`);
            }
          }
        }
      }
    } catch (error) {
      logger.error("Error checking proximity alerts:", error);
    }
  }

  // Find socket for a user type in the list
  findUserSocket(
    io: Server,
    userIds: string[],
    userType: string
  ): AuthenticatedSocket | null {
    for (const [socketId, user] of this.connectedUsers.entries()) {
      if (userIds.includes(user.id) && user.user_type === userType) {
        const socket = io.sockets.sockets.get(socketId) as AuthenticatedSocket;
        if (socket) {
          return socket;
        }
      }
    }
    return null;
  }

  // Fetch vehicle details from Laravel backend
  async fetchVehicleDetails(serviceRequestId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.laravelApiUrl}/api/service-requests/${serviceRequestId}`,
        {
          headers: {
            Accept: "application/json",
          },
          timeout: 5000,
        }
      );

      if (response.status === 200 && response.data?.data) {
        const serviceRequest = response.data.data;
        const vehicle = serviceRequest.customer_vehicle;

        if (vehicle) {
          return {
            name: vehicle.name || "Unknown Vehicle",
            plate_number: vehicle.plate_number,
            vin_number: vehicle.vin_number,
            vehicle_details: vehicle.vehicle
              ? {
                  year: vehicle.vehicle.year,
                  make: vehicle.vehicle.make?.name,
                  model: vehicle.vehicle.model?.name,
                  trim: vehicle.vehicle.trim,
                }
              : null,
          };
        }
      }

      return null;
    } catch (error) {
      logger.error("Error fetching vehicle details:", error);
      return null;
    }
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
