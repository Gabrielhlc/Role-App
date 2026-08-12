import { Router, type Response } from "express";
import { prisma } from "../config/db.js";

import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middlewares/auth.middleware.js";

const router = Router();

interface SplitInput {
  userId: string;
  value: number;
}

interface CreateExpenseBody {
  roomId: string;
  description: string;
  totalAmount: number;
  paidById: string;
  splitType?: "EQUAL" | "EXACT" | "ONLY_ME";
  splits: SplitInput[];
}

router.post(
  "/create",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    const {
      roomId,
      description,
      totalAmount,
      paidById,
      splits,
    }: CreateExpenseBody = req.body;

    if (!roomId || typeof roomId !== "string") {
      return res.status(400).json({ error: "O ID da sala é obrigatório." });
    }

    if (
      !description ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      return res
        .status(400)
        .json({ error: "A descrição da despesa é obrigatória." });
    }

    if (typeof totalAmount !== "number" || totalAmount <= 0) {
      return res
        .status(400)
        .json({ error: "O valor total deve ser um número maior que zero." });
    }

    if (!paidById || typeof paidById !== "string") {
      return res
        .status(400)
        .json({ error: "O pagador da despesa é obrigatório." });
    }

    if (!Array.isArray(splits) || splits.length === 0) {
      return res
        .status(400)
        .json({ error: "Selecione ao menos um participante para a divisão." });
    }

    // 2. Validação de integridade da soma das divisões (Tolerância de R$ 0,02 para arredondamentos)
    const sumSplits = splits.reduce(
      (acc, item) => acc + (Number(item.value) || 0),
      0,
    );
    const difference = Math.abs(sumSplits - totalAmount);

    if (difference >= 0.02) {
      return res.status(400).json({
        error: `A soma das partes (R$ ${sumSplits.toFixed(
          2,
        )}) não bate com o valor total da despesa (R$ ${totalAmount.toFixed(2)}).`,
      });
    }

    try {
      // 3. Verificação de segurança: O usuário logado realmente pertence a essa sala?
      const isUserInRoom = await prisma.roomParticipant.findFirst({
        where: {
          roomId,
          userId,
        },
      });

      console.log(isUserInRoom);

      if (!isUserInRoom) {
        return res.status(403).json({
          error: "Você não tem permissão para adicionar despesas nesta sala.",
        });
      }

      const createdExpense = await prisma.$transaction(async (tx) => {
        // Cria a Despesa principal e os registros de Split em cascata
        const expense = await tx.expense.create({
          data: {
            roomId,
            paidBy: paidById,
            description: description.trim(),
            totalAmount,
            splits: {
              create: splits.map((split) => {
                const percentage = Number(
                  ((split.value / totalAmount) * 100).toFixed(2),
                );

                return {
                  userId: split.userId,
                  value: split.value,
                  percentage,
                };
              }),
            },
          },
          include: {
            splits: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        });

        return expense;
      });

      return res.status(201).json(createdExpense);
    } catch (error) {
      console.error("Erro ao criar despesa:", error);
      return res
        .status(500)
        .json({ error: "Erro interno ao cadastrar a despesa." });
    }
  },
);

