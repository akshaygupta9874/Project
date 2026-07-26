import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export const fareBreakdownSchema = z.object({
  baseFarePaise: z.number().int().nonnegative(),
  distanceFarePaise: z.number().int().nonnegative(),
  timeFarePaise: z.number().int().nonnegative(),
  surgePaise: z.number().int().nonnegative().default(0),
  platformCommissionPaise: z.number().int().nonnegative(),
  driverEarningPaise: z.number().int().nonnegative(),
  totalPaise: z.number().int().positive(),
});

export const createOrderSchema = z.object({
  body: z.object({
    rideId: z.string().min(1),
    driverId: z.string().min(1),
    fareBreakdown: fareBreakdownSchema,
    // Client can supply its own key to make retries safe; if omitted the
    // controller derives a deterministic one from rideId + riderId.
    idempotencyKey: z.string().min(8).optional(),
  }),
});

export const verifyCheckoutSchema = z.object({
  body: z.object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  }),
});

export const refundSchema = z.object({
  body: z.object({
    amountPaise: z.number().int().positive().optional(),
    reason: z.string().min(3).max(500),
  }),
});

export const paymentIdParamSchema = z.object({
  params: z.object({ paymentId: z.string().min(1) }),
});

export const rideIdParamSchema = z.object({
  params: z.object({ rideId: z.string().min(1) }),
});

export const listPaymentsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.string().optional(),
  }),
});

/**
 * Validates req.{body,params,query} against a schema shaped as
 * { body?, params?, query? }. Replaces each validated section with the
 * parsed (and coerced/defaulted) value so downstream handlers get clean data.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) {
      res.status(422).json({
        message: 'Validation failed',
        errors: result.error.flatten(),
      });
      return;
    }
    const parsed = result.data as { body?: unknown; params?: unknown; query?: unknown };
    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.params !== undefined) req.params = parsed.params as typeof req.params;
    if (parsed.query !== undefined) req.query = parsed.query as typeof req.query;

    next();
  };
}
