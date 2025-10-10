import * as turf from "@turf/turf";
import logger from "../utils/logger";
import { Geofence, GeofenceEvent, LocationData } from "../types";

class GeofencingService {
  private geofences: Map<string, Geofence> = new Map();
  private activeGeofences: Set<string> = new Set();
  private geofenceEvents: GeofenceEvent[] = [];
  private previousUsersInGeofence: Map<string, Set<string>> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    logger.info("Geofencing service initialized successfully");
  }

  // Initialize the service
  async initialize(): Promise<void> {
    try {
      // Start periodic geofence checking
      if (process.env.GEOFENCING_ENABLED === "true") {
        this.startGeofenceChecking();
      }

      logger.info("Geofencing service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize geofencing service:", error);
    }
  }

  // Start periodic geofence checking
  startGeofenceChecking(): void {
    const interval = parseInt(process.env.GEOFENCING_CHECK_INTERVAL || "5000");

    this.checkInterval = setInterval(async () => {
      await this.checkAllActiveGeofences();
    }, interval);

    logger.info(`Started geofence checking every ${interval}ms`);
  }

  // Stop geofence checking
  stopGeofenceChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info("Stopped geofence checking");
    }
  }

  // Check all active geofences
  async checkAllActiveGeofences(): Promise<void> {
    try {
      const activeGeofences = Array.from(this.activeGeofences)
        .map((id) => this.geofences.get(id))
        .filter(Boolean) as Geofence[];

      for (const geofence of activeGeofences) {
        if (geofence && geofence.is_active) {
          await this.checkGeofence(geofence);
        }
      }
    } catch (error) {
      logger.error("Error checking active geofences:", error);
    }
  }

  // Check a specific geofence
  async checkGeofence(geofence: Geofence): Promise<void> {
    try {
      // Get all users currently in this geofence
      const usersInGeofence = await this.getUsersInGeofence(geofence);

      // Check for new entries/exits
      const currentUsers = new Set(usersInGeofence.map((u) => u.user_id));
      const previousUsers = await this.getPreviousUsersInGeofence(geofence.id);

      // Find new entries
      const newEntries = usersInGeofence.filter(
        (user) => !previousUsers.has(user.user_id)
      );

      // Find exits
      const exits = Array.from(previousUsers).filter(
        (userId) => !currentUsers.has(userId)
      );

      // Update previous users list
      await this.updatePreviousUsersInGeofence(geofence.id, currentUsers);

      // Process events
      if (newEntries.length > 0 || exits.length > 0) {
        await this.processGeofenceEvents(geofence, newEntries, exits);
      }
    } catch (error) {
      logger.error(`Error checking geofence ${geofence.id}:`, error);
    }
  }

  // Get users currently in a geofence
  async getUsersInGeofence(
    geofence: Geofence
  ): Promise<Array<LocationData & { user_id: string }>> {
    try {
      const locationService = (await import("./locationService")).default;
      const allLocations = await locationService.getAllUserLocations();
      const usersInGeofence: Array<LocationData & { user_id: string }> = [];

      for (const location of allLocations) {
        const userLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
        };

        if (this.isPointInGeofence(userLocation, geofence)) {
          usersInGeofence.push({
            ...location,
            user_id: location.user_id,
            timestamp: location.timestamp,
          });
        }
      }

      return usersInGeofence;
    } catch (error) {
      logger.error("Error getting users in geofence:", error);
      return [];
    }
  }

  // Check if a point is within a geofence
  isPointInGeofence(
    point: { latitude: number; longitude: number },
    geofence: Geofence
  ): boolean {
    try {
      const center = turf.point([geofence.longitude, geofence.latitude]);
      const userPoint = turf.point([point.longitude, point.latitude]);
      const distance = turf.distance(center, userPoint, { units: "meters" });

      return distance <= geofence.radius;
    } catch (error) {
      logger.error("Error checking point in geofence:", error);
      return false;
    }
  }

  // Get previous users in geofence
  async getPreviousUsersInGeofence(geofenceId: string): Promise<Set<string>> {
    try {
      return this.previousUsersInGeofence.get(geofenceId) || new Set();
    } catch (error) {
      logger.error("Error getting previous users in geofence:", error);
      return new Set();
    }
  }

  // Update previous users in geofence
  async updatePreviousUsersInGeofence(
    geofenceId: string,
    users: Set<string>
  ): Promise<void> {
    try {
      this.previousUsersInGeofence.set(geofenceId, users);
    } catch (error) {
      logger.error("Error updating previous users in geofence:", error);
    }
  }

  // Process geofence events
  async processGeofenceEvents(
    geofence: Geofence,
    newEntries: Array<LocationData & { user_id: string }>,
    exits: string[]
  ): Promise<GeofenceEvent[]> {
    try {
      const events: GeofenceEvent[] = [];

      // Process new entries
      for (const entry of newEntries) {
        const event: GeofenceEvent = {
          type: "entry",
          geofence_id: geofence.id,
          geofence_name: geofence.name,
          user_id: entry.user_id,
          timestamp: new Date(),
          location: {
            latitude: entry.latitude,
            longitude: entry.longitude,
          },
        };

        events.push(event);
      }

      // Process exits
      for (const exit of exits) {
        const event: GeofenceEvent = {
          type: "exit",
          geofence_id: geofence.id,
          geofence_name: geofence.name,
          user_id: exit,
          timestamp: new Date(),
        };

        events.push(event);
      }

      // Store events
      await this.storeGeofenceEvents(events);

      logger.info(
        `Processed ${events.length} geofence events for ${geofence.name}`
      );
      return events;
    } catch (error) {
      logger.error("Error processing geofence events:", error);
      return [];
    }
  }

  // Check if customer and technician are in same geofence and return proximity alert
  async checkProximityAlert(
    geofence: Geofence,
    usersInGeofence: Array<LocationData & { user_id: string }>
  ): Promise<any | null> {
    try {
      // Check if this is a service request geofence
      if (!(geofence as any).serviceRequestId) {
        return null;
      }

      // Get all users in the geofence with their types
      const locationService = (await import("./locationService")).default;
      const userIds = usersInGeofence.map((u) => u.user_id);

      // For now, we'll need to check user types from Laravel backend
      // This will be implemented in the socket handler where we have user context
      return {
        geofence_id: geofence.id,
        service_request_id: (geofence as any).serviceRequestId,
        users_in_geofence: userIds,
      };
    } catch (error) {
      logger.error("Error checking proximity alert:", error);
      return null;
    }
  }

  // Store geofence events
  async storeGeofenceEvents(events: GeofenceEvent[]): Promise<void> {
    try {
      for (const event of events) {
        this.geofenceEvents.push(event);
      }

      // Keep only last 1000 events
      if (this.geofenceEvents.length > 1000) {
        this.geofenceEvents = this.geofenceEvents.slice(-1000);
      }
    } catch (error) {
      logger.error("Error storing geofence events:", error);
    }
  }

  // Check geofences for a location update
  async checkGeofences(locationData: LocationData): Promise<GeofenceEvent[]> {
    try {
      const events: GeofenceEvent[] = [];
      const userLocation = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
      };

      for (const geofence of this.geofences.values()) {
        if (
          geofence.is_active &&
          this.isPointInGeofence(userLocation, geofence)
        ) {
          const event: GeofenceEvent = {
            type: "location_update",
            geofence_id: geofence.id,
            geofence_name: geofence.name,
            user_id: locationData.user_id,
            timestamp: new Date(),
            location: userLocation,
          };

          events.push(event);
        }
      }

      return events;
    } catch (error) {
      logger.error("Error checking geofences for location:", error);
      return [];
    }
  }

  // Create a new geofence
  async createGeofence(geofenceData: {
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    created_by: string;
    radius?: number;
  }): Promise<Geofence> {
    try {
      const geofence: Geofence = {
        id: `gf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: geofenceData.name,
        description: geofenceData.description || "",
        latitude: geofenceData.latitude,
        longitude: geofenceData.longitude,
        radius: geofenceData.radius || 90, // Default 50m radius for technician-customer proximity
        created_by: geofenceData.created_by,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Store in memory
      this.geofences.set(geofence.id, geofence);
      this.activeGeofences.add(geofence.id);

      logger.info(`Created geofence: ${geofence.name} (${geofence.id})`);
      return geofence;
    } catch (error) {
      logger.error("Error creating geofence:", error);
      throw error;
    }
  }

  // Get user's geofences
  async getUserGeofences(userId: string): Promise<Geofence[]> {
    try {
      const userGeofences: Geofence[] = [];

      for (const geofence of this.geofences.values()) {
        if (geofence.created_by === userId) {
          userGeofences.push(geofence);
        }
      }

      return userGeofences;
    } catch (error) {
      logger.error("Error getting user geofences:", error);
      return [];
    }
  }

  // Update a geofence
  async updateGeofence(
    geofenceId: string,
    updates: Partial<Geofence>
  ): Promise<Geofence> {
    try {
      const geofence = this.geofences.get(geofenceId);
      if (!geofence) {
        throw new Error("Geofence not found");
      }

      // Update fields
      Object.assign(geofence, updates, {
        updated_at: new Date().toISOString(),
      });

      // Update active geofences set
      if (geofence.is_active) {
        this.activeGeofences.add(geofenceId);
      } else {
        this.activeGeofences.delete(geofenceId);
      }

      return geofence;
    } catch (error) {
      logger.error("Error updating geofence:", error);
      throw error;
    }
  }

  // Delete a geofence
  async deleteGeofence(geofenceId: string): Promise<boolean> {
    try {
      const geofence = this.geofences.get(geofenceId);
      if (!geofence) {
        throw new Error("Geofence not found");
      }

      // Remove from memory
      this.geofences.delete(geofenceId);
      this.activeGeofences.delete(geofenceId);
      this.previousUsersInGeofence.delete(geofenceId);

      logger.info(`Deleted geofence: ${geofence.name} (${geofenceId})`);
      return true;
    } catch (error) {
      logger.error("Error deleting geofence:", error);
      throw error;
    }
  }

  // Get active geofences
  getActiveGeofences(): Geofence[] {
    return Array.from(this.activeGeofences)
      .map((id) => this.geofences.get(id))
      .filter(Boolean) as Geofence[];
  }

  // Get geofence events
  async getGeofenceEvents(
    geofenceId?: string,
    limit: number = 100
  ): Promise<GeofenceEvent[]> {
    try {
      let events = this.geofenceEvents;

      if (geofenceId) {
        events = events.filter((event) => event.geofence_id === geofenceId);
      }

      return events.slice(-limit);
    } catch (error) {
      logger.error("Error getting geofence events:", error);
      return [];
    }
  }

  // Create geofence for service request
  async createServiceRequestGeofence(
    serviceRequestId: string,
    customerLocation: { latitude: number; longitude: number },
    technicianId: string
  ): Promise<Geofence> {
    try {
      const geofence = await this.createGeofence({
        name: `Service Request ${serviceRequestId}`,
        description: `50m proximity geofence for service request ${serviceRequestId}`,
        latitude: customerLocation.latitude,
        longitude: customerLocation.longitude,
        created_by: technicianId,
        radius: 50,
      });

      // Store service request mapping
      (geofence as any).serviceRequestId = serviceRequestId;
      this.geofences.set(geofence.id, geofence);

      logger.info(
        `Created service request geofence for SR ${serviceRequestId}`
      );
      return geofence;
    } catch (error) {
      logger.error("Error creating service request geofence:", error);
      throw error;
    }
  }

  // Get geofences for service request
  async getServiceRequestGeofences(
    serviceRequestId: string
  ): Promise<Geofence[]> {
    try {
      const serviceGeofences: Geofence[] = [];

      for (const geofence of this.geofences.values()) {
        if ((geofence as any).serviceRequestId === serviceRequestId) {
          serviceGeofences.push(geofence);
        }
      }

      return serviceGeofences;
    } catch (error) {
      logger.error("Error getting service request geofences:", error);
      return [];
    }
  }

  // Clean up old events
  async cleanupOldEvents(): Promise<void> {
    try {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      this.geofenceEvents = this.geofenceEvents.filter((event) => {
        return new Date(event.timestamp).getTime() > oneDayAgo;
      });

      logger.info("Cleaned up old geofence events");
    } catch (error) {
      logger.error("Error cleaning up old events:", error);
    }
  }
}

export default new GeofencingService();
