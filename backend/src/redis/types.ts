export interface Coordinates {
    latitude: number;
    longitude: number;
}

export interface NearbyDriver {
    driverId: string;
    latitude: number;
    longitude: number;
    distanceInKm: number;
}

export interface DriverPresence {
    available: boolean;
    lastSeen: number;
    online : boolean;
}