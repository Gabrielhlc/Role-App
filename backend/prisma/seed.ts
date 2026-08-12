import { prisma } from "../src/config/db.js";

async function main() {
  console.log("Iniciando o seed do banco de dados...");

  await prisma.expenseSplit.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.roomParticipant.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  console.log("🧹 Banco de dados limpo.");

  const usersData = [
    {
      username: "Rafael Souza",
      email: "rafael.mock@gmail.com",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=Gabriel",
      oauthId: "google-oauth2|mock-1001",
    },
    {
      username: "João Silva",
      email: "joao.mock@gmail.com",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=Joao",
      oauthId: "google-oauth2|mock-1002",
    },
    {
      username: "Maria Oliveira",
      email: "maria.mock@gmail.com",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=Maria",
      oauthId: "google-oauth2|mock-1003",
    },
    {
      username: "Ana Costa",
      email: "ana.mock@gmail.com",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=Ana",
      oauthId: "google-oauth2|mock-1005",
    },
  ];

  const createdUsers = [];
  for (const userData of usersData) {
    const user = await prisma.user.create({
      data: userData,
    });
    createdUsers.push(user);
  }

  console.log("5 usuários criados com sucesso!");

  const host = createdUsers[0]!;

  const room = await prisma.room.create({
    data: {
      name: "Churrasco do Fim de Semana",
      code: "ROLE",
      hostId: host.id,
    },
  });

  console.log(
    `Sala "${room.name}" criada (Código: ${room.code}) com Host: ${host.username}`,
  );

  await prisma.roomParticipant.createMany({
    data: createdUsers.map((u) => ({
      roomId: room.id,
      userId: u.id,
    })),
  });

  const encodedName = encodeURIComponent(room.name);

  const deepLinking = `roleapp://room/${room.id}?name=${encodedName}&code=ROLE`;

  const deepLink = `exp://localhost:8081/--/room/join?code=ROLE`;

  console.log(`🔗 Deep Link (Expo):     ${deepLinking}`);

  console.log("Todos os 5 usuários foram adicionados à sala!");

  console.log("Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro ao rodar o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
