import { IRide } from "../models/ride.model.js";

import { IFareBreakdown } from "../payment/types/payment.types.js";

const PLATFORM_COMMISSION_PERCENT = 20;

class FareService {

    calculateFinalFare(
        ride: IRide
    ): IFareBreakdown {

        const totalPaise =
            ride.fare.final ??
            ride.fare.estimated;

        const baseFarePaise =
            totalPaise;

        const distanceFarePaise =
            0;

        const timeFarePaise =
            0;

        const surgePaise =
            0;

        const platformCommissionPaise =
            Math.round(
                totalPaise *
                (PLATFORM_COMMISSION_PERCENT / 100)
            );

        const driverEarningPaise =
            totalPaise -
            platformCommissionPaise;

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

export const fareService =
    new FareService();