import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useRouter,
  useLocalSearchParams,
  Stack,
  useFocusEffect,
} from "expo-router";
import { api } from "../../src/services/api";

interface UserSummary {
  id: string;
  username: string;
  avatarUrl?: string;
}

interface ExpenseSplit {
  id: string;
  userId: string;
  value: number;
  user: UserSummary;
}

interface Expense {
  id: string;
  description: string;
  totalAmount: number;
  createdAt: string;
  payer: UserSummary;
  splits: ExpenseSplit[];
}

export default function ExpenseListScreen() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const { roomId, roomName } = useLocalSearchParams<{
    roomId: string;
    roomName?: string;
  }>();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchExpenses = async () => {
    if (!roomId) return;

    try {
      const [userRes, expensesRes] = await Promise.all([
        api.get("/user"),
        api.get(`/expense/room/${roomId}`),
      ]);

      setCurrentUserId(userRes.data.id || userRes.data.userId);
      setExpenses(expensesRes.data);
    } catch (error: any) {
      console.error("Erro ao buscar dados:", error);
      const msg = error.response?.data?.error || "Erro ao carregar despesas.";
      Alert.alert("Erro", msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchExpenses();
    }, [roomId]),
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchExpenses();
  };

  const totalRoomSpent = expenses.reduce(
    (acc, item) => acc + Number(item.totalAmount),
    0,
  );

  function renderParticipationBadge(
    expense: Expense,
    currentUserId: string | null,
  ) {
    if (!currentUserId) return null;

    const isPaidByMe = expense.payer.id === currentUserId;
    const mySplit = expense.splits.find((s) => s.userId === currentUserId);

    if (isPaidByMe) {
      return (
        <View style={[styles.badgeContainer, styles.badgePaidByMe]}>
          <Text style={styles.badgeTextPaidByMe}>💳 Você pagou</Text>
        </View>
      );
    }

    if (mySplit) {
      return (
        <View style={[styles.badgeContainer, styles.badgeParticipating]}>
          <Text style={styles.badgeTextParticipating}>
            ✋ Sua parte: R${" "}
            {Number(mySplit.value).toFixed(2).replace(".", ",")}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.badgeContainer, styles.badgeNotInvolved]}>
        <Text style={styles.badgeTextNotInvolved}>Fora desta conta</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Stack.Screen
        options={{
          title: roomName ? `Despesas - ${roomName}` : "Despesas do Rolê",
          headerBackTitle: "Voltar",
        }}
      />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Total Gasto no Rolê</Text>
        <Text style={styles.summaryValue}>
          R$ {totalRoomSpent.toFixed(2).replace(".", ",")}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.balanceButton}
        onPress={() =>
          router.push({
            pathname: "/expense/balances",
            params: { roomId: roomId, roomName: roomName },
          })
        }
      >
        <Text style={styles.balanceButtonText}>Ver Balanço do Rolê</Text>
      </TouchableOpacity>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#007AFF"]}
          />
        }
        renderItem={({ item }) => {
          const formattedDate = new Date(item.createdAt).toLocaleDateString(
            "pt-BR",
            {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            },
          );

          return (
            <View style={styles.expenseCard}>
              <View style={styles.cardTopHeader}>
                {renderParticipationBadge(item, currentUserId)}
                <Text style={styles.expenseDate}>{formattedDate}</Text>
              </View>

              <View style={styles.expenseHeader}>
                <Text style={styles.expenseDescription}>
                  {item.description}
                </Text>
                <Text style={styles.expenseAmount}>
                  R$ {Number(item.totalAmount).toFixed(2).replace(".", ",")}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.paidByContainer}>
                <Text style={styles.infoLabel}>Pago por:</Text>
                <Text style={styles.paidByText}>
                  {item.payer.id === currentUserId
                    ? "Você"
                    : item.payer?.username || "Usuário"}
                </Text>
              </View>

              <View style={styles.splitsContainer}>
                <Text style={styles.infoLabel}>
                  Divisão ({item.splits.length}):
                </Text>
                <View style={styles.splitsList}>
                  {item.splits.map((split) => {
                    const isMe = split.userId === currentUserId;
                    return (
                      <View key={split.id} style={styles.splitRow}>
                        <Text
                          style={[
                            styles.splitUsername,
                            isMe && styles.boldUserHighlight,
                          ]}
                        >
                          •{" "}
                          {isMe
                            ? "Você"
                            : split.user?.username || "Participante"}
                        </Text>
                        <Text
                          style={[
                            styles.splitValue,
                            isMe && styles.boldUserHighlight,
                          ]}
                        >
                          R$ {Number(split.value).toFixed(2).replace(".", ",")}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Nenhuma despesa ainda!</Text>
            <Text style={styles.emptySub}>
              Clique no botão abaixo para adicionar o primeiro gasto do rolê.
            </Text>
          </View>
        }
      />

      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={styles.createButton}
          activeOpacity={0.8}
          onPress={() =>
            router.push({
              pathname: "/expense/create",
              params: { roomId },
            })
          }
        >
          <Text style={styles.createButtonText}>Adicionar Nova Despesa</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F5F7",
    marginTop: 64,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F5F7",
  },
  summaryCard: {
    backgroundColor: "#008643",
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    elevation: 3,
  },
  summaryTitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  summaryValue: {
    color: "#FFF",
    fontSize: 28,
    fontWeight: "bold",
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  expenseCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    elevation: 2,
  },
  expenseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  expenseMainInfo: {
    flex: 1,
    marginRight: 12,
  },
  expenseDescription: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  expenseDate: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#007AFF",
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748B",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  paidByContainer: {
    marginBottom: 12,
  },
  paidByBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paidByText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  splitsContainer: {
    marginTop: 4,
  },
  splitsList: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  splitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  splitUsername: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "500",
  },
  splitValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
  },
  footerContainer: {
    padding: 16,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  createButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  createButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  balanceButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    margin: 16,
    marginVertical: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  balanceButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  cardTopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  badgePaidByMe: {
    backgroundColor: "#E0F2FE",
  },
  badgeTextPaidByMe: {
    color: "#0369A1",
    fontSize: 12,
    fontWeight: "bold",
  },
  badgeParticipating: {
    backgroundColor: "#FEF3C7",
  },
  badgeTextParticipating: {
    color: "#B45309",
    fontSize: 12,
    fontWeight: "bold",
  },
  badgeNotInvolved: {
    backgroundColor: "#F1F5F9",
  },
  badgeTextNotInvolved: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  boldUserHighlight: {
    fontWeight: "bold",
    color: "#007AFF",
  },
});
