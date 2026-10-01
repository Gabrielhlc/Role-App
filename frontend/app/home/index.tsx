import React, { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/services/api";
import { useFocusEffect, useRouter } from "expo-router";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useAuth } from "../../src/contexts/AuthContext";

interface User {
  username: string;
  email: string;
  avatarUrl?: string;
}

interface Room {
  id: string;
  code: string;
  name: string;
  status?: "active" | "closed" | string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const { signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await GoogleSignin.signOut();
    } catch (error) {
      console.log("Erro ao deslogar do Google SDK:", error);
    } finally {
      signOut();
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      Alert.alert("Campo Obrigatório", "Por favor, informe o nome do Rolê.");
      return;
    }

    setIsCreatingRoom(true);

    try {
      const res = await api.post("/room/create", {
        name: newRoomName.trim(),
      });

      const createdRoom: Room = {
        ...res.data,
        status: res.data.status || "active",
      };

      setRooms((prevRooms) => [createdRoom, ...prevRooms]);
      setNewRoomName("");
      setIsModalVisible(false);

      router.push({
        pathname: "/room/[id]",
        params: {
          id: createdRoom.id,
          name: createdRoom.name,
          code: createdRoom.code,
        },
      });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || "Não foi possível criar a sala.";
      Alert.alert("Erro", errorMessage);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const fetchUserAndRooms = async () => {
    try {
      setIsLoading(true);

      const [userRes, roomsRes] = await Promise.all([
        api.get("/user"),
        api.get("/room/my-rooms"),
      ]);

      setUser(userRes.data);
      setRooms(roomsRes.data);
    } catch (error) {
      console.log("Erro ao carregar dados da Home:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserAndRooms();
    }, []),
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const userInitial = user?.username
    ? user.username.charAt(0).toUpperCase()
    : "U";

  const activeRooms = rooms.filter((r) => r.status !== "closed");
  const closedRooms = rooms.filter((r) => r.status === "closed");

  const navigateToRoom = (room: Room) => {
    router.push({
      pathname: "/room/[id]",
      params: {
        id: room.id,
        name: room.name,
        code: room.code,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{userInitial}</Text>
            </View>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.welcomeText}>Bem-vindo de volta,</Text>
            <Text style={styles.usernameText}>
              {user?.username || "Usuário"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Rolês Ativos</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{activeRooms.length}</Text>
            </View>
          </View>

          <View style={styles.card}>
            {activeRooms.length > 0 ? (
              activeRooms.map((item, index) => (
                <React.Fragment key={item.id}>
                  <TouchableOpacity
                    style={styles.roomItem}
                    activeOpacity={0.7}
                    onPress={() => navigateToRoom(item)}
                  >
                    <View style={styles.roomInfo}>
                      <Text style={styles.roomName}>{item.name}</Text>
                      <Text style={styles.roomCode}>Código: {item.code}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                  {index < activeRooms.length - 1 && (
                    <View style={styles.separator} />
                  )}
                </React.Fragment>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Nenhum rolê ativo no momento.
                </Text>
              </View>
            )}
          </View>

          {closedRooms.length > 0 && (
            <>
              <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
                <Text style={[styles.sectionTitle, styles.closedSectionTitle]}>
                  Rolês Finalizados
                </Text>
                <View style={[styles.countBadge, styles.closedCountBadge]}>
                  <Text style={styles.closedCountBadgeText}>
                    {closedRooms.length}
                  </Text>
                </View>
              </View>

              <View style={[styles.card, styles.closedCard]}>
                {closedRooms.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <TouchableOpacity
                      style={styles.roomItem}
                      activeOpacity={0.7}
                      onPress={() => navigateToRoom(item)}
                    >
                      <View style={styles.roomInfo}>
                        <View style={styles.closedTitleRow}>
                          <Text style={styles.closedRoomName}>{item.name}</Text>
                          <View style={styles.closedPill}>
                            <Text style={styles.closedPillText}>Encerrado</Text>
                          </View>
                        </View>
                        <Text style={styles.roomCode}>Código: {item.code}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                    {index < closedRooms.length - 1 && (
                      <View style={styles.separator} />
                    )}
                  </React.Fragment>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setIsModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.createButtonText}>+ Criar Novo Rolê</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutButtonText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Criar Novo Rolê</Text>
            <Text style={styles.modalSubtitle}>Qual o evento?</Text>

            <TextInput
              style={styles.input}
              placeholder="Ex: Churrasco do Fim de Semana"
              placeholderTextColor="#999"
              value={newRoomName}
              onChangeText={setNewRoomName}
              autoFocus
              maxLength={40}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsModalVisible(false)}
                disabled={isCreatingRoom}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleCreateRoom}
                disabled={isCreatingRoom}
              >
                {isCreatingRoom ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Criar</Text>
                )}
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
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F5F7",
  },
  header: {
    paddingVertical: 14,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  welcomeText: {
    fontSize: 13,
    color: "#666",
  },
  usernameText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  closedSectionTitle: {
    color: "#64748B",
  },
  countBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  closedCountBadge: {
    backgroundColor: "#F1F5F9",
  },
  closedCountBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    elevation: 2,
  },
  closedCard: {
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 0,
  },
  roomItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
  },
  closedTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closedRoomName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
  },
  closedPill: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  closedPillText: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  roomCode: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: "#CCC",
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: "#F0F0F0",
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 14,
  },
  footer: {
    paddingTop: 10,
    paddingBottom: 8,
  },
  createButton: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    marginBottom: 8,
  },
  createButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  logoutButton: {
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonText: {
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
  input: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#1A1A1A",
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#F1F3F5",
  },
  cancelButtonText: {
    color: "#495057",
    fontWeight: "600",
  },
  confirmButton: {
    backgroundColor: "#007AFF",
  },
  confirmButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
});
