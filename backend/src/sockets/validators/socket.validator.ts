// src/validators/socket.validator.ts

import { z } from "zod";

export const SocketMessageSchema = z.object({
    event: z.string().min(1),
    data: z.unknown(),
});

export type SocketMessageSchemaType =
    z.infer<typeof SocketMessageSchema>;