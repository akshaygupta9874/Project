export const RedisKeys = {
    DRIVER_LOCATIONS: "driver:locations",
        DRIVER_GEO: "drivers:geo",

    DRIVER_PRESENCE: (driverId: string) =>
        `driver:presence:${driverId}`,
    RIDER_PRESENCE: "rider:presence",
    ACTIVE_RIDES: "active:rides",
} as const;