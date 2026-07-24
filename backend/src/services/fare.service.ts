import { IRide } from "../models/ride.model.js";
import { IFareBreakdown } from "../payment/types/payment.types.js";

const PLATFORM_COMMISSION_PERCENT = 20;

const VEHICLE_MULTIPLIERS: Record<string, number> = {
    bike: 0.7,
    auto: 0.9,
    car: 1.2,
};

class FareService {
    calculateFinalFare(
        ride: IRide,
        vehicleType?: string
    ): IFareBreakdown {
        // Resolve vehicle type from parameter, ride property, or fallback to car (1.0x)
        const resolvedVehicleType = vehicleType || (ride as any).vehicleType || "car";
        const multiplier = VEHICLE_MULTIPLIERS[resolvedVehicleType.toLowerCase()] ?? 1.0;

        const baseFarePaise = Math.round(
            (ride.fare.breakdown?.baseFarePaise ?? 0) * multiplier
        );

        const distanceFarePaise = Math.round(
            (ride.fare.breakdown?.distanceFarePaise ?? 0) * multiplier
        );

        const timeFarePaise = Math.round(
            (ride.fare.breakdown?.timeFarePaise ?? 0) * multiplier
        );

        const surgePaise = Math.round(
            (ride.fare.breakdown?.surgePaise ?? 0) * multiplier
        );

        const rawTotal =
            ride.fare.breakdown?.totalPaise ?? ride.fare.final ?? ride.fare.estimated ?? 0;

        // Calculate total based on components if available, otherwise apply multiplier to estimated total
        const totalPaise = (baseFarePaise || distanceFarePaise || timeFarePaise)
            ? (baseFarePaise + distanceFarePaise + timeFarePaise + surgePaise)
            : Math.round(rawTotal * multiplier);

        const platformCommissionPaise = Math.round(
            totalPaise * (PLATFORM_COMMISSION_PERCENT / 100)
        );

        const driverEarningPaise = totalPaise - platformCommissionPaise;

        return {
            baseFarePaise,
            distanceFarePaise,
            timeFarePaise,
            surgePaise,
            platformCommissionPaise,
            driverEarningPaise,
            totalPaise,
        };
    }
}

export const fareService = new FareService();