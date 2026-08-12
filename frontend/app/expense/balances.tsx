import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack, useFocusEffect } from "expo-router";
import { api } from "../../src/services/api";

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

interface BalanceResponse {
  summary: UserBalance[];
  settlements: Settlement[];
}

export default function RoomBalancesScreen() {
  const { roomId, roomName } = useLocalSearchParams<{
    roomId: string;
    roomName?: string;
  }>();

  const [data, setData] = useState<BalanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBalances = async () => {
    if (!roomId) return;

    try {
      const response = await api.get(`/expense/${roomId}/balances`);
      setData(response.data);
    } catch (error: any) {
      console.error("Erro ao carregar balanço:", error);
      const msg =
        error.response?.data?.error || "Erro ao calcular balanço do rolê.";
      Alert.alert("Erro", msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBalances();
    }, [roomId]),
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchBalances();
  };

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
          title: roomName ? `Balanço - ${roomName}` : "Balanço do Rolê",
          headerBackTitle: "Voltar",
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#007AFF"]}
          />
        }
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Como Quitar as Dívidas</Text>
          <Text style={styles.sectionSubtitle}>
            Menor número de transferências para zerar tudo
          </Text>
        </View>

        {data?.settlements && data.settlements.length > 0 ? (
          <View style={styles.cardGroup}>
            {data.settlements.map((item, index) => (
              <View key={index} style={styles.settlementCard}>
                <View style={styles.settlementFlow}>
                  <View style={styles.userBadge}>
                    <Text style={styles.debtorName}>{item.from.username}</Text>
                    <Text style={styles.userRoleText}>Paga</Text>
                  </View>

                  <Text style={styles.arrow}>➔</Text>

                  <View style={styles.userBadge}>
                    <Text style={styles.creditorName}>{item.to.username}</Text>
                    <Text style={styles.userRoleText}>Recebe</Text>
                  </View>
                </View>

                <View style={styles.settlementAmountContainer}>
                  <Text style={styles.settlementAmountText}>
                    R$ {item.amount.toFixed(2).replace(".", ",")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptySettlementCard}>
            <Text style={styles.emptySettlementTitle}>Tudo Zerado!</Text>
            <Text style={styles.emptySettlementSub}>
              Ninguém deve nada no momento ou os valores estão 100%
              equilibrados.
            </Text>
          </View>
        )}

        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Balanço por Participante</Text>
          <Text style={styles.sectionSubtitle}>
            Detalhamento do total pago e consumido por cada um
          </Text>
        </View>

        <View style={styles.cardGroup}>
          {data?.summary.map((item) => {
            const isPositive = item.netBalance > 0.01;
            const isNegative = item.netBalance < -0.01;

            return (
              <View key={item.user.id} style={styles.summaryCard}>
                {/* Nome do Participante e Saldo Líquido */}
                <View style={styles.summaryHeader}>
                  <Text style={styles.usernameText}>{item.user.username}</Text>

                  <View
                    style={[
                      styles.netBadge,
                      isPositive
                        ? styles.netBadgePositive
                        : isNegative
                          ? styles.netBadgeNegative
                          : styles.netBadgeNeutral,
                    ]}
                  >
                    <Text
                      style={[
                        styles.netBadgeText,
                        isPositive
                          ? styles.netBadgeTextPositive
                          : isNegative
                            ? styles.netBadgeTextNegative
                            : styles.netBadgeTextNeutral,
                      ]}
                    >
                      {isPositive
                        ? `+ R$ ${item.netBalance.toFixed(2).replace(".", ",")}`
                        : isNegative
                          ? `- R$ ${Math.abs(item.netBalance).toFixed(2).replace(".", ",")}`
                          : "R$ 0,00"}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Pagou no total</Text>
                    <Text style={styles.metricValue}>
                      R$ {item.totalPaid.toFixed(2).replace(".", ",")}
                    </Text>
                  </View>

                  <View style={styles.metricSeparator} />

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Sua parte (Consumo)</Text>
                    <Text style={styles.metricValue}>
                      R$ {item.totalShare.toFixed(2).replace(".", ",")}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  cardGroup: {
    gap: 12,
  },
  settlementCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settlementFlow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  userBadge: {
    alignItems: "flex-start",
  },
  debtorName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#EF4444",
  },
  creditorName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#10B981",
  },
  userRoleText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },
  arrow: {
    fontSize: 16,
    color: "#CBD5E1",
    fontWeight: "bold",
  },
  settlementAmountContainer: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  settlementAmountText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0F172A",
  },
  emptySettlementCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    elevation: 1,
  },
  emptySettlementTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#10B981",
    marginBottom: 4,
  },
  emptySettlementSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },
  summaryCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  usernameText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
  },
  netBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  netBadgePositive: {
    backgroundColor: "#E6F4EA",
  },
  netBadgeNegative: {
    backgroundColor: "#FCE8E6",
  },
  netBadgeNeutral: {
    backgroundColor: "#F1F5F9",
  },
  netBadgeText: {
    fontSize: 13,
    fontWeight: "bold",
  },
  netBadgeTextPositive: {
    color: "#137333",
  },
  netBadgeTextNegative: {
    color: "#C5221F",
  },
  netBadgeTextNeutral: {
    color: "#64748B",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  metricItem: {
    alignItems: "center",
    flex: 1,
  },
  metricSeparator: {
    width: 1,
    height: "80%",
    backgroundColor: "#E2E8F0",
  },
  metricLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
});
