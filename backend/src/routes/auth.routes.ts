import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { prisma } from "../config/db.js";
import jwt from "jsonwebtoken";

const router = Router();

router.post("/google", AuthController.googleLogin);

// Remover antes do deploy
router.get("/mock-token", async (req, res) => {
  /* #swagger.security = [] */
  try {
    const user = await prisma.user.findFirst();

    if (!user) {
      return res.status(404).json({
        error:
          "Nenhum usuário encontrado no banco. Faça login pelo emulador pelo menos uma vez para criar um usuário.",
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" },
    );

    return res.json({
      message: "Token gerado com sucesso para testes no Swagger!",
      user: { username: user.username, email: user.email },
      token: "Bearer " + token,
    });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao gerar token de teste." });
  }
});

export default router;
