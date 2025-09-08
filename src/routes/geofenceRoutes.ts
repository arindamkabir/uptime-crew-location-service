import express, { Request, Response } from "express";
import geofencingService from "../services/geofencingService";
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

// Get all geofences for the user
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const geofences = await geofencingService.getUserGeofences(userId);

    res.json({
      success: true,
      data: geofences,
      count: geofences.length,
    });
  } catch (error) {
    logger.error("Error getting user geofences:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get geofences",
    });
  }
});

// Get a specific geofence
router.get("/:geofenceId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { geofenceId } = req.params;

    const allGeofences = await geofencingService.getUserGeofences(userId);
    const geofence = allGeofences.find((g) => g.id === geofenceId);

    if (!geofence) {
      return res.status(404).json({
        error: "Not found",
        message: "Geofence not found",
      });
    }

    res.json({
      success: true,
      data: geofence,
    });
  } catch (error) {
    logger.error("Error getting geofence:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get geofence",
    });
  }
});

// Create a new geofence
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { name, description, latitude, longitude } = req.body;

    // Validate required fields
    if (
      !name ||
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      return res.status(400).json({
        error: "Bad request",
        message: "Name, latitude, and longitude are required",
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

    const geofenceData = {
      name,
      description: description || "",
      latitude,
      longitude,
      created_by: userId,
    };

    const geofence = await geofencingService.createGeofence(geofenceData);

    res.status(201).json({
      success: true,
      message: "Geofence created successfully",
      data: geofence,
    });
  } catch (error) {
    logger.error("Error creating geofence:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to create geofence",
    });
  }
});

// Update a geofence
router.put("/:geofenceId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { geofenceId } = req.params;
    const updates = req.body;

    // Get the geofence to check ownership
    const allGeofences = await geofencingService.getUserGeofences(userId);
    const existingGeofence = allGeofences.find((g) => g.id === geofenceId);

    if (!existingGeofence) {
      return res.status(404).json({
        error: "Not found",
        message: "Geofence not found",
      });
    }

    // Check if user can modify this geofence
    if (existingGeofence.created_by !== userId) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Access denied to modify this geofence",
      });
    }

    // Validate updates
    if (
      updates.latitude &&
      (typeof updates.latitude !== "number" ||
        updates.latitude < -90 ||
        updates.latitude > 90)
    ) {
      return res.status(400).json({
        error: "Bad request",
        message: "Invalid latitude value",
      });
    }

    if (
      updates.longitude &&
      (typeof updates.longitude !== "number" ||
        updates.longitude < -180 ||
        updates.longitude > 180)
    ) {
      return res.status(400).json({
        error: "Bad request",
        message: "Invalid longitude value",
      });
    }

    const updatedGeofence = await geofencingService.updateGeofence(
      geofenceId,
      updates
    );

    res.json({
      success: true,
      message: "Geofence updated successfully",
      data: updatedGeofence,
    });
  } catch (error) {
    logger.error("Error updating geofence:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to update geofence",
    });
  }
});

// Delete a geofence
router.delete("/:geofenceId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { geofenceId } = req.params;

    // Get the geofence to check ownership
    const allGeofences = await geofencingService.getUserGeofences(userId);
    const existingGeofence = allGeofences.find((g) => g.id === geofenceId);

    if (!existingGeofence) {
      return res.status(404).json({
        error: "Not found",
        message: "Geofence not found",
      });
    }

    // Check if user can delete this geofence
    if (existingGeofence.created_by !== userId) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Access denied to delete this geofence",
      });
    }

    await geofencingService.deleteGeofence(geofenceId);

    res.json({
      success: true,
      message: "Geofence deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting geofence:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to delete geofence",
    });
  }
});

// Toggle geofence active status
router.patch("/:geofenceId/toggle", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { geofenceId } = req.params;

    // Get the geofence to check ownership
    const allGeofences = await geofencingService.getUserGeofences(userId);
    const existingGeofence = allGeofences.find((g) => g.id === geofenceId);

    if (!existingGeofence) {
      return res.status(404).json({
        error: "Not found",
        message: "Geofence not found",
      });
    }

    // Check if user can modify this geofence
    if (existingGeofence.created_by !== userId) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Access denied to modify this geofence",
      });
    }

    const newStatus = !existingGeofence.is_active;
    const updatedGeofence = await geofencingService.updateGeofence(geofenceId, {
      is_active: newStatus,
    });

    res.json({
      success: true,
      message: `Geofence ${
        newStatus ? "activated" : "deactivated"
      } successfully`,
      data: updatedGeofence,
    });
  } catch (error) {
    logger.error("Error toggling geofence status:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to toggle geofence status",
    });
  }
});

