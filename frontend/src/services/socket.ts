import { io, Socket } from "socket.io-client";

const BACKEND_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:3333";

export const socket: Socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ["websocket"],
  timeout: 10000,
  reconnection: true,
  reconnectionAttempts: 5,
});
