import { z } from "zod";

export const UpdateDriverLocationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
});

export type UpdateDriverLocationInput =
    z.infer<typeof UpdateDriverLocationSchema>;


export const DriverHeartbeatSchema = z.object({});
export const DriverAvailabilitySchema = z.object({
    available: z.boolean(),
});

export const RideActionSchema = z.object({
    rideId: z.string().min(1),
});

export const RideCancelSchema = z.object({
    rideId: z.string().min(1),
    reason : z.string().min(1)
});