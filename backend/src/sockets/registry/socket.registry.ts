// src/sockets/registry/socket.registry.ts

import {
    AuthenticatedSocket,
    AuthenticatedSocketUser,
} from "../types.js";

class SocketRegistry {
    private readonly driverSockets = new Map<
        string,
        Set<AuthenticatedSocket>
    >();

    private readonly riderSockets = new Map<
        string,
        Set<AuthenticatedSocket>
    >();

    private readonly socketUsers = new Map<
        AuthenticatedSocket,
        AuthenticatedSocketUser
    >();

    register(socket: AuthenticatedSocket): void {
        const { userId, role, driverId } = socket.user;

        this.socketUsers.set(socket, socket.user);

        if (role === "DRIVER" && driverId) {
            let sockets = this.driverSockets.get(driverId);

            if (!sockets) {
                sockets = new Set();
                this.driverSockets.set(driverId, sockets);
            }

            sockets.add(socket);

            return;
        }

        if (role === "RIDER") {
            let sockets = this.riderSockets.get(userId);

            if (!sockets) {
                sockets = new Set();
                this.riderSockets.set(userId, sockets);
            }

            sockets.add(socket);
        }
    }

    unregister(socket: AuthenticatedSocket): void {
        const user = this.socketUsers.get(socket);

        if (!user) return;

        this.socketUsers.delete(socket);

        if (user.role === "DRIVER" && user.driverId) {
            const sockets = this.driverSockets.get(user.driverId);

            if (!sockets) return;

            sockets.delete(socket);

            if (sockets.size === 0) {
                this.driverSockets.delete(user.driverId);
            }

            return;
        }

        if (user.role === "RIDER") {
            const sockets = this.riderSockets.get(user.userId);

            if (!sockets) return;

            sockets.delete(socket);

            if (sockets.size === 0) {
                this.riderSockets.delete(user.userId);
            }
        }
    }

    getDriverSockets(
        driverId: string
    ): Set<AuthenticatedSocket> | undefined {
        return this.driverSockets.get(driverId);
    }

    getRiderSockets(
        riderId: string
    ): Set<AuthenticatedSocket> | undefined {
        return this.riderSockets.get(riderId);
    }

    getUser(
        socket: AuthenticatedSocket
    ): AuthenticatedSocketUser | undefined {
        return this.socketUsers.get(socket);
    }

    isDriverOnline(driverId: string): boolean {
        return this.driverSockets.has(driverId);
    }

    isRiderOnline(riderId: string): boolean {
        return this.riderSockets.has(riderId);
    }

    getConnectedDriversCount(): number {
        return this.driverSockets.size;
    }

    getConnectedRidersCount(): number {
        return this.riderSockets.size;
    }

    getTotalConnectedSockets(): number {
        return this.socketUsers.size;
    }

    broadcast(message: string): void {
        for (const socket of this.socketUsers.keys()) {
            if (socket.readyState === socket.OPEN) {
                socket.send(message);
            }
        }
    }
    disconnectDriver(driverId: string): void {

        const sockets =
            this.driverSockets.get(driverId);

        if (!sockets) {
            return;
        }

        for (const socket of sockets) {
            socket.close();
        }

    }

    disconnectRider(riderId: string): void {

        const sockets =
            this.riderSockets.get(riderId);

        if (!sockets) {
            return;
        }

        for (const socket of sockets) {
            socket.close();
        }

    }
}

export const socketRegistry = new SocketRegistry();