// Get geofence events
router.get("/:geofenceId/events", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { geofenceId } = req.params;
    const { limit = 100, type } = req.query;

    // Get the geofence to check access
    const allGeofences = await geofencingService.getUserGeofences(userId);
    const existingGeofence = allGeofences.find((g) => g.id === geofenceId);

    if (!existingGeofence) {
      return res.status(404).json({
        error: "Not found",
        message: "Geofence not found",
      });
    }

    // Get events
    const events = await geofencingService.getGeofenceEvents(
      geofenceId,
      parseInt(limit as string)
    );

    // Filter by type if specified
    let filteredEvents = events;
    if (type) {
      filteredEvents = events.filter((event) => event.type === type);
    }

    res.json({
      success: true,
      data: filteredEvents,
      count: filteredEvents.length,
      geofence_id: geofenceId,
    });
  } catch (error) {
    logger.error("Error getting geofence events:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get geofence events",
    });
  }
});

// Get geofence statistics
router.get(
  "/:geofenceId/statistics",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "User not authenticated",
        });
      }

      const { geofenceId } = req.params;

      // Get the geofence to check access
      const allGeofences = await geofencingService.getUserGeofences(userId);
      const existingGeofence = allGeofences.find((g) => g.id === geofenceId);

      if (!existingGeofence) {
        return res.status(404).json({
          error: "Not found",
          message: "Geofence not found",
        });
      }

      // Get events for statistics
      const events = await geofencingService.getGeofenceEvents(geofenceId);
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

      // Calculate statistics
      const totalEvents = events.length;
      const todayEvents = events.filter(
        (e) => new Date(e.timestamp).getTime() > oneDayAgo
      ).length;
      const weekEvents = events.filter(
        (e) => new Date(e.timestamp).getTime() > oneWeekAgo
      ).length;

      const entryEvents = events.filter((e) => e.type === "entry").length;
      const exitEvents = events.filter((e) => e.type === "exit").length;
      const locationUpdates = events.filter(
        (e) => e.type === "location_update"
      ).length;

      const uniqueUsers = new Set(events.map((e) => e.user_id)).size;

      res.json({
        success: true,
        data: {
          total_events: totalEvents,
          today_events: todayEvents,
          week_events: weekEvents,
          entry_events: entryEvents,
          exit_events: exitEvents,
          location_updates: locationUpdates,
          unique_users: uniqueUsers,
          is_active: existingGeofence.is_active,
          created_at: existingGeofence.created_at,
        },
      });
    } catch (error) {
      logger.error("Error getting geofence statistics:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to get geofence statistics",
      });
    }
  }
);

// Create geofence for service request
router.post("/service-request", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { serviceRequestId, customerLocation } = req.body;

    if (
      !serviceRequestId ||
      !customerLocation?.latitude ||
      !customerLocation?.longitude
    ) {
      return res.status(400).json({
        error: "Bad request",
        message: "Service request ID and customer location are required",
      });
    }

    const geofence = await geofencingService.createServiceRequestGeofence(
      serviceRequestId,
      customerLocation,
      userId
    );

    res.status(201).json({
      success: true,
      message: "Service request geofence created successfully",
      data: geofence,
    });
  } catch (error) {
    logger.error("Error creating service request geofence:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to create service request geofence",
    });
  }
});

// Get geofences for service request
router.get(
  "/service-request/:serviceRequestId",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "User not authenticated",
        });
      }

      const { serviceRequestId } = req.params;
      const geofences = await geofencingService.getServiceRequestGeofences(
        serviceRequestId
      );

      res.json({
        success: true,
        data: geofences,
        count: geofences.length,
      });
    } catch (error) {
      logger.error("Error getting service request geofences:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to get service request geofences",
      });
    }
  }
);

export default router;
