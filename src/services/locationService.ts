import logger from "../utils/logger";
import { LocationData, LocationHistoryEntry } from "../types";

class LocationService {
  private userLocations: Map<string, LocationData> = new Map();
  private locationHistory: Map<string, LocationHistoryEntry[]> = new Map();
  private userStatus: Map<string, string> = new Map();

  constructor() {
    logger.info("Location service initialized successfully");
  }

  // Initialize the service
  async initialize(): Promise<void> {
    try {
      logger.info("Location service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize location service:", error);
    }
  }

  // Update user location
  async updateUserLocation(locationData: LocationData): Promise<LocationData> {
    try {
      const {
        user_id,
        latitude,
        longitude,
        accuracy,
        timestamp,
        speed,
        heading,
      } = locationData;

      // Validate required fields
      if (
        !user_id ||
        typeof latitude !== "number" ||
        typeof longitude !== "number"
      ) {
        throw new Error("Invalid location data");
      }

      // Validate coordinates
      if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new Error("Invalid coordinates");
      }

      const location: LocationData = {
        user_id,
        latitude,
        longitude,
        accuracy,
        timestamp: timestamp || new Date(),
        speed,
        heading,
      };

      // Store current location
      this.userLocations.set(user_id, location);

      // Add to history
      const historyEntry: LocationHistoryEntry = {
        ...location,
        id: `${user_id}_${Date.now()}`,
        updated_at: new Date(),
      };

      if (!this.locationHistory.has(user_id)) {
        this.locationHistory.set(user_id, []);
      }
      this.locationHistory.get(user_id)!.push(historyEntry);

      // Keep only last 100 entries per user
      const userHistory = this.locationHistory.get(user_id)!;
      if (userHistory.length > 100) {
        userHistory.splice(0, userHistory.length - 100);
      }

      // Update user status to online
      this.userStatus.set(user_id, "online");

      logger.info(
        `Updated location for user ${user_id}: ${latitude}, ${longitude}`
      );
      return location;
    } catch (error) {
      logger.error("Error updating user location:", error);
      throw error;
    }
  }

  // Get user's current location
  async getUserLocation(userId: string): Promise<LocationData | null> {
    try {
      const location = this.userLocations.get(userId);
      return location || null;
    } catch (error) {
      logger.error("Error getting user location:", error);
      return null;
    }
  }

  // Get user's location history
  async getUserLocationHistory(
    userId: string,
    limit: number = 50
  ): Promise<LocationHistoryEntry[]> {
    try {
      const history = this.locationHistory.get(userId) || [];
      return history.slice(-limit);
    } catch (error) {
      logger.error("Error getting user location history:", error);
      return [];
    }
  }

  // Get all user locations
  async getAllUserLocations(): Promise<LocationData[]> {
    try {
      return Array.from(this.userLocations.values());
    } catch (error) {
      logger.error("Error getting all user locations:", error);
      return [];
    }
  }

  // Get nearby users
  async getNearbyUsers(
    latitude: number,
    longitude: number,
    radius: number = 1000,
    excludeUserId?: string
  ): Promise<Array<LocationData & { distance: number }>> {
    try {
      const nearbyUsers: Array<LocationData & { distance: number }> = [];

      for (const location of this.userLocations.values()) {
        if (excludeUserId && location.user_id === excludeUserId) {
          continue;
        }

        const distance = this.calculateDistance(
          latitude,
          longitude,
          location.latitude,
          location.longitude
        );

        if (distance <= radius) {
          nearbyUsers.push({
            ...location,
            distance: Math.round(distance),
          });
        }
      }

      // Sort by distance
      nearbyUsers.sort((a, b) => a.distance - b.distance);
      return nearbyUsers;
    } catch (error) {
      logger.error("Error getting nearby users:", error);
      return [];
    }
  }

  // Calculate distance between two points using Haversine formula
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Update user status
  async updateUserStatus(userId: string, status: string): Promise<void> {
    try {
      this.userStatus.set(userId, status);
      logger.info(`Updated user ${userId} status to: ${status}`);
    } catch (error) {
      logger.error("Error updating user status:", error);
    }
  }

  // Get user status
  async getUserStatus(userId: string): Promise<string> {
    try {
      return this.userStatus.get(userId) || "unknown";
    } catch (error) {
      logger.error("Error getting user status:", error);
      return "unknown";
    }
  }

  // Get online users count
  async getOnlineUsersCount(): Promise<number> {
    try {
      let onlineCount = 0;
      for (const status of this.userStatus.values()) {
        if (status === "online") {
          onlineCount++;
        }
      }
      return onlineCount;
    } catch (error) {
      logger.error("Error getting online users count:", error);
      return 0;
    }
  }

  // Get location statistics
  async getLocationStatistics(): Promise<{
    total_users: number;
    online_users: number;
    timestamp: string;
  }> {
    try {
      const totalUsers = this.userLocations.size;
      const onlineUsers = await this.getOnlineUsersCount();

      return {
        total_users: totalUsers,
        online_users: onlineUsers,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting location statistics:", error);
      return {
        total_users: 0,
        online_users: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Clean up old data
  async cleanupOldData(): Promise<void> {
    try {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      // Clean up old location history
      for (const [userId, history] of this.locationHistory.entries()) {
        const validEntries = history.filter((entry) => {
          try {
            if (!entry.timestamp) return false;
            const entryTime = new Date(entry.timestamp).getTime();
            return entryTime > oneDayAgo;
          } catch {
            return false;
          }
        });

        if (validEntries.length !== history.length) {
          this.locationHistory.set(userId, validEntries);
        }
      }

      logger.info("Cleaned up old location data");
    } catch (error) {
      logger.error("Error cleaning up old locations:", error);
    }
  }
}

export default new LocationService();
