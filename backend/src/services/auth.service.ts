import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";

const googleClient = new OAuth2Client();
const JWT_SECRET = process.env.JWT_SECRET || "chave-secreta-do-role-tcc";

export class AuthService {
  static async authenticateGoogleUser(idToken: string) {
    try {
      console.log(process.env.GOOGLE_CLIENT_ID);
      // 1. Validar o idToken recebido do aplicativo com a API do Google
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID!, // ID do app no Google Console
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        throw new Error("Token inválido ou sem payload de identificação.");
      }

      const { sub: googleId, email, name, picture } = payload;

      // 2. Buscar ou cadastrar o usuário no banco de dados (Upsert)
      let user = await prisma.user.findUnique({
        where: { oauthId: googleId },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            oauthId: googleId,
            email,
            username: name || "Usuário do Rolê",
            avatarUrl: picture || null,
          },
        });
      }

      // 3. Gerar o JWT próprio da aplicação expiração de 30 dias
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "30d" },
      );

      return { user, token };
    } catch (error) {
      console.error("Erro na validação do OAuth do Google:", error);
      throw new Error("Falha na autenticação do provedor.");
    }
  }
}
