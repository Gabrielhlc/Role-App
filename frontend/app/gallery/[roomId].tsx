import { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../src/services/api";
import { socket } from "../../src/services/socket";
import { uploadMediaToRoom } from "../../src/services/mediaUpload";
import * as MediaLibrary from "expo-media-library/legacy";
import * as FileSystem from "expo-file-system/legacy";

const { width, height } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const ITEM_SIZE = (width - 32 - (COLUMN_COUNT - 1) * 6) / COLUMN_COUNT;

export interface RoomMediaItem {
  id: string;
  roomId: string;
  userId: string;
  type: "IMAGE" | "VIDEO";
  viewUrl: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}

export default function RoomGalleryScreen() {
  const { roomId, roomName } = useLocalSearchParams<{
    roomId: string;
    roomName?: string;
  }>();

  const [mediaList, setMediaList] = useState<RoomMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<RoomMediaItem | null>(
    null,
  );
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchGallery = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/media/rooms/${roomId}/media`);
      setMediaList(response.data);
    } catch (error) {
      console.error("Erro ao carregar galeria:", error);
      Alert.alert("Erro", "Não foi possível carregar a galeria do rolê.");
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  useEffect(() => {
    if (!roomId) return;

    socket.emit("join_room", { roomId });

    const handleNewMedia = (newMedia: RoomMediaItem) => {
      setMediaList((prev) => [newMedia, ...prev]);
    };

    socket.on("new_media_uploaded", handleNewMedia);

    return () => {
      socket.off("new_media_uploaded", handleNewMedia);
    };
  }, [roomId]);

  const handlePickAndUploadMedia = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permissão necessária",
          "Precisamos de acesso às suas fotos para adicioná-las à galeria.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setIsUploading(true);

      const userRes = await api.get("/user");
      const currentUserId = userRes.data.id;

      const newMedia = await uploadMediaToRoom({
        roomId,
        userId: currentUserId,
        uri: asset.uri,
        type: asset.type === "video" ? "video" : "image",
        mimeType:
          asset.mimeType ||
          (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      });

      if (newMedia) {
        setMediaList((prev) => {
          if (prev.some((item) => item.id === newMedia.id)) return prev;
          return [newMedia, ...prev];
        });
      }

      await uploadMediaToRoom({
        roomId,
        userId: currentUserId,
        uri: asset.uri,
        type: asset.type === "video" ? "video" : "image",
        mimeType:
          asset.mimeType ||
          (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      });
    } catch (error: any) {
      console.error("Falha no upload:", error);
      Alert.alert(
        "Erro no envio",
        "Não foi possível enviar a mídia para o rolê.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveToGallery = async (media: RoomMediaItem) => {
    try {
      setIsDownloading(true);

      // 1. Solicita permissão de escrita na galeria de fotos
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Precisamos de permissão para salvar arquivos na sua galeria.",
        );
        return;
      }

      // 2. Define o nome e caminho temporário do arquivo no cache
      const extension = media.type === "VIDEO" ? "mp4" : "jpg";
      const filename = `role_${media.roomId}_${Date.now()}.${extension}`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      // 3. Faz o download do arquivo via Presigned View URL
      const downloadResult = await FileSystem.downloadAsync(
        media.viewUrl,
        fileUri,
      );

      if (downloadResult.status !== 200) {
        throw new Error("Falha ao transferir o arquivo.");
      }

      // 4. Grava no rolo de câmera nativo do Android / iOS
      await MediaLibrary.saveToLibraryAsync(downloadResult.uri);

      // 5. Remove o arquivo temporário do cache local para não ocupar espaço duplicado
      await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });

      Alert.alert("Salvo!", "A mídia foi salva na galeria do seu celular.");
    } catch (error) {
      console.error("Erro ao salvar mídia:", error);
      Alert.alert("Erro", "Não foi possível salvar o arquivo no aparelho.");
    } finally {
      setIsDownloading(false);
    }
  };

  const renderItem = ({ item }: { item: RoomMediaItem }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.mediaThumbnail}
      onPress={() => setSelectedMedia(item)}
    >
      <Image
        source={{ uri: item.viewUrl }}
        style={styles.thumbnailImage}
        resizeMode="cover"
      />
      {item.type === "VIDEO" && (
        <View style={styles.videoBadge}>
          <Text style={styles.videoBadgeText}>▶</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: roomName ? `Galeria - ${roomName}` : "Galeria do Rolê",
        }}
      />

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.mediaCountText}>
            {mediaList.length} {mediaList.length === 1 ? "mídia" : "mídias"}
          </Text>
          <Text style={styles.subtext}>Memórias centralizadas da galera</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.uploadButton,
            isUploading && styles.uploadButtonDisabled,
          ]}
          onPress={handlePickAndUploadMedia}
          disabled={isUploading}
          activeOpacity={0.85}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.uploadButtonText}>+ Adicionar</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Carregando memórias...</Text>
        </View>
      ) : (
        <FlatList
          data={mediaList}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📸</Text>
              <Text style={styles.emptyTitle}>Nenhuma mídia no rolê ainda</Text>
              <Text style={styles.emptySubtitle}>
                Seja o primeiro a compartilhar fotos ou vídeos deste momento!
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={!!selectedMedia}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMedia(null)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={() => setSelectedMedia(null)}
          >
            <Text style={styles.closeModalText}>✕ Fechar</Text>
          </TouchableOpacity>

          {selectedMedia && (
            <View style={styles.modalContent}>
              <Image
                source={{ uri: selectedMedia.viewUrl }}
                style={styles.fullImage}
                resizeMode="contain"
              />

              {/* Rodapé com Informações do Autor e Ação de Download */}
              <View style={styles.modalFooter}>
                {selectedMedia.user && (
                  <View style={styles.authorBadge}>
                    <Text style={styles.authorText}>
                      Enviado por {selectedMedia.user.username}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.downloadButton,
                    isDownloading && styles.downloadButtonDisabled,
                  ]}
                  onPress={() => handleSaveToGallery(selectedMedia)}
                  disabled={isDownloading}
                  activeOpacity={0.8}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.downloadButtonText}>
                      ⬇ Salvar no Celular
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
    backgroundColor: "#0F172A", // Tema escuro destaca mais as fotos
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 12,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  mediaCountText: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "bold",
  },
  subtext: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  uploadButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    minWidth: 105,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },

  gridContent: {
    padding: 16,
    gap: 6,
  },
  mediaThumbnail: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1E293B",
    marginRight: 6,
    marginBottom: 6,
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  videoBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  videoBadgeText: {
    color: "#FFF",
    fontSize: 10,
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },

  // Modal Tela Cheia
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeModalButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeModalText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  modalContent: {
    width: "100%",
    height: height * 0.8,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  modalFooter: {
    position: "absolute",
    bottom: 30,
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  authorBadge: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  authorText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
  },
  downloadButton: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 4,
    minWidth: 160,
  },
  downloadButtonDisabled: {
    opacity: 0.7,
  },
  downloadButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
});
