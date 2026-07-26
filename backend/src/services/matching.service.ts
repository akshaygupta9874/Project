// src/services/matching.service.ts

import { findNearbyDrivers } from "../redis/services/geo.service.js";
import { isDriverAvailable } from "../redis/services/driver-presence.service.js";
import { DriverModel } from "../models/driver.model.js";
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

        const currentDriver = await DriverModel.findById(
            driver.driverId
        ).select("currentRide").lean();

        if (currentDriver?.currentRide) {
            continue;
        }

        eligibleDrivers.push(driver);
    }

    return eligibleDrivers;
}