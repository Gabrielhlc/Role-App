import { Server, Socket } from "socket.io";
import {
  LocationService,
  type UserLocationPayload,
} from "../services/locationService.ts";
import { redis } from "../libs/redis.ts";
import { logger } from "../libs/logger.ts";

export function setupLocationSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    const connectedAt = Date.now();

    logger.info({
      event: "SOCKET_CONNECTED",
      socketId: socket.id,
      transport: socket.conn.transport.name,
    });

    socket.on(
      "join_room_map",
      async ({ roomId, userId }: { roomId: string; userId: string }) => {
        socket.join(`room_${roomId}`);
        (socket as any).currentRoomId = roomId;
        (socket as any).currentUserId = userId;

        logger.info({
          event: "ROOM_MAP_JOINED",
          socketId: socket.id,
          roomId,
          userId,
        });

        // Envia o snapshot imediato de quem já está compartilhando
        const activeLocations = await LocationService.getRoomLocations(roomId);
        socket.emit("room_locations_snapshot", activeLocations);

        const savedDestination = await redis.get(`room:${roomId}:destination`);
        if (savedDestination) {
          socket.emit("room_destination_updated", JSON.parse(savedDestination));
        }
      },
    );

    socket.on(
      "send_location",
      async (data: {
        roomId: string;
        userId: string;
        username: string;
        avatarUrl?: string;
        latitude: number;
        longitude: number;
      }) => {
        const payload: UserLocationPayload = {
          userId: data.userId,
          username: data.username,
          avatarUrl: data.avatarUrl,
          latitude: data.latitude,
          longitude: data.longitude,
          updatedAt: Date.now(),
        };

        await LocationService.updateLocation(data.roomId, payload);

        logger.info({
          event: "LOCATION_PING",
          source: "SOCKET_FOREGROUND",
          roomId: data.roomId,
          userId: data.userId,
          latitude: data.latitude,
          longitude: data.longitude,
        });

        socket.to(`room_${data.roomId}`).emit("user_location_updated", payload);
      },
    );

    // 3. Usuário clicou em "Pausar Compartilhamento"
    socket.on(
      "stop_sharing_location",
      async ({ roomId, userId }: { roomId: string; userId: string }) => {
        await LocationService.removeUserLocation(roomId, userId);

        logger.info({
          event: "LOCATION_SHARING_STOPPED",
          roomId,
          userId,
        });

        socket.to(`room_${roomId}`).emit("user_stopped_sharing", { userId });
      },
    );

    // 4. Desconexão inesperada (fechou o app / perdeu rede)
    socket.on("disconnect", async (reason) => {
      const roomId = (socket as any).currentRoomId;
      const userId = (socket as any).currentUserId;
      const sessionDurationSeconds = (
        (Date.now() - connectedAt) /
        1000
      ).toFixed(1);

      if (roomId && userId) {
        await LocationService.removeUserLocation(roomId, userId);
        socket.to(`room_${roomId}`).emit("user_stopped_sharing", { userId });
      }
      logger.warn({
        event: "SOCKET_DISCONNECTED",
        socketId: socket.id,
        userId: userId || null,
        roomId: roomId || null,
        reason,
        sessionDurationSeconds: Number(sessionDurationSeconds),
      });
    });

    socket.on("clear_room_destination", async ({ roomId }) => {
      try {
        await redis.del(`room:${roomId}:destination`);

        io.to(roomId).emit("room_destination_cleared");

        console.log(`[DESTINO] Destino da sala ${roomId} foi removido.`);
      } catch (error) {
        console.error("Erro ao limpar destino da sala:", error);
      }
    });

    socket.on("set_room_destination", async ({ roomId, destination }) => {
      await redis.set(
        `room:${roomId}:destination`,
        JSON.stringify(destination),
      );

      io.to(roomId).emit("room_destination_updated", destination);
    });
  });
}
