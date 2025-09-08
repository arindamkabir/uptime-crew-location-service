import express, { Request, Response } from "express";
import locationService from "../services/locationService";
import logger from "../utils/logger";

const router = express.Router();

// Extend Request to include user
interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    roles?: string[];
  };
}

// Get user's current location
router.get("/me", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const location = await locationService.getUserLocation(userId);

    if (!location) {
      return res.status(404).json({
        error: "Not found",
        message: "Location not found for this user",
      });
    }

    res.json({
      success: true,
      data: location,
    });
  } catch (error) {
    logger.error("Error getting user location:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get user location",
    });
  }
});

// Get user's location history
router.get("/me/history", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const history = await locationService.getUserLocationHistory(userId, limit);

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    logger.error("Error getting user location history:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get location history",
    });
  }
});

// Update user's location
router.post("/me", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { latitude, longitude, accuracy, timestamp, speed, heading } =
      req.body;

    // Validate required fields
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({
        error: "Bad request",
        message: "Latitude and longitude are required and must be numbers",
      });
    }

    // Validate coordinates
    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        error: "Bad request",
        message:
          "Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180",
      });
    }

    const locationData = {
      user_id: userId,
      latitude,
      longitude,
      accuracy,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      speed,
      heading,
    };

    const updatedLocation = await locationService.updateUserLocation(
      locationData
    );

    res.json({
      success: true,
      message: "Location updated successfully",
      data: updatedLocation,
    });
  } catch (error) {
    logger.error("Error updating user location:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to update location",
    });
  }
});

// Get nearby users
router.get("/nearby", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { latitude, longitude, radius = 1000 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: "Bad request",
        message: "Latitude and longitude are required",
      });
    }

    const nearbyUsers = await locationService.getNearbyUsers(
      parseFloat(latitude as string),
      parseFloat(longitude as string),
      parseInt(radius as string),
      userId
    );

    res.json({
      success: true,
      data: nearbyUsers,
      count: nearbyUsers.length,
      search_radius: parseInt(radius as string),
    });
  } catch (error) {
    logger.error("Error getting nearby users:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get nearby users",
    });
  }
});

// Get location statistics
router.get("/statistics", async (req: AuthRequest, res: Response) => {
  try {
    const stats = await locationService.getLocationStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error getting location statistics:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get location statistics",
    });
  }
});

// Get user status
router.get("/status/:userId", async (req: AuthRequest, res: Response) => {
  try {
    const requestingUserId = req.user?.id;
    if (!requestingUserId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { userId } = req.params;

    // Users can only check their own status
    if (userId !== requestingUserId) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Access denied to this user status",
      });
    }

    const status = await locationService.getUserStatus(userId);

    res.json({
      success: true,
      data: {
        user_id: parseInt(userId),
        status: status,
      },
    });
  } catch (error) {
    logger.error("Error getting user status:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get user status",
    });
  }
});

// Update user status
router.put("/status", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { status } = req.body;

    const validStatuses = ["online", "offline", "busy", "away"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Bad request",
        message: "Invalid status. Must be one of: online, offline, busy, away",
      });
    }

    await locationService.updateUserStatus(userId, status);

    res.json({
      success: true,
      message: "Status updated successfully",
      data: {
        user_id: userId,
        status: status,
      },
    });
  } catch (error) {
    logger.error("Error updating user status:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to update status",
    });
  }
});

// Get online users count
router.get("/online-count", async (req: AuthRequest, res: Response) => {
  try {
    const count = await locationService.getOnlineUsersCount();

    res.json({
      success: true,
      data: {
        online_users: count,
      },
    });
  } catch (error) {
    logger.error("Error getting online users count:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get online users count",
    });
  }
});

// Bulk location update (for mobile apps that send multiple locations)
router.post("/bulk", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { locations } = req.body;

    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({
        error: "Bad request",
        message: "Locations array is required and must not be empty",
      });
    }

    if (locations.length > 100) {
      return res.status(400).json({
        error: "Bad request",
        message: "Maximum 100 locations allowed per request",
      });
    }

    const results: Array<{ success: boolean; data?: any; error?: string }> = [];

    for (const location of locations) {
      try {
        const { latitude, longitude, accuracy, timestamp, speed, heading } =
          location;

        if (typeof latitude !== "number" || typeof longitude !== "number") {
          results.push({ success: false, error: "Invalid coordinates" });
          continue;
        }

        const locationData = {
          user_id: userId,
          latitude,
          longitude,
          accuracy,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          speed,
          heading,
        };

        const updatedLocation = await locationService.updateUserLocation(
          locationData
        );
        results.push({ success: true, data: updatedLocation });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    res.json({
      success: true,
      message: "Bulk location update completed",
      data: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        results: results,
      },
    });
  } catch (error) {
    logger.error("Error processing bulk location update:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process bulk location update",
    });
  }
});

export default router;
