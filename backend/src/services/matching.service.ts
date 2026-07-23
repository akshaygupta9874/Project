// src/services/matching.service.ts

import { findNearbyDrivers } from "../redis/services/geo.service.js";
import { isDriverAvailable } from "../redis/services/driver-presence.service.js";
import type { NearbyDriver } from "../redis/types.js";

export async function findEligibleDrivers(
    latitude: number,
    longitude: number,
    radiusKm: number = 50000,
    count: number = 20
): Promise<NearbyDriver[]> {

    const nearbyDrivers = await findNearbyDrivers(
        latitude,
        longitude,
        radiusKm,
        count
    );

    const eligibleDrivers: NearbyDriver[] = [];

    for (const driver of nearbyDrivers) {

        const available = await isDriverAvailable(
            driver.driverId
        );

        if (!available) {
            continue;
        }

        eligibleDrivers.push(driver);
    }

    return eligibleDrivers;
}