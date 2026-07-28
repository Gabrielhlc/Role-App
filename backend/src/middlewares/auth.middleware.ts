import type { Response, NextFunction, Request } from "express";
import jwt from "jsonwebtoken";
import process from "node:process";

const JWT_SECRET = process.env.JWT_SECRET!;

// Interface que define o payload esperado dentro do JWT do Rolê
export interface JwtPayload {
  userId: string;
  email: string;
}

// Estendemos a interface Request padrão do Express para incluir o usuário autenticado
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  // 1. Verificar se o cabeçalho Authorization foi enviado
  if (!authHeader) {
    res.status(401).json({ error: "Token de autenticação não fornecido." });
    return;
  }

  // 2. Verificar se o formato do cabeçalho é do tipo "Bearer <token>"
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    res
      .status(401)
      .json({ error: 'Formato do token inválido. Use "Bearer <token>".' });
    return;
  }

  const token = parts[1];

  if (!token) {
    res.status(401).json({ error: "Token de acesso ausente ou malformado." });
    return;
  }

  try {
    // 3. Validar a assinatura e decodificar o token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // 4. Injetar o payload decodificado dentro do objeto req
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    // 5. Encaminhar para o próximo controller/middleware
    next();
  } catch (error) {
    res.status(401).json({ error: "Token inválido ou expirado." });
  }
}
