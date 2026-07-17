import { AuthenticatedSocket } from "../types.js";
import { UserRole } from "../../models/user.model.js";

import { registerDriverHandlers } from "./driver.handler.js";

export function registerSocketHandlers(
    socket: AuthenticatedSocket
): void {

    console.log("Socket Role:", socket.user.role);
console.log("User:", socket.user);

    switch (socket.user.role) {

        case UserRole.DRIVER:

            registerDriverHandlers(socket);

            break;

        case UserRole.RIDER:

            // Rider currently doesn't send any
            // socket events to the server.
            break;

        case UserRole.ADMIN:

            // Future:
            // registerAdminHandlers(socket);

            break;

        default:

            socket.close();

    }

}