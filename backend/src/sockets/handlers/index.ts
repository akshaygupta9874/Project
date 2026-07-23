import { AuthenticatedSocket } from "../types.js";
import { UserRole } from "../../models/user.model.js";

import { registerDriverHandlers } from "./driver.handler.js";
import { registerRiderHandlers } from "./rider.handler.js";

export function registerSocketHandlers(
    socket: AuthenticatedSocket
): void {

    console.log("Socket Role:", socket.user.role);
console.log("User:", socket.user);

if(socket.user.role.includes(UserRole.DRIVER)) {
    registerDriverHandlers(socket)
}
if(socket.user.role.includes(UserRole.RIDER)){
    registerRiderHandlers(socket)
}
//rest about rider would be implemented later bro pehle ye krlo
}