import "dotenv/config";

import http from "http";
import express from "express";
import cors from "cors";
import process from "node:process";
import authRoutes from "./routes/auth.routes.js";
import roomRoutes from "./routes/room.routes.js";
import userRoutes from "./routes/user.routes.js";
import mediaRoutes from "./routes/media.routes.ts";
import swaggerUi from "swagger-ui-express";
import expenseRoutes from "./routes/expense.routes.js";
import { Server } from "socket.io";
import { setupLocationSocket } from "./sockets/locationSocket.ts";
import { httpTelemetryMiddleware } from "./middlewares/telemetry.middleware.js";

//@ts-ignore
import swaggerDocument from "./config/swagger-output.json";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(httpTelemetryMiddleware);

// Public
app.use("/api", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/auth", authRoutes);

app.use("/room", roomRoutes);
app.use("/user", userRoutes);
app.use("/expense", expenseRoutes);
app.use("/media", mediaRoutes);

const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  socket.on("join_room", ({ roomId }) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} entrou no canal da sala ${roomId}`);
  });
});

setupLocationSocket(io);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date() });
});

app.get("/invite/:roomId", (req, res) => {
  const { roomId } = req.params;

  const appDeepLink = `roleapp://room/${roomId}`;

  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Entrando no Rolê</title>
        <style>
          body {
            font-family: sans-serif;
            background-color: #0F172A;
            color: #FFFFFF;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
            text-align: center;
          }
          .card {
            background-color: #1E293B;
            padding: 24px;
            border-radius: 16px;
            max-width: 360px;
            width: 100%;
          }
          h2 { margin-top: 0; font-size: 20px; }
          p { color: #94A3B8; font-size: 14px; }
          .btn {
            display: block;
            background-color: #2563EB;
            color: white;
            padding: 14px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: bold;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Entrando no Rolê...</h2>
          <p>Se o aplicativo não abrir automaticamente em instantes, clique no botão abaixo:</p>
          <a class="btn" href="${appDeepLink}">Abrir Aplicativo</a>
        </div>

        <script>
          // Ao carregar a página, dispara a ordem para o Android abrir o app imediatamente
          window.onload = function() {
            window.location.href = "${appDeepLink}";
          };
        </script>
      </body>
    </html>
  `);
});

server.listen(3000, "0.0.0.0", () => {
  console.log(`Servidor Express rodando em http://localhost:${PORT}`);
});
