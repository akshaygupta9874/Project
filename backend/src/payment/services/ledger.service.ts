import mongoose, { ClientSession, Types } from "mongoose";
import { randomUUID } from "crypto";

import { ledgerRepository } from "../repositories/ledger.repository.js";

import { AppError } from "../../utils/AppError.js";

import { RecordLedgerTransactionInput } from "../types/payment.dto.js";

import {
    LedgerAccount,
    LedgerEntryType,
    LedgerReferenceType,
    CurrencyType,
} from "../types/payment.types.js";

import { CURRENCY } from "../constants/payment.constants.js";

const opposite = (
    type: LedgerEntryType
): LedgerEntryType =>
    type === LedgerEntryType.DEBIT
        ? LedgerEntryType.CREDIT
        : LedgerEntryType.DEBIT;

class LedgerService {

    /**
     * Posts one atomic, balanced transaction (2+ legs). Every call is validated
     * so that sum(debits) === sum(credits) before anything touches the
     * database — an unbalanced posting is a programming error, not a business
     * exception, so this throws rather than returning a result object.
     *
     * If `session` is provided, entries are written inside the caller's
     * transaction (e.g. alongside a Payment status update) so both commit or
     * roll back together. If omitted, this method opens and commits its own
     * transaction — fine for standalone postings like a scheduled adjustment.
     */
    async recordTransaction(
        input: RecordLedgerTransactionInput,
        session?: ClientSession
    ): Promise<string> {

        const {
            entries,
            referenceType,
            referenceId,
            metadata = {},
        } = input;

        const currency: CurrencyType =
            input.currency ?? CURRENCY.INR;

        if (entries.length < 2) {
            throw new AppError(
                "A ledger transaction requires at least two legs",
                500,
                "LEDGER_UNBALANCED"
            );
        }

        for (const entry of entries) {

            if (
                !Number.isInteger(entry.amountPaise) ||
                entry.amountPaise <= 0
            ) {

                throw new AppError(
                    `Ledger leg for ${entry.account} must be a positive integer paise amount`,
                    500,
                    "LEDGER_INVALID_AMOUNT"
                );

            }

        }

        const totalDebit =
            entries
                .filter(
                    (entry) =>
                        entry.entryType ===
                        LedgerEntryType.DEBIT
                )
                .reduce(
                    (sum, entry) =>
                        sum + entry.amountPaise,
                    0
                );

        const totalCredit =
            entries
                .filter(
                    (entry) =>
                        entry.entryType ===
                        LedgerEntryType.CREDIT
                )
                .reduce(
                    (sum, entry) =>
                        sum + entry.amountPaise,
                    0
                );

        if (totalDebit !== totalCredit) {

            throw new AppError(
                `Unbalanced ledger transaction: debits=${totalDebit} credits=${totalCredit}`,
                500,
                "LEDGER_UNBALANCED"
            );

        }

        const transactionId = randomUUID();

        const rows = entries.map((entry) => ({
            transactionId,

            account: entry.account,

            entryType: entry.entryType,

            amountPaise: entry.amountPaise,

            currency,

            referenceType,

            referenceId, // CHANGED: Uses ObjectId from DTO.

            description: entry.description,

            metadata,
        }));

        if (session) {

            await ledgerRepository.insertEntries(
                rows,
                session
            );

            return transactionId;

        }

        const ownSession =
            await mongoose.startSession();

        try {

            await ownSession.withTransaction(
                async () => {

                    await ledgerRepository.insertEntries(
                        rows,
                        ownSession
                    );

                }
            );

            return transactionId;

        } finally {

            await ownSession.endSession();

        }

    }

    /**
     * Reverses a fraction (1.0 for a full reversal) of a previously posted
     * transaction by mirroring every leg with debit/credit swapped and the
     * amount scaled. Used for refunds and payout failures — the ledger is
     * never edited in place, only ever corrected forward.
     *
     * Rounding: scaling paise amounts by a fraction can leave a 1-2 paise
     * remainder across legs due to integer truncation. The remainder is
     * assigned to the largest leg so the reversal still balances exactly.
     */
    async reverseTransactionPartial(
        originalTransactionId: string,
        fraction: number,
        referenceType: LedgerReferenceType,
        referenceId: Types.ObjectId, // CHANGED: ObjectId instead of string.
        reason: string,
        session?: ClientSession
    ): Promise<string> {

        if (fraction <= 0 || fraction > 1) {

            throw new AppError(
                "Reversal fraction must be in (0, 1]",
                500,
                "LEDGER_INVALID_FRACTION"
            );

        }

        const originalEntries =
            await ledgerRepository.findByTransactionId(
                originalTransactionId
            );

        if (originalEntries.length === 0) {

            throw new AppError(
                `No ledger entries found for transaction ${originalTransactionId}`,
                404,
                "LEDGER_TRANSACTION_NOT_FOUND"
            );

        }

        const scaled =
            originalEntries.map((entry) => ({

                account: entry.account as LedgerAccount,

                entryType:
                    entry.entryType as LedgerEntryType,

                amountPaise: Math.floor(
                    entry.amountPaise * fraction
                ),

                description:
                    `Reversal (${reason}) of ${originalTransactionId}: ${entry.description}`,

            }));

        // Distribute integer-division remainder to the largest leg so the total
        // reversed amount matches fraction * original exactly, per side.

        const applyRemainder = (
            side: LedgerEntryType
        ) => {

            const legs =
                scaled.filter(
                    (entry) =>
                        entry.entryType === side
                );

            const originalSideTotal =
                originalEntries
                    .filter(
                        (entry) =>
                            entry.entryType === side
                    )
                    .reduce(
                        (sum, entry) =>
                            sum + entry.amountPaise,
                        0
                    );

            const targetTotal =
                Math.round(
                    originalSideTotal * fraction
                );

            const scaledTotal =
                legs.reduce(
                    (sum, entry) =>
                        sum + entry.amountPaise,
                    0
                );

            const remainder =
                targetTotal - scaledTotal;

            if (
                remainder !== 0 &&
                legs.length > 0
            ) {

                const largest =
                    legs.reduce(
                        (a, b) =>
                            a.amountPaise >=
                            b.amountPaise
                                ? a
                                : b
                    );

                largest.amountPaise +=
                    remainder;

            }

        };

        applyRemainder(
            LedgerEntryType.DEBIT
        );

        applyRemainder(
            LedgerEntryType.CREDIT
        );

        const reversedEntries =
            scaled
                .filter(
                    (entry) =>
                        entry.amountPaise > 0
                )
                .map((entry) => ({

                    account: entry.account,

                    entryType: opposite(
                        entry.entryType
                    ),

                    amountPaise:
                        entry.amountPaise,

                    description:
                        entry.description,

                }));

        return this.recordTransaction(
            {
                entries: reversedEntries,

                referenceType,

                referenceId,

                metadata: {
                    reversalOf:
                        originalTransactionId,
                    reason,
                },
            },
            session
        );

    }

    // REMOVED: getAccountBalance()
    // REMOVED: LedgerAccountNature
    // REMOVED: LEDGER_ACCOUNT_NATURE
    // REASON: Current simplified payment module no longer classifies
    // ledger accounts as Asset/Liability/Revenue. If balance reporting
    // is needed later, it can be implemented in a reporting service.

}

export const ledgerService =
    new LedgerService();