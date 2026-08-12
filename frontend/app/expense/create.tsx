import React, { useState, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { api } from "../../src/services/api";
import { AxiosError } from "axios";

export type SplitType = "EQUAL" | "EXACT" | "ONLY_ME";

export interface Participant {
  id: string;
  username: string;
  avatarUrl?: string;
  isHost?: boolean;
}

export default function CreateExpenseScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUser, setCurrentUser] = useState<Participant | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paidBy, setPaidBy] = useState<Participant | null>(null);
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");

  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    [],
  );
  const [exactAmounts, setExactAmounts] = useState<{ [key: string]: string }>(
    {},
  );

  const [isPaidByModalOpen, setIsPaidByModalOpen] = useState(false);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      if (!roomId) {
        Alert.alert("Erro", "Identificador da sala não foi informado.", [
          { text: "OK", onPress: () => router.back() },
        ]);
        return;
      }

      try {
        setIsLoadingData(true);

        const [userRes, participantsRes] = await Promise.all([
          api.get("/user"),
          api.get(`/room/${roomId}/participants`),
        ]);

        const loggedUser: Participant = {
          id: userRes.data.id || userRes.data.userId,
          username: userRes.data.username,
        };

        const roomMembers: Participant[] = participantsRes.data;

        setCurrentUser(loggedUser);
        setParticipants(roomMembers);

        const foundUser = roomMembers.find((m) => m.id === loggedUser.id);

        setPaidBy(foundUser || loggedUser);

        setSelectedParticipants(roomMembers.map((m) => m.id));
      } catch (error) {
        console.error("Erro ao carregar dados da sala:", error);
        Alert.alert("Erro", "Não foi possível carregar os participantes.");
      } finally {
        setIsLoadingData(false);
      }
    }

    loadInitialData();
  }, [roomId]);

  const parsedTotal = useMemo(() => {
    const clean = totalAmount.replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }, [totalAmount]);

  const autoDistributeExactAmounts = (
    participantIds: string[],
    total: number,
  ) => {
    if (participantIds.length === 0 || total <= 0) return {};
    const perPerson = (total / participantIds.length).toFixed(2);
    const initialAmounts: { [key: string]: string } = {};
    participantIds.forEach((id) => {
      initialAmounts[id] = perPerson;
    });
    return initialAmounts;
  };

  const handleSelectSplitType = (type: SplitType) => {
    setSplitType(type);
    if (type === "EQUAL" || type === "EXACT") {
      setIsParticipantsModalOpen(true);
    }
  };

  const handleConfirmParticipants = () => {
    setIsParticipantsModalOpen(false);
    if (splitType === "EXACT") {
      setExactAmounts(
        autoDistributeExactAmounts(selectedParticipants, parsedTotal),
      );
    }
  };

  const toggleParticipantSelection = (id: string) => {
    setSelectedParticipants((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) {
          Alert.alert("Atenção", "Selecione pelo menos um participante.");
          return prev;
        }
        return prev.filter((pId) => pId !== id);
      }
      return [...prev, id];
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedParticipants.length === participants.length) {
      if (currentUser) setSelectedParticipants([currentUser.id]);
    } else {
      setSelectedParticipants(participants.map((p) => p.id));
    }
  };

  const sumExactAmounts = useMemo(() => {
    return Object.entries(exactAmounts).reduce((acc, [id, val]) => {
      if (!selectedParticipants.includes(id)) return acc;
      const num = parseFloat(val.replace(",", ".")) || 0;
      return acc + num;
    }, 0);
  }, [exactAmounts, selectedParticipants]);

  const diffExact = useMemo(() => {
    return parsedTotal - sumExactAmounts;
  }, [parsedTotal, sumExactAmounts]);

  const isFormValid = useMemo(() => {
    if (!description.trim()) return false;
    if (parsedTotal <= 0) return false;
    if (!paidBy) return false;

    if (splitType === "EQUAL") {
      return selectedParticipants.length > 0;
    }

    if (splitType === "EXACT") {
      return selectedParticipants.length > 0 && Math.abs(diffExact) < 0.01;
    }

    return true;
  }, [
    description,
    parsedTotal,
    paidBy,
    splitType,
    selectedParticipants,
    diffExact,
  ]);

  const handleSaveExpense = async () => {
    if (!isFormValid || !paidBy) return;

    const payload = {
      roomId,
      description: description.trim(),
      totalAmount: parsedTotal,
      paidById: paidBy.id,
      splitType,
      splits:
        splitType === "ONLY_ME"
          ? [{ userId: paidBy.id, value: parsedTotal }]
          : splitType === "EQUAL"
            ? selectedParticipants.map((id) => ({
                userId: id,
                value: Number(
                  (parsedTotal / selectedParticipants.length).toFixed(2),
                ),
              }))
            : selectedParticipants.map((id) => ({
                userId: id,
                value: parseFloat(exactAmounts[id]?.replace(",", ".") || "0"),
              })),
    };

    try {
      await api.post("/expense/create", payload);
      Alert.alert("Sucesso", "Despesa criada com sucesso!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Erro ao criar despesa:", error);
      Alert.alert(
        "Erro",
        "Não foi possível criar a despesa. Verifique os dados e tente novamente.",
      );
    }
  };

  if (isLoadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Stack.Screen
        options={{ title: "Nova Despesa", headerBackTitle: "Voltar" }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.label}>Nome da Despesa</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Balde de Cerveja, Uber, Carne"
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Valor Total (R$)</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0,00"
            placeholderTextColor="#CCC"
            keyboardType="decimal-pad"
            value={totalAmount}
            onChangeText={setTotalAmount}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Quem Pagou?</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setIsPaidByModalOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.selectButtonText}>
              {paidBy?.id === currentUser?.id
                ? `${paidBy?.username} (Você)`
                : paidBy?.username || "Selecionar..."}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Como Dividir?</Text>

          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segmentOption,
                splitType === "EQUAL" && styles.segmentOptionActive,
              ]}
              onPress={() => handleSelectSplitType("EQUAL")}
            >
              <Text
                style={[
                  styles.segmentText,
                  splitType === "EQUAL" && styles.segmentTextActive,
                ]}
              >
                Igualitária
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentOption,
                splitType === "EXACT" && styles.segmentOptionActive,
              ]}
              onPress={() => handleSelectSplitType("EXACT")}
            >
              <Text
                style={[
                  styles.segmentText,
                  splitType === "EXACT" && styles.segmentTextActive,
                ]}
              >
                Valores Exatos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentOption,
                splitType === "ONLY_ME" && styles.segmentOptionActive,
              ]}
              onPress={() => handleSelectSplitType("ONLY_ME")}
            >
              <Text
                style={[
                  styles.segmentText,
                  splitType === "ONLY_ME" && styles.segmentTextActive,
                ]}
              >
                Apenas Eu
              </Text>
            </TouchableOpacity>
          </View>

          {splitType === "EQUAL" && (
            <TouchableOpacity
              style={styles.editParticipantsBadge}
              onPress={() => setIsParticipantsModalOpen(true)}
            >
              <Text style={styles.editParticipantsText}>
                Dividindo entre {selectedParticipants.length} participante(s) ›
              </Text>
            </TouchableOpacity>
          )}

          {splitType === "EXACT" && (
            <View style={styles.exactContainer}>
              <View
                style={[
                  styles.feedbackBanner,
                  Math.abs(diffExact) < 0.01
                    ? styles.feedbackBannerSuccess
                    : diffExact > 0
                      ? styles.feedbackBannerWarning
                      : styles.feedbackBannerError,
                ]}
              >
                <Text style={styles.feedbackText}>
                  {Math.abs(diffExact) < 0.01
                    ? "✓ Soma exata!"
                    : diffExact > 0
                      ? `Faltam R$ ${diffExact.toFixed(2)}`
                      : `Sobraram R$ ${Math.abs(diffExact).toFixed(2)}`}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.editParticipantsBadge}
                onPress={() => setIsParticipantsModalOpen(true)}
              >
                <Text style={styles.editParticipantsText}>
                  Alterar participantes ({selectedParticipants.length}) ›
                </Text>
              </TouchableOpacity>

              {participants
                .filter((p) => selectedParticipants.includes(p.id))
                .map((participant) => (
                  <View key={participant.id} style={styles.exactInputRow}>
                    <Text style={styles.exactParticipantName}>
                      {participant.id === currentUser?.id
                        ? `${participant.username} (Você)`
                        : participant.username}
                    </Text>
                    <View style={styles.exactInputContainer}>
                      <Text style={styles.currencyPrefix}>R$</Text>
                      <TextInput
                        style={styles.exactInput}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        value={exactAmounts[participant.id] || ""}
                        onChangeText={(val) =>
                          setExactAmounts((prev) => ({
                            ...prev,
                            [participant.id]: val,
                          }))
                        }
                      />
                    </View>
                  </View>
                ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, !isFormValid && styles.saveButtonDisabled]}
          disabled={!isFormValid}
          onPress={handleSaveExpense}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>Salvar Despesa</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={isPaidByModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPaidByModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Quem Pagou?</Text>
            <FlatList
              data={participants}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setPaidBy(item);
                    setIsPaidByModalOpen(false);
                  }}
                >
                  <Text style={styles.modalItemText}>
                    {item.id === currentUser?.id
                      ? `${item.username} (Você)`
                      : item.username}
                  </Text>
                  {paidBy?.id === item.id && (
                    <Text style={styles.checkMark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={isParticipantsModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsParticipantsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quem vai dividir?</Text>
              <TouchableOpacity onPress={handleToggleSelectAll}>
                <Text style={styles.selectAllText}>
                  {selectedParticipants.length === participants.length
                    ? "Desmarcar Todos"
                    : "Selecionar Todos"}
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={participants}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedParticipants.includes(item.id);
                return (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => toggleParticipantSelection(item.id)}
                  >
                    <Text style={styles.modalItemText}>
                      {item.id === currentUser?.id
                        ? `${item.username} (Você)`
                        : item.username}
                    </Text>
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected,
                      ]}
                    >
                      {isSelected && (
                        <Text style={styles.checkboxCheck}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity
              style={styles.confirmModalButton}
              onPress={handleConfirmParticipants}
            >
              <Text style={styles.confirmModalButtonText}>
                Confirmar ({selectedParticipants.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    gap: 16,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#1A1A1A",
  },
  amountInput: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 14,
    fontSize: 24,
    fontWeight: "bold",
    color: "#007AFF",
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 14,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  chevron: {
    fontSize: 18,
    color: "#999",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 4,
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  segmentOptionActive: {
    backgroundColor: "#FFF",
    elevation: 1,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  segmentTextActive: {
    color: "#007AFF",
    fontWeight: "bold",
  },
  editParticipantsBadge: {
    marginTop: 12,
    alignSelf: "flex-start",
  },
  editParticipantsText: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "600",
  },
  exactContainer: {
    marginTop: 12,
    gap: 12,
  },
  feedbackBanner: {
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  feedbackBannerSuccess: {
    backgroundColor: "#E6F4EA",
  },
  feedbackBannerWarning: {
    backgroundColor: "#FEF7E0",
  },
  feedbackBannerError: {
    backgroundColor: "#FCE8E6",
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  exactInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  exactParticipantName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
  },
  exactInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    width: 120,
  },
  currencyPrefix: {
    fontSize: 14,
    color: "#666",
    marginRight: 4,
  },
  exactInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  saveButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: "#CBD5E1",
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  selectAllText: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "600",
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalItemText: {
    fontSize: 16,
    color: "#333",
  },
  checkMark: {
    fontSize: 18,
    color: "#007AFF",
    fontWeight: "bold",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  checkboxCheck: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  confirmModalButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  confirmModalButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
