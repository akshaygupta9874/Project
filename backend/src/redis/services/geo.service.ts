import { redisClient } from "../client.js";

const DRIVER_LOCATION_KEY = "drivers:geo";

import { NearbyDriver } from "../types.js";

function assertValidCoords(latitude: number, longitude: number): void {
    if (latitude < -90 || latitude > 90) {
        throw new Error(`Invalid latitude: ${latitude}`);
    }
    if (longitude < -180 || longitude > 180) {
        throw new Error(`Invalid longitude: ${longitude}`);
    }
}

export async function updateDriverLocation(
    driverId: string,
    latitude: number,
    longitude: number
): Promise<void> {
    assertValidCoords(latitude, longitude);

    try {
        await redisClient.geoAdd(DRIVER_LOCATION_KEY, {
            member: driverId,
            longitude,
            latitude,
        });
    } catch (err) {
        throw new Error(`Failed to update location for driver ${driverId}: ${err}`);
    }
}

export async function findNearbyDrivers(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
    count: number = 20
): Promise<NearbyDriver[]> {
    assertValidCoords(latitude, longitude);

    try {
        const results = await redisClient.geoSearchWith(
            DRIVER_LOCATION_KEY,
            { latitude, longitude },
            { radius: radiusKm, unit: "km" },
            ["WITHCOORD", "WITHDIST"],
            { SORT: "ASC", COUNT: count }
        );

        return results.map((entry) => ({
            driverId: entry.member as string,
            distanceInKm: Number(entry.distance),
            latitude: Number(entry.coordinates!.latitude),
            longitude: Number(entry.coordinates!.longitude),
        }));
    } catch (err) {
        throw new Error(`Failed to search nearby drivers: ${err}`);
    }
}

export async function removeDriverLocation(driverId: string): Promise<void> {
    try {
        await redisClient.zRem(DRIVER_LOCATION_KEY, driverId);
    } catch (err) {
        throw new Error(`Failed to remove location for driver ${driverId}: ${err}`);
    }
}

export async function getDriverLocation(
    driverId: string
): Promise<{ latitude: number; longitude: number } | null> {
    try {
        const [position] = await redisClient.geoPos(DRIVER_LOCATION_KEY, driverId);

        if (!position) {
            return null;
        }
        return {
            latitude: Number(position.latitude),
            longitude: Number(position.longitude),
        };
    } catch (err) {
        throw new Error(`Failed to get location for driver ${driverId}: ${err}`);
    }
}