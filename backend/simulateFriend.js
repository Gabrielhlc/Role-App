import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  transports: ["websocket"],
});

const ROOM_ID = "896dd9b2-cb95-481a-9418-d3e27e0d7f78";

const NAMES = [
  "Lucas Silva",
  "Mariana Costa",
  "Rodrigo Alves",
  "Beatriz Lima",
  "Camila Rocha",
  "Felipe Carvalho",
  "Juliana Mendes",
  "Thiago Oliveira",
  "Larissa Fernandes",
  "Pedro Henrique",
];

const randomName = NAMES[Math.floor(Math.random() * NAMES.length)];
const uniqueId = Math.random().toString(36).substring(2, 7);
const FRIEND_ID = `friend_${uniqueId}_${Date.now()}`;
const USERNAME = `${randomName} (${uniqueId})`;
const AVATAR_URL = `https://i.pravatar.cc/150?u=${FRIEND_ID}`;

let lat = -7.2206 + (Math.random() - 0.5) * 0.004;
let lng = -35.8888 + (Math.random() - 0.5) * 0.004;

socket.on("connect", () => {
  console.log(`🤖 [OK] Simulação iniciada para: ${USERNAME}`);
  console.log(`🆔 ID do Usuário: ${FRIEND_ID}`);
  console.log(`📍 Posição Inicial: ${lat.toFixed(5)}, ${lng.toFixed(5)}\n`);

  socket.emit("join_room_map", {
    roomId: ROOM_ID,
    userId: FRIEND_ID,
  });

  socket.on("user_location_updated", (user) => {
    if (user.userId !== FRIEND_ID) {
      console.log(
        `📡 [MOVIMENTO] ${user.username} se moveu para: ${user.latitude.toFixed(5)}, ${user.longitude.toFixed(5)}`,
      );
    }
  });

  socket.on("user_stopped_sharing", ({ userId }) => {
    console.log(`🛑 [SAÍDA] Usuário ${userId} parou de compartilhar.`);
  });

  const interval = setInterval(() => {
    lat += (Math.random() - 0.5) * 0.001;
    lng += (Math.random() - 0.5) * 0.001;

    console.log(
      `🚶 ${USERNAME} andou para: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    );

    socket.emit("send_location", {
      roomId: ROOM_ID,
      userId: FRIEND_ID,
      username: USERNAME,
      avatarUrl: AVATAR_URL,
      latitude: lat,
      longitude: lng,
    });
  }, 3000);

  process.on("SIGINT", () => {
    console.log(`\n👋 Encerrando simulação de ${USERNAME}...`);
    clearInterval(interval);

    socket.emit("stop_sharing_location", {
      roomId: ROOM_ID,
      userId: FRIEND_ID,
    });

    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 200);
  });
});

socket.on("connect_error", (error) => {
  console.error("❌ Erro ao conectar ao WebSocket:", error.message);
});
