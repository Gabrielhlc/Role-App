import { Server, Socket } from "socket.io";
import {
  LocationService,
  type UserLocationPayload,
} from "../services/locationService.ts";
import { redis } from "../libs/redis.ts";

export function setupLocationSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Novo cliente conectado: ${socket.id}`);

    // 1. Entrar na sala do Rolê
    socket.on(
      "join_room_map",
      async ({ roomId, userId }: { roomId: string; userId: string }) => {
        socket.join(`room_${roomId}`);
        (socket as any).currentRoomId = roomId;
        (socket as any).currentUserId = userId;
        console.log(`Usuário [${userId}] entrou na sala [${roomId}]`);

        // Envia o snapshot imediato de quem já está compartilhando
        const activeLocations = await LocationService.getRoomLocations(roomId);
        socket.emit("room_locations_snapshot", activeLocations);

        const savedDestination = await redis.get(`room:${roomId}:destination`);
        if (savedDestination) {
          socket.emit("room_destination_updated", JSON.parse(savedDestination));
        }
      },
    );

    // 2. Receber e repassar coordenada em tempo real (5s throttle no front)
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
        console.log(
          `Posição recebida de [${data.username}] para sala [${data.roomId}]`,
        );
        const payload: UserLocationPayload = {
          userId: data.userId,
          username: data.username,
          avatarUrl: data.avatarUrl,
          latitude: data.latitude,
          longitude: data.longitude,
          updatedAt: Date.now(),
        };

        // Salva no Redis
        await LocationService.updateLocation(data.roomId, payload);

        // Repassa para todos os outros participantes da sala
        socket.to(`room_${data.roomId}`).emit("user_location_updated", payload);
      },
    );

    // 3. Usuário clicou em "Pausar Compartilhamento"
    socket.on(
      "stop_sharing_location",
      async ({ roomId, userId }: { roomId: string; userId: string }) => {
        await LocationService.removeUserLocation(roomId, userId);
        socket.to(`room_${roomId}`).emit("user_stopped_sharing", { userId });
      },
    );

    // 4. Desconexão inesperada (fechou o app / perdeu rede)
    socket.on("disconnect", async () => {
      const roomId = (socket as any).currentRoomId;
      const userId = (socket as any).currentUserId;

      if (roomId && userId) {
        await LocationService.removeUserLocation(roomId, userId);
        socket.to(`room_${roomId}`).emit("user_stopped_sharing", { userId });
      }
      console.log(`[Socket] Cliente desconectado: ${socket.id}`);
    });

    socket.on("clear_room_destination", async ({ roomId }) => {
      try {
        // 1. Remove a chave do Redis
        await redis.del(`room:${roomId}:destination`);

        // 2. Avisa TODOS os membros da sala para sumirem com o marcador
        io.to(roomId).emit("room_destination_cleared");

        console.log(`[DESTINO] Destino da sala ${roomId} foi removido.`);
      } catch (error) {
        console.error("Erro ao limpar destino da sala:", error);
      }
    });

    socket.on("set_room_destination", async ({ roomId, destination }) => {
      /*
    destination: {
      title: string;
      latitude: number;
      longitude: number;
      setBy: string;       
    }
  */
      await redis.set(
        `room:${roomId}:destination`,
        JSON.stringify(destination),
      );

      io.to(roomId).emit("room_destination_updated", destination);
    });
  });
}
