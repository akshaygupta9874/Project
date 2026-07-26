import { ClientSession, Types } from "mongoose";

import { PaymentModel } from "../models/payment.model.js";

import { IPayment } from "../types/payment.models.js";

import { PaymentStatus } from "../types/payment.types.js";

import { AppError } from "../../utils/AppError.js"; // ADDED: Better than generic Error.

// ============================================================================

export interface ListPaymentsFilter {
    rider?: string;

    driver?: string;

    ride?: string;

    status?: PaymentStatus;
}

export interface ListPaymentsOptions {
    page?: number;

    limit?: number;
}

// ============================================================================

class PaymentRepository {

    async create(
        data: Partial<IPayment>,
        session?: ClientSession
    ): Promise<IPayment> {

        const docs =
            await PaymentModel.create(
                [data],
                { session }
            );

        if (!docs[0]) {

            // CHANGED: Use AppError instead of generic Error.
            throw new AppError(
                "Failed to create payment.",
                500,
                "PAYMENT_CREATE_FAILED"
            );

        }

        return docs[0];

    }

    async findById(
        id: string,
        session?: ClientSession
    ): Promise<IPayment | null> {

        return PaymentModel.findById(id)
            .session(session ?? null)
            .exec();

    }

    async findByGatewayOrderId(
        gatewayOrderId: string,
        session?: ClientSession
    ): Promise<IPayment | null> {

        return PaymentModel.findOne({
            gatewayOrderId,
        })
            .session(session ?? null)
            .exec();

    }

    // ADDED: Frequently used after successful webhook verification.
    async findByGatewayPaymentId(
        gatewayPaymentId: string,
        session?: ClientSession
    ): Promise<IPayment | null> {

        return PaymentModel.findOne({
            gatewayPaymentId,
        })
            .session(session ?? null)
            .exec();

    }

    async findByIdempotencyKey(
        idempotencyKey: string,
        session?: ClientSession
    ): Promise<IPayment | null> {

        return PaymentModel.findOne({
            idempotencyKey,
        })
            .session(session ?? null)
            .exec();

    }

    async findByRide(
        ride: string,
        session?: ClientSession
    ): Promise<IPayment[]> {

        return PaymentModel.find({
            ride: new Types.ObjectId(ride),
        })
            .sort({
                createdAt: -1,
            })
            .session(session ?? null)
            .exec();

    }

    /**
     * Optimistic-ish status transition: only writes if the document is still in
     * `fromStatus`. Returns null if another writer already moved it — callers
     * use this to detect and short-circuit duplicate webhook deliveries.
     */
    async transitionStatus(
        paymentId: string,
        fromStatus: PaymentStatus,
        update: Partial<IPayment>,
        session?: ClientSession
    ): Promise<IPayment | null> {

        return PaymentModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(paymentId),
                status: fromStatus,
            },
            {
                $set: update,
            },
            {
                 returnDocument: "after",
                session,
            }
        ).exec();

    }

    async incrementAttempts(
        paymentId: string,
        session?: ClientSession
    ): Promise<void> {

        await PaymentModel.updateOne(
            {
                _id: new Types.ObjectId(paymentId),
            },
            {
                $inc: {
                    attemptNumber: 1,
                },
            },
            {
                session,
            }
        ).exec();

    }

    // ADDED: Useful for retries and reconciliation jobs.
    async update(
        paymentId: string,
        update: Partial<IPayment>,
        session?: ClientSession
    ): Promise<IPayment | null> {

        return PaymentModel.findByIdAndUpdate(
            paymentId,
            {
                $set: update,
            },
            {
                new: true,
                session,
            }
        ).exec();

    }

    async list(
        filter: ListPaymentsFilter,
        options: ListPaymentsOptions = {}
    ): Promise<{
        items: IPayment[];
        total: number;
        page: number;
        limit: number;
    }> {

        const page = Math.max(
            options.page ?? 1,
            1
        );

        const limit = Math.min(
            Math.max(
                options.limit ?? 20,
                1
            ),
            100
        );

        const query: Record<
            string,
            unknown
        > = {};

        if (filter.rider) {

            query.rider =
                new Types.ObjectId(
                    filter.rider
                );

        }

        if (filter.driver) {

            query.driver =
                new Types.ObjectId(
                    filter.driver
                );

        }

        if (filter.ride) {

            query.ride =
                new Types.ObjectId(
                    filter.ride
                );

        }

        if (filter.status) {

            query.status =
                filter.status;

        }

        const [
            items,
            total,
        ] = await Promise.all([

            PaymentModel.find(query)
                .sort({
                    createdAt: -1,
                })
                .skip(
                    (page - 1) * limit
                )
                .limit(limit)
                .exec(),

            PaymentModel.countDocuments(
                query
            ).exec(),

        ]);

        return {
            items,
            total,
            page,
            limit,
        };

    }

}

export const paymentRepository =
    new PaymentRepository();