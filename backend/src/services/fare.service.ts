import { IRide } from "../models/ride.model.js";

import { IFareBreakdown } from "../payment/types/payment.types.js";

const PLATFORM_COMMISSION_PERCENT = 20;

class FareService {

    calculateFinalFare(
        ride: IRide
    ): IFareBreakdown {
;

        const baseFarePaise =
           ride.fare.breakdown?.baseFarePaise ?? 0 ;

        const distanceFarePaise = ride.fare.breakdown?.distanceFarePaise ?? 0 ;

        const timeFarePaise = ride.fare.breakdown?.timeFarePaise ?? 0 ;

        const surgePaise = ride.fare.breakdown?.timeFarePaise ?? 0 ;

        const totalPaise = ride.fare.breakdown?.totalPaise ?? ride.fare.final ?? ride.fare.estimated;

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