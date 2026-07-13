// sockets/utils/send-error.ts

import { AuthenticatedSocket } from "../types.js";
import { ServerEvents } from "../event.constants.js";

export function sendSocketError(
    socket: AuthenticatedSocket,
    message: string
) {
    socket.send(
        JSON.stringify({
            event: ServerEvents.ERROR,
            data: {
                message,
            },
        })
    );
}