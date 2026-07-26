import { AuthenticatedSocket } from "../types.js";
import { sendSocketError } from "../utils/send-error.js";

export type RiderEventHandler = (
    socket: AuthenticatedSocket,
    data: unknown
) => Promise<void>;

const handlers: Record<string, RiderEventHandler> = {
    // Add rider events here later
};

export async function handleRiderEvent(
    socket: AuthenticatedSocket,
    event: string,
    data: unknown
): Promise<void> {

    const handler = handlers[event];

    if (!handler) {
        sendSocketError(socket, "Unknown rider event.");
        return;
    }

    await handler(socket, data);
}