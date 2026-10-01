import { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  ActivityIndicator,
  Share,
  Image,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { api } from "../../src/services/api";

interface Participant {
  id: string;
  username: string;
  avatarUrl?: string;
  isHost: boolean;
}

interface RoomData {
  id: string;
  name: string;
  code: string;
  hostId: string;
  participants: Participant[];
  status: "active" | "closed" | string;
}

export default function RoomDetailsScreen() {
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    id,
    name: routeName,
    code: routeCode,
  } = useLocalSearchParams<{
    id: string;
    name?: string;
    code?: string;
  }>();

  const router = useRouter();

  const displayName = room?.name || routeName || "Detalhes do Rolê";
  const displayCode = room?.code || routeCode || "------";
  const participantsCount = room?.participants?.length || 0;

  const baseUrl = api.defaults.baseURL?.replace(/\/$/, "") || "";
  const inviteUrl = `${baseUrl}/invite/${id}?name=${encodeURIComponent(
    displayName,
  )}&code=${encodeURIComponent(displayCode)}`;

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível copiar o link.");
    }
  };

  const handleShareWhatsApp = async () => {
    try {
      await Share.share({
        message: `Bora pro rolê "${displayName}"! Acesse o link para entrar na sala:\n\n${inviteUrl}`,
      });
    } catch (error) {
      Alert.alert("Erro", "Não foi possível abrir o compartilhamento.");
    }
  };

  useEffect(() => {
    async function joinAndLoadRoom() {
      if (!id) return;

      try {
        setIsLoading(true);
        const response = await api.post(`/room/${id}/join`);
        const data = response.data;

        const formattedParticipants: Participant[] = (
          data.participants || []
        ).map((p: any) => ({
          id: p.user?.id || p.id,
          username: p.user?.username || p.username || "Participante",
          avatarUrl: p.user?.avatarUrl || p.avatarUrl,
          isHost: (p.user?.id || p.id) === data.hostId,
        }));

        setRoom({
          id: data.id,
          name: data.name,
          code: data.code,
          hostId: data.hostId,
          participants: formattedParticipants,
          status: data.status || "active",
        });
      } catch (error: any) {
        console.error("Erro ao carregar sala:", error);
        Alert.alert(
          "Erro",
          error.response?.data?.error || "Não foi possível acessar a sala.",
          [{ text: "OK", onPress: () => router.replace("/home") }],
        );
      } finally {
        setIsLoading(false);
      }
    }

    joinAndLoadRoom();
  }, [id]);

  const isClosed = room?.status === "closed";

  const handleCloseRoom = () => {
    Alert.alert(
      "Finalizar Rolê",
      "Tem certeza de que deseja encerrar o rolê para todos? A geolocalização em tempo real será desativada, mas as despesas e a galeria continuarão disponíveis.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Finalizar",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              const response = await api.patch(`/room/${id}/close`);

              setRoom((prev) =>
                prev
                  ? {
                      ...prev,
                      status: "closed",
                      closedAt: response.data.closedAt,
                    }
                  : null,
              );

              Alert.alert(
                "Rolê Encerrado",
                "Este rolê foi marcado como finalizado.",
              );
            } catch (error: any) {
              console.error("Erro ao fechar rolê:", error);
              Alert.alert(
                "Erro",
                error.response?.data?.error ||
                  "Não foi possível finalizar o rolê.",
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  if (isLoading && !room) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: displayName,
          headerBackTitle: "Voltar",
        }}
      />

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.roomHeaderRow}>
            <Text style={styles.roomName}>{displayName}</Text>
            {isClosed && (
              <View style={styles.closedBadge}>
                <Text style={styles.closedBadgeText}>Encerrado</Text>
              </View>
            )}
          </View>

          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Código da Sala:</Text>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{displayCode}</Text>
            </View>
          </View>
        </View>

        {!isClosed && (
          <TouchableOpacity
            style={styles.addMemberButton}
            onPress={() => setIsShareModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.addMemberButtonText}>+ Adicionar Membros</Text>
          </TouchableOpacity>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Participantes</Text>
          <Text style={styles.participantCount}>{participantsCount}</Text>
        </View>

        <View style={styles.membersCard}>
          <FlatList
            data={room?.participants || []}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Nenhum participante conectado.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.memberItem}>
                <View style={styles.memberInfo}>
                  {item.avatarUrl ? (
                    <Image
                      source={{ uri: item.avatarUrl }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitial}>
                        {item.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.memberName}>{item.username}</Text>
                </View>

                {item.isHost && (
                  <View style={styles.hostBadge}>
                    <Text style={styles.hostBadgeText}>Host</Text>
                  </View>
                )}
              </View>
            )}
          />
        </View>

        <TouchableOpacity
          style={styles.splitButton}
          onPress={() =>
            router.push({
              pathname: "/expense",
              params: { roomId: id, roomName: displayName },
            })
          }
          activeOpacity={0.8}
        >
          <Text style={styles.actionButtonText}>Divisão de Conta</Text>
        </TouchableOpacity>

        {!isClosed && (
          <TouchableOpacity
            style={styles.mapButton}
            onPress={() =>
              router.push({
                pathname: "/map/[roomId]",
                params: { roomId: id, roomName: displayName },
              })
            }
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>Geolocalização</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.galleryButton}
          onPress={() =>
            router.push({
              pathname: `/gallery/${id}`,
              params: { roomName: displayName },
            })
          }
          activeOpacity={0.8}
        >
          <Text style={styles.actionButtonText}>Galeria do Rolê</Text>
        </TouchableOpacity>

        {!isClosed && (
          <TouchableOpacity
            style={styles.closeRoomButton}
            onPress={handleCloseRoom}
            activeOpacity={0.8}
          >
            <Text style={styles.closeRoomButtonText}>Finalizar Rolê</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={isShareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsShareModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Convidar Galera</Text>
            <Text style={styles.modalSubtitle}>
              Envie o link abaixo para seus amigos entrarem direto neste Rolê.
            </Text>

            <View style={styles.linkContainer}>
              <Text
                style={styles.linkText}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {inviteUrl}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.shareDirectButton}
                onPress={handleShareWhatsApp}
                activeOpacity={0.8}
              >
                <Text style={styles.shareDirectButtonText}>
                  Compartilhar no WhatsApp
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.copyButton, copied && styles.copyButtonSuccess]}
                onPress={handleCopyLink}
                activeOpacity={0.8}
              >
                <Text style={styles.copyButtonText}>
                  {copied ? "Link Copiado! ✓" : "Copiar Link"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsShareModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F5F7",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  infoCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  roomHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  roomName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1A1A1A",
    flex: 1,
    marginRight: 8,
  },
  closedBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  closedBadgeText: {
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FA",
    padding: 10,
    borderRadius: 8,
  },
  codeLabel: {
    fontSize: 13,
    color: "#666",
  },
  codeBadge: {
    backgroundColor: "#E8F2FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#007AFF",
    letterSpacing: 1,
  },
  addMemberButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  addMemberButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "bold",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  participantCount: {
    fontSize: 13,
    color: "#888",
    fontWeight: "600",
  },
  membersCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    elevation: 2,
    maxHeight: 180,
    marginBottom: 12,
  },
  emptyContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 13,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#475569",
  },
  memberName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  hostBadge: {
    backgroundColor: "#E6F4EA",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hostBadgeText: {
    fontSize: 11,
    color: "#137333",
    fontWeight: "600",
  },
  separator: {
    height: 1,
    backgroundColor: "#F0F0F0",
  },

  // Botões de Ação Principais
  splitButton: {
    backgroundColor: "#059669", // Verde esmeralda para finanças
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  mapButton: {
    backgroundColor: "#0284C7", // Azul oceano para GPS
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  galleryButton: {
    backgroundColor: "#6366F1", // Roxo/Índigo para mídia
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "bold",
  },

  // Botão de Finalizar Rolê
  closeRoomButton: {
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#EF4444",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  closeRoomButtonText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "bold",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalContainer: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 24,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  linkContainer: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  linkText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  modalActions: {
    gap: 10,
  },
  shareDirectButton: {
    backgroundColor: "#25D366",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  shareDirectButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  copyButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  copyButtonSuccess: {
    backgroundColor: "#34C759",
  },
  copyButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  closeButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#666",
    fontSize: 15,
    fontWeight: "600",
  },
});