router.get(
  "/room/:roomId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;
    const userId = req.user?.userId;

    if (typeof roomId !== "string") {
      return res.status(400).json({ error: "ID da sala inválido." });
    }

    try {
      const isMember = await prisma.room.findFirst({
        where: {
          id: roomId,
          OR: [
            { hostId: userId! },
            { participants: { some: { userId: userId! } } },
          ],
        },
      });

      if (!isMember) {
        return res.status(403).json({ error: "Acesso negado a esta sala." });
      }

      const expenses = await prisma.expense.findMany({
        where: { roomId },
        orderBy: { createdAt: "desc" },
        include: {
          payer: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          splits: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      return res.status(200).json(expenses);
    } catch (error) {
      console.error("Erro ao listar despesas:", error);
      return res.status(500).json({ error: "Erro ao carregar despesas." });
    }
  },
);

interface UserSummary {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
}

interface UserBalance {
  user: UserSummary;
  totalPaid: number;
  totalShare: number;
  netBalance: number;
}

interface Settlement {
  from: UserSummary;
  to: UserSummary;
  amount: number;
}

router.get(
  "/:id/balances",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: roomId } = req.params;
    const userId = req.user?.userId;

    if (typeof roomId !== "string") {
      return res.status(400).json({ error: "ID de sala inválido." });
    }

    try {
      const room = await prisma.room.findFirst({
        where: {
          id: roomId,
          OR: [
            { hostId: userId! },
            { participants: { some: { userId: userId! } } },
          ],
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      if (!room) {
        return res
          .status(404)
          .json({ error: "Sala não encontrada ou acesso negado." });
      }

      const roomUsers = room.participants.map((p) => p.user);

      const expenses = await prisma.expense.findMany({
        where: { roomId },
        include: {
          splits: true,
        },
      });

      // Mapeia e acumula o Total Pagos e Total Consumido por Usuário
      const userBalancesMap: { [userId: string]: UserBalance } = {};

      roomUsers.forEach((user) => {
        userBalancesMap[user.id] = {
          user,
          totalPaid: 0,
          totalShare: 0,
          netBalance: 0,
        };
      });

      // Processa cada despesa gravada
      expenses.forEach((expense) => {
        const paidById = expense.paidBy;
        const totalAmount = Number(expense.totalAmount);

        // Se o pagador pertence à lista da sala, acumula o total pago
        if (userBalancesMap[paidById]) {
          userBalancesMap[paidById].totalPaid += totalAmount;
        }

        // Acumula a fatia consumida por cada participante nos splits
        expense.splits.forEach((split) => {
          const splitUserId = split.userId;
          const splitValue = Number(split.value);

          if (userBalancesMap[splitUserId]) {
            userBalancesMap[splitUserId].totalShare += splitValue;
          }
        });
      });

      // 4. Calcula o saldo líquido (netBalance = totalPaid - totalShare)
      const balances: UserBalance[] = Object.values(userBalancesMap).map(
        (b) => {
          const totalPaid = Number(b.totalPaid.toFixed(2));
          const totalShare = Number(b.totalShare.toFixed(2));
          const netBalance = Number((totalPaid - totalShare).toFixed(2));

          return {
            user: b.user,
            totalPaid,
            totalShare,
            netBalance,
          };
        },
      );

      // Separa devedores (saldo < 0) e credores (saldo > 0)
      const debtors = balances
        .filter((b) => b.netBalance < -0.01)
        .map((b) => ({ user: b.user, amount: Math.abs(b.netBalance) }));

      const creditors = balances
        .filter((b) => b.netBalance > 0.01)
        .map((b) => ({ user: b.user, amount: b.netBalance }));

      const settlements: Settlement[] = [];

      let i = 0;
      let j = 0;

      while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];

        if (!debtor || !creditor) break;

        // O valor da transferência é o menor entre o que o devedor deve e o que o credor tem a receber
        const amount = Math.min(debtor.amount, creditor.amount);
        const roundedAmount = Number(amount.toFixed(2));

        if (roundedAmount > 0) {
          settlements.push({
            from: debtor.user,
            to: creditor.user,
            amount: roundedAmount,
          });
        }

        debtor.amount -= roundedAmount;
        creditor.amount -= roundedAmount;

        if (debtor.amount < 0.01) {
          i++;
        }

        if (creditor.amount < 0.01) {
          j++;
        }
      }

      return res.status(200).json({
        summary: balances,
        settlements,
      });
    } catch (error) {
      console.error("Erro ao calcular balanço da sala:", error);
      return res
        .status(500)
        .json({ error: "Erro interno ao calcular o balanço." });
    }
  },
);

export default router;
