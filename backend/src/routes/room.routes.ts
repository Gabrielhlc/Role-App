import { Router, type Response } from "express";
import { prisma } from "../config/db.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middlewares/auth.middleware.js";
import { LocationService } from "../services/locationService.js";
import { logger } from "../libs/logger.ts";

const router = Router();

router.use(requireAuth);

function generateRoomCode(length = 4): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

router.post(
  "/create",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { name } = req.body;

    const hostId = req.user?.userId;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "O nome do evento é obrigatório." });
    }

    // caso o middleware passe sem o userId por alguma loucura
    if (!hostId) {
      return res
        .status(401)
        .json({ error: "Usuário não identificado. Autenticação necessária." });
    }

    try {
      let code = generateRoomCode();
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 5) {
        const existingRoom = await prisma.room.findUnique({
          where: { code },
        });

        if (!existingRoom) {
          isUnique = true;
        } else {
          code = generateRoomCode();
          attempts++;
        }
      }

      if (!isUnique) {
        return res.status(500).json({
          error:
            "Não foi possível gerar um código de sala exclusivo. Tente novamente.",
        });
      }

      const newRoom = await prisma.room.create({
        data: {
          name: name.trim(),
          code: code,
          hostId: hostId,
          status: "active",
          participants: {
            create: {
              userId: hostId,
            },
          },
        },

        include: {
          host: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      return res.status(201).json(newRoom);
    } catch (error) {
      console.error("Erro na criação de sala no Prisma:", error);
      return res
        .status(500)
        .json({ error: "Erro interno do servidor ao criar a sala." });
    }
  },
);

router.get(
  "/my-rooms",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    try {
      const rooms = await prisma.room.findMany({
        where: {
          OR: [{ hostId: userId }, { participants: { some: { userId } } }],
        },
        select: {
          id: true,
          code: true,
          name: true,
          hostId: true,
          createdAt: true,
          _count: {
            select: { participants: true },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.status(200).json(rooms);
    } catch (error) {
      console.error("Erro ao buscar salas do usuário:", error);
      return res
        .status(500)
        .json({ error: "Erro interno ao buscar as salas." });
    }
  },
);

router.get(
  "/:id/participants",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (typeof id !== "string") {
      return res.status(400).json({ error: "ID de sala inválido." });
    }

    try {
      const room = await prisma.room.findUnique({
        where: { id },
        select: { hostId: true },
      });

      if (!room) {
        return res.status(404).json({ error: "Sala não encontrada." });
      }

      const roomParticipants = await prisma.roomParticipant.findMany({
        where: { roomId: id },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      });

      const participants = roomParticipants.map((p) => ({
        id: p.user.id,
        username: p.user.username,
        avatarUrl: p.user.avatarUrl,
        isHost: p.user.id === room.hostId,
      }));

      return res.status(200).json(participants);
    } catch (error) {
      console.error("Erro ao buscar participantes:", error);
      return res
        .status(500)
        .json({ error: "Erro interno ao buscar participantes." });
    }
  },
);

router.post(
  "/:id/join",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res
        .status(401)
        .json({ error: "Usuário não identificado. Autenticação necessária." });
    }

    if (typeof id !== "string") {
      return res.status(400).json({ error: "ID de sala inválido." });
    }

    try {
      const room = await prisma.room.findUnique({
        where: { id },
      });

      if (!room) {
        return res.status(404).json({ error: "Sala não encontrada." });
      }

      const existingParticipant = await prisma.roomParticipant.findFirst({
        where: {
          roomId: id,
          userId: userId,
        },
      });

      if (!existingParticipant) {
        console.log("CRIANDO O USUÁRIO DENTRO DA SALA");
        await prisma.roomParticipant.create({
          data: {
            roomId: id,
            userId: userId,
          },
        });
      }

      // Retorna os dados atualizados da sala com a lista de participantes e informações do Host
      const roomDetails = await prisma.room.findUnique({
        where: { id },
        include: {
          host: {
            select: { id: true, username: true, email: true, avatarUrl: true },
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      return res.status(200).json(roomDetails);
    } catch (error) {
      console.error("Erro ao entrar na sala:", error);
      return res
        .status(500)
        .json({ error: "Erro interno ao registrar entrada na sala." });
    }
  },
);

router.post(
  "/:id/location",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: roomId } = req.params;
    const { latitude, longitude, username, avatarUrl } = req.body;
    const userId = req.user?.userId;

    if (!userId || !latitude || !longitude) {
      return res
        .status(400)
        .json({ error: "Dados de localização incompletos." });
    }

    if (typeof roomId !== "string") {
      return res.status(400).json({ error: "Dados de localização inválidos." });
    }

    const payload = {
      userId,
      username: username || "Participante",
      avatarUrl,
      latitude,
      longitude,
      updatedAt: Date.now(),
    };

    await LocationService.updateLocation(roomId, payload);

    logger.info({
      event: "LOCATION_PING",
      source: "HTTP_BACKGROUND",
      roomId,
      userId,
      latitude,
      longitude,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`room_${roomId}`).emit("user_location_updated", payload);
      console.log(
        `[SOCKET EMIT] Posição repassada para o canal: room_${roomId}`,
      );
    } else {
      console.error("ERRO: Instância do io não encontrada no Express.");
    }

    return res.status(200).json({ success: true });
  },
);

export default router;
