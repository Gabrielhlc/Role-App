import "dotenv/config";

import express from "express";
import cors from "cors";
import process from "node:process";
import authRoutes from "./routes/auth.routes.js";
import roomRoutes from "./routes/room.routes.js";
import userRoutes from "./routes/user.routes.js";
import swaggerUi from "swagger-ui-express";

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

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date() });
});

app.listen(3000, "0.0.0.0", () => {
  console.log(`Servidor Express rodando em http://localhost:${PORT}`);
});
