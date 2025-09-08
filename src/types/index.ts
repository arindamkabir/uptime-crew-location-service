export interface LocationData {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: Date;
  speed?: number;
  heading?: number;
}

export interface Geofence {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  radius: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface GeofenceEvent {
  type: "entry" | "exit" | "location_update";
  geofence_id: string;
  geofence_name: string;
  user_id: string;
  timestamp: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface User {
  id: string;
  name: string;
  roles?: string[];
}

export interface ConnectedUser {
  id: string;
  name: string;
  roles?: string[];
  connectedAt: Date;
}

export interface LocationHistoryEntry extends LocationData {
  id: string;
  updated_at: Date;
}
