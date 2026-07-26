import { AuthenticatedSocket } from "../types.js";
import { registerDispatcher } from "./dispatcher.js";

export function registerSocketHandlers(
    socket: AuthenticatedSocket
): void {
    registerDispatcher(socket);

}