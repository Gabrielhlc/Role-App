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
} from "react-native";
import * as Linking from "expo-linking";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { api } from "../../src/services/api";

interface ParticipantMock {
  id: string;
  username: string;
  isHost: boolean;
}

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
}

const MOCK_PARTICIPANTS: ParticipantMock[] = [
  { id: "1", username: "Você", isHost: true },
];

export default function RoomDetailsScreen() {
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [room, setRoom] = useState<RoomData | null>(null);

  const [copied, setCopied] = useState(false);

  const { id, name, code } = useLocalSearchParams<{
    id: string;
    name?: string;
    code?: string;
  }>();

  const router = useRouter();

  const roomDeepLink = Linking.createURL(`room/${id}`, {
    queryParams: { name, code },
  });

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(roomDeepLink);
      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível copiar o link.");
    }
  };

  useEffect(() => {
    async function joinAndLoadRoom() {
      if (!id) return;

      try {
        setIsLoading(true);
        const response = await api.post(`/room/${id}/join`);
        const data = response.data;

        const formattedParticipants: Participant[] = data.participants.map(
          (p: any) => ({
            id: p.user.id,
            username: p.user.username,
            avatarUrl: p.user.avatarUrl,
            isHost: p.user.id === data.hostId,
          }),
        );

        setRoom({
          id: data.id,
          name: data.name,
          code: data.code,
          hostId: data.hostId,
          participants: formattedParticipants,
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

  if (isLoading) {
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
          title: name || "Detalhes do Rolê",
          headerBackTitle: "Voltar",
        }}
      />

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.roomName}>{name || "Nome do Rolê"}</Text>
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Código da Sala:</Text>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{code || "------"}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addMemberButton}
          onPress={() => setIsShareModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addMemberButtonText}>Adicionar Membros</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Participantes</Text>
          <Text style={styles.participantCount}>
            {MOCK_PARTICIPANTS.length}
          </Text>
        </View>

        <View style={styles.membersCard}>
          <FlatList
            data={room?.participants}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <View style={styles.memberItem}>
                <View style={styles.memberInfo}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {item.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
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
              Envie o link abaixo para os seus amigos entrarem direto neste
              Rolê.
            </Text>

            <View style={styles.linkContainer}>
              <Text
                style={styles.linkText}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {roomDeepLink}
              </Text>
            </View>

            <View style={styles.modalActions}>
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
    paddingTop: 16,
  },
  infoCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
  },
  roomName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 10,
  },
  codeLabel: {
    fontSize: 14,
    color: "#666",
  },
  codeBadge: {
    backgroundColor: "#E8F2FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#007AFF",
    letterSpacing: 1,
  },
  addMemberButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  addMemberButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  participantCount: {
    fontSize: 14,
    color: "#888",
    fontWeight: "600",
  },
  membersCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    elevation: 2,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#475569",
  },
  memberName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
  },
  hostBadge: {
    backgroundColor: "#E6F4EA",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hostBadgeText: {
    fontSize: 12,
    color: "#137333",
    fontWeight: "600",
  },
  separator: {
    height: 1,
    backgroundColor: "#F0F0F0",
  },

  // Estilos do Modal
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
  copyButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  copyButtonSuccess: {
    backgroundColor: "#34C759", // Cor verde ao copiar
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
