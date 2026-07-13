import { AuthenticatedSocket } from "../types.js";
import { SocketMessageSchema } from "../validators/socket.validator.js";
import { sendSocketError } from "../utils/send-error.js";
import { socketRegistry } from "../registry/socket.registry.js";


export function registerRiderHandlers(
    socket: AuthenticatedSocket
): void {

    socket.on("message", async (buffer) => {

        try {

            const parsed = JSON.parse(
                buffer.toString()
            );

            const messageResult =
                SocketMessageSchema.safeParse(parsed);

            if (!messageResult.success) {

                sendSocketError(
                    socket,
                    "Invalid WebSocket message."
                );

                return;
            }

            const message =
                messageResult.data;

            switch (message.event) {

                default:

                    sendSocketError(
                        socket,
                        "Unknown event."
                    );

            }

        } catch (err) {

            sendSocketError(
                socket,
                "Invalid WebSocket message."
            );

        }

    });

}