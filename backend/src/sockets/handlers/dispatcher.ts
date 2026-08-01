import { AuthenticatedSocket } from "../types.js";
import { SocketMessageSchema } from "../validators/socket.validator.js";

import { sendSocketError } from "../utils/send-error.js";

import { DriverEvents, RiderEvents, type DriverEvent, type RiderEvent } from "../event.constants.js";

import { handleDriverEvent } from "./driver.handler.js";
import { handleRiderEvent } from "./rider.handler.js";

export function registerDispatcher(
    socket: AuthenticatedSocket
): void {

    socket.on("message", async (buffer) => {

        try {

            const parsed = JSON.parse(buffer.toString());

            const result = SocketMessageSchema.safeParse(parsed);

            if (!result.success) {
                sendSocketError(socket, "Invalid WebSocket message.");
                return;
            }

            const { event, data } = result.data;

            if (Object.values(DriverEvents).includes(event as DriverEvent)) {
                await handleDriverEvent(socket, event as DriverEvent, data);
                return;
            }

            if (Object.values(RiderEvents).includes(event as RiderEvent)) {
                await handleRiderEvent(socket, event as RiderEvent, data);
                return;
            }


            sendSocketError(socket, "Unknown event.");

        } catch (error) {

            console.error(error);
            sendSocketError(socket, "Invalid WebSocket message.");

        }

    });

}