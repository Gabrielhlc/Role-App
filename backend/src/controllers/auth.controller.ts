import type { Request, Response } from "express";
import { AuthService } from "../services/auth.service.js";

export class AuthController {
  static async googleLogin(req: Request, res: Response): Promise<void> {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        res.status(400).json({ error: "O idToken é obrigatório." });
        return;
      }

      const result = await AuthService.authenticateGoogleUser(idToken);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }
}
