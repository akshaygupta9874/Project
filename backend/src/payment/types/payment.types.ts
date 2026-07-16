// ============================================================================
// Money
// ============================================================================

/**
 * Every monetary value in the payment module is stored as
 * an integer number of paise.
 *
 * Example:
 * ₹499.99 = 49999
 *
 * Never use floating point numbers for money.
 */

export type Paise = number;
export type CurrencyType = "INR";

// ============================================================================
// Payment Gateway
// ============================================================================

export enum PaymentGateway {
    RAZORPAY = "RAZORPAY",
}

// ============================================================================
// Payment Method
// ============================================================================

export enum PaymentMethod {
    UPI = "UPI",
    CARD = "CARD",
    NETBANKING = "NETBANKING",
    WALLET = "WALLET",
    EMI = "EMI",
    UNKNOWN = "UNKNOWN",
}

// ============================================================================
// Payment Status
// ============================================================================

export enum PaymentStatus {
    CREATED = "CREATED",

    /**
     * Order has been created at the gateway.
     * Waiting for customer to complete payment.
     */
    PENDING = "PENDING",

    /**
     * Payment has been authorized by the bank
     * but not yet captured.
     */
    AUTHORIZED = "AUTHORIZED",

    /**
     * Payment successfully captured.
     */
    CAPTURED = "CAPTURED",

    FAILED = "FAILED",

    REFUNDED = "REFUNDED",

    PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",

    CANCELLED = "CANCELLED",
}

// ============================================================================
// Ledger
// ============================================================================

/**
 * Logical accounts used by the payment ledger.
 *
 * We intentionally keep this simple for now.
 * More accounts (wallet, tax, bank, etc.) can be added
 * later when those features are implemented.
 */
export enum LedgerAccount {
    RIDER = "RIDER",

    PLATFORM = "PLATFORM",

    DRIVER = "DRIVER",
}

export enum LedgerEntryType {
    DEBIT = "DEBIT",

    CREDIT = "CREDIT",
}

export enum LedgerReferenceType {
    PAYMENT = "PAYMENT",

    PAYOUT = "PAYOUT",

    REFUND = "REFUND",

    ADJUSTMENT = "ADJUSTMENT",
}

// ============================================================================
// Payout
// ============================================================================

export enum PayoutStatus {
    PENDING = "PENDING",

    PROCESSING = "PROCESSING",

    PROCESSED = "PROCESSED",

    FAILED = "FAILED",

    REVERSED = "REVERSED",

    CANCELLED = "CANCELLED",
}

export enum PayoutMode {
    IMPS = "IMPS",

    NEFT = "NEFT",

    RTGS = "RTGS",

    UPI = "UPI",
}

// ============================================================================
// Fare Breakdown
// ============================================================================

/**
 * The payment module never calculates fares.
 *
 * It simply receives a validated fare breakdown from
 * the ride/fare module.
 */
export interface IFareBreakdown {
    baseFarePaise: Paise;

    distanceFarePaise: Paise;

    timeFarePaise: Paise;

    surgePaise: Paise;

    platformCommissionPaise: Paise;

    driverEarningPaise: Paise;

    totalPaise: Paise;
}