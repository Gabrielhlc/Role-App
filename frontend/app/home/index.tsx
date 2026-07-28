import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/services/api";
import { useRouter } from "expo-router";
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

      const createdRoom: Room = res.data;

      setRooms((prevRooms) => [createdRoom, ...prevRooms]);

      setNewRoomName("");
      setIsModalVisible(false);

      // Alert.alert(
      //   "Sucesso!",
      //   `A sala "${createdRoom.name}" foi criada com o código ${createdRoom.code}`,
      // );

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

  useEffect(() => {
    fetchUserAndRooms();
  }, []);

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
        <Text style={styles.sectionTitle}>Seus Rolês</Text>

        <View style={styles.card}>
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.roomItem}
                activeOpacity={0.7}
                onPress={() => {
                  router.push({
                    pathname: "/room/[id]",
                    params: {
                      id: item.id,
                      name: item.name,
                      code: item.code,
                    },
                  });
                }}
              >
                <View style={styles.roomInfo}>
                  <Text style={styles.roomName}>{item.name}</Text>
                  <Text style={styles.roomCode}>Código: {item.code}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Você ainda não participa de nenhuma sala.
                </Text>
              </View>
            }
          />
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setIsModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.createButtonText}>Criar Novo Rolê</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.createButtonText}>Sair</Text>
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
    paddingVertical: 16,
    marginBottom: 8,
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
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    maxHeight: 380,
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
    color: "#888",
    fontSize: 14,
  },
  footer: {
    paddingVertical: 16,
  },
  createButton: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  logoutButton: {
    backgroundColor: "#FF3B30",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  createButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
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
