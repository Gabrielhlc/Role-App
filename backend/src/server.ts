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

//@ts-ignore
import swaggerDocument from "./config/swagger-output.json";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

server.listen(3000, "0.0.0.0", () => {
  console.log(`Servidor Express rodando em http://localhost:${PORT}`);
});
