// getPresence()

// savePresence()

// setDriverOnline()

// setDriverOffline()

// updateDriverHeartbeat()

// setDriverAvailable()

// setDriverBusy()

// isDriverOnline()

// isDriverAvailable()

// getDriverPresence()
import { redisClient } from "../client.js";
import { RedisKeys } from "../keys.js";

import type {
    DriverPresence,
} from "../types.js";

// ======================================================
// Constants
// ======================================================

const DRIVER_PRESENCE_TTL_SECONDS = 60;

// ======================================================
// Internal Helpers
// ======================================================

/**
 * Fetch driver's current presence.
 */
async function getPresence(
    driverId: string
): Promise<DriverPresence | null> {

    const data = await redisClient.get(
        RedisKeys.DRIVER_PRESENCE(driverId)
    );

    if (!data) {
        return null;
    }

    try {

        return JSON.parse(data) as DriverPresence;

    } catch {

        return null;

    }

}

/**
 * Returns an existing presence or creates a default one.
 */
async function ensurePresence(
    driverId: string
): Promise<DriverPresence> {

    const presence =
        await getPresence(driverId);

    if (presence) {
        return presence;
    }

    return {
        online: false,
        available: false,
        lastSeen: Date.now(),
    };

}

/**
 * Save presence and refresh TTL.
 */
async function savePresence(
    driverId: string,
    presence: DriverPresence
): Promise<void> {

    await redisClient.set(
        RedisKeys.DRIVER_PRESENCE(driverId),
        JSON.stringify(presence),
        {
            EX: DRIVER_PRESENCE_TTL_SECONDS,
        }
    );

}

// ======================================================
// Driver Online / Offline
// ======================================================

/**
 * Called after successful socket authentication.
 */
export async function setDriverOnline(
    driverId: string
): Promise<void> {

    const presence =
        await ensurePresence(driverId);

    presence.online = true;
    presence.lastSeen = Date.now();

    await savePresence(
        driverId,
        presence
    );

}

/**
 * Called when socket disconnects.
 */
export async function setDriverOffline(
    driverId: string
): Promise<void> {

    await redisClient.del(RedisKeys.DRIVER_PRESENCE(driverId))

}

/**
 * Refresh heartbeat timestamp.
 */
export async function updateDriverHeartbeat(
    driverId: string
): Promise<void> {

    const presence =
        await getPresence(driverId);
    if(!presence){
        return;
    }

    presence.lastSeen = Date.now();

    await savePresence(
        driverId,
        presence
    );

}
// ======================================================
// Driver Availability
// ======================================================

/**
 * Mark driver as available to receive ride requests.
 * Usually called after completing or cancelling a ride.
 */
export async function setDriverAvailable(
    driverId: string
): Promise<void> {

    const presence =
        await ensurePresence(driverId);

    presence.available = true;
    presence.lastSeen = Date.now();

    await savePresence(
        driverId,
        presence
    );

}

/**
 * Mark driver as busy.
 * Usually called immediately after accepting a ride.
 */
export async function setDriverBusy(
    driverId: string
): Promise<void> {

    const presence =
        await ensurePresence(driverId);

    presence.available = false;
    presence.lastSeen = Date.now();

    await savePresence(
        driverId,
        presence
    );

}

// ======================================================
// Queries
// ======================================================

/**
 * Returns true if the driver is currently online.
 */
export async function isDriverOnline(
    driverId: string
): Promise<boolean> {

    const presence =
        await getPresence(driverId);

    if (!presence) {
        return false;
    }

    return presence.online;

}

/**
 * Returns true if the driver is online
 * and available for new rides.
 */
export async function isDriverAvailable(
    driverId: string
): Promise<boolean> {

    const presence =
        await getPresence(driverId);

    if (!presence) {
        return false;
    }

    return (
        presence.online &&
        presence.available
    );

}

/**
 * Returns the complete driver presence object.
 */
export async function getDriverPresence(
    driverId: string
): Promise<DriverPresence | null> {

    return getPresence(
        driverId
    );

}