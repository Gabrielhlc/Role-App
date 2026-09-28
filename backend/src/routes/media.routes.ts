import { Router } from "express";
import { prisma } from "../config/db.js";
import {
  generatePresignedUploadUrl,
  generatePresignedViewUrl,
} from "../services/s3.ts";
import { io } from "../server.ts";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.ts";
import { logger } from "../libs/logger.ts";
import { redis } from "../libs/redis.ts";

export const mediaRoutes = Router();

// 1. Pede a URL de Upload
mediaRoutes.post(
  "/rooms/:roomId/media/upload-url",
  async (req: AuthenticatedRequest, res) => {
    const { roomId } = req.params;
    const { mimeType, extension, fileSize } = req.body;
    const userId = req.user?.userId || req.body.userId;

    if (typeof roomId !== "string") {
      return res.status(400).json({ error: "roomId inválido." });
    }

    if (!mimeType || !extension) {
      return res
        .status(400)
        .json({ error: "mimeType e extension são obrigatórios." });
    }

    // Validação de segurança de tamanho (20MB imagens, 100MB vídeos)
    const isVideo = mimeType.startsWith("video/");
    const maxBytes = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (fileSize && fileSize > maxBytes) {
      return res
        .status(400)
        .json({ error: "O arquivo excede o tamanho limite permitido." });
    }

    try {
      const { uploadUrl, s3Key, mediaId } = await generatePresignedUploadUrl({
        roomId,
        userId,
        mimeType,
        extension,
      });

      await redis.set(`upload_timer:${s3Key}`, Date.now(), "EX", 600);

      logger.info({
        event: "MEDIA_UPLOAD_REQUESTED",
        roomId,
        userId,
        s3Key,
        mimeType,
      });

      return res.json({
        uploadUrl,
        s3Key,
        mediaId,
      });
    } catch (error) {
      console.error("Erro ao gerar URL do S3:", error);
      console.log("ERRO: ", error);
      return res.status(500).json({ error: "Falha ao gerar link de upload." });
    }
  },
);

// 2. Confirmação após o upload direto para o S3 ter terminado com sucesso
mediaRoutes.post(
  "/rooms/:roomId/media/confirm",
  async (req: AuthenticatedRequest, res) => {
    const { roomId } = req.params;
    const { s3Key, mimeType, fileSize, width, height } = req.body;
    const userId = req.user?.userId || req.body.userId;

    const startTime = await redis.get(`upload_timer:${s3Key}`);
    const durationMs = startTime ? Date.now() - Number(startTime) : null;

    if (typeof roomId !== "string") {
      return res.status(400).json({ error: "roomId inválido." });
    }

    if (!s3Key || !mimeType) {
      return res
        .status(400)
        .json({ error: "Dados incompletos para confirmação." });
    }

    try {
      const isVideo = mimeType.startsWith("video/");

      const media = await prisma.roomMedia.create({
        data: {
          roomId,
          userId,
          s3Key,
          mimeType,
          type: isVideo ? "VIDEO" : "IMAGE",
          fileSize,
          width,
          height,
        },
        include: {
          user: {
            select: { id: true, username: true, avatarUrl: true },
          },
        },
      });

      logger.info({
        event: "MEDIA_UPLOAD_CONFIRMED",
        roomId,
        userId,
        s3Key,
        mimeType,
        fileSizeBytes: fileSize || null,
        uploadDurationMs: durationMs,
      });

      const viewUrl = await generatePresignedViewUrl(media.s3Key);
      const mediaPayload = { ...media, viewUrl };

      io.to(roomId).emit("new_media_uploaded", mediaPayload);

      logger.info({
        event: "MEDIA_UPLOAD_CONFIRMED",
        roomId,
        userId,
        fileSize,
        mimeType,
      });

      return res.status(201).json(mediaPayload);
    } catch (error) {
      console.error("Erro ao confirmar mídia no banco:", error);
      return res
        .status(500)
        .json({ error: "Falha ao persistir mídia no banco." });
    }
  },
);

// 3. Listagem da Galeria com URLs de Leitura
mediaRoutes.get(
  "/rooms/:roomId/media",
  async (req: AuthenticatedRequest, res) => {
    const { roomId } = req.params;

    if (typeof roomId !== "string") {
      return res.status(400).json({ error: "roomId inválido." });
    }

    try {
      const mediaList = await prisma.roomMedia.findMany({
        where: { roomId },
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, username: true, avatarUrl: true },
          },
        },
      });

      // Adiciona a URL temporária de leitura para cada item da galeria
      const itemsWithUrls = await Promise.all(
        mediaList.map(async (item) => ({
          ...item,
          viewUrl: await generatePresignedViewUrl(item.s3Key),
        })),
      );

      return res.json(itemsWithUrls);
    } catch (error) {
      console.error("Erro ao listar mídias:", error);
      return res.status(500).json({ error: "Falha ao buscar mídias do rolê." });
    }
  },
);

export default mediaRoutes;
