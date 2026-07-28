import { Router, type Response } from "express";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middlewares/auth.middleware.js";
import { prisma } from "../config/db.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res
        .status(401)
        .json({ error: "Usuário não identificado. Autenticação necessária." });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
      select: {
        username: true,
        email: true,
        avatarUrl: true,
      },
    });

    return res.json(user);
  },
);

export default router;
