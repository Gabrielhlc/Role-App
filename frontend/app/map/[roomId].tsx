import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  Platform,
  UIManager,
  LayoutAnimation,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { socket } from "../../src/services/socket";
import { FriendMarker } from "../../src/components/FriendMarker";
import { api } from "../../src/services/api";

// Habilita animações de layout nativas no Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get("window");
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.015;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export interface ParticipantLocation {
  userId: string;
  username: string;
  avatarUrl?: string;
  latitude: number;
  longitude: number;
  updatedAt: number;
}

interface User {
  id: string;
  username: string;
  avatarUrl: string;
}

interface Destination {
  title: string;
  latitude: number;
  longitude: number;
  setBy?: string;
}

// 📐 Fórmula de Haversine: Calcula a distância em linha reta em metros
function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3;
  const toRad = (val: number) => (val * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function RoomMapScreen() {
  const { roomId, roomName } = useLocalSearchParams<{
    roomId: string;
    roomName?: string;
  }>();

  const mapRef = useRef<MapView | null>(null);
  const lastLocationSentRef = useRef<number>(0);
  const isSharingRef = useRef<boolean>(false);

  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [participants, setParticipants] = useState<
    Record<string, ParticipantLocation>
  >({});
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const [user, setUser] = useState<User>({} as User);

  const [destination, setDestination] = useState<Destination | null>(null);
  const [searchAddress, setSearchAddress] = useState("");
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showAddressInput, setShowAddressInput] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      try {
        const response = await api.get("/user");
        setUser(response.data);
      } catch (error: any) {
        console.error("Erro ao carregar informações do usuário:", error);
        Alert.alert(
          "Erro",
          error.response?.data?.error ||
            "Não foi possível acessar as informações do usuário.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const currentUserId = user.id || "user_me_dev";
  const currentUsername = user.username || "Você";

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, [isSharing]);

  useEffect(() => {
    isSharingRef.current = isSharing;
  }, [isSharing]);

  const toggleMapExpansion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  };

  useEffect(() => {
    if (!roomId) return;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("join_room_map", {
      roomId,
      userId: currentUserId,
    });

    socket.on(
      "room_locations_snapshot",
      (activeList: ParticipantLocation[]) => {
        const initialMap: Record<string, ParticipantLocation> = {};
        activeList.forEach((u) => {
          if (u.userId !== currentUserId) {
            initialMap[u.userId] = u;
          }
        });
        setParticipants(initialMap);
      },
    );

    socket.on("user_location_updated", (data: ParticipantLocation) => {
      if (data.userId === currentUserId) return;
      setParticipants((prev) => ({
        ...prev,
        [data.userId]: data,
      }));
    });

    socket.on("room_destination_updated", (dest: Destination) => {
      setDestination(dest);
    });

    socket.on("room_destination_cleared", () => {
      setDestination(null);
      setSearchAddress("");
      setShowAddressInput(false);
    });

    socket.on(
      "user_stopped_sharing",
      ({ userId: leftUserId }: { userId: string }) => {
        setParticipants((prev) => {
          const updated = { ...prev };
          delete updated[leftUserId];
          return updated;
        });
      },
    );

    return () => {
      if (isSharingRef.current) {
        socket.emit("stop_sharing_location", {
          roomId,
          userId: currentUserId,
        });
      }
      socket.off("room_locations_snapshot");
      socket.off("user_location_updated");
      socket.off("user_stopped_sharing");
      socket.off("room_destination_updated");
      socket.off("room_destination_cleared");
      socket.disconnect();
    };
  }, [roomId, currentUserId]);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          setHasPermission(false);
          setIsLoading(false);
          return;
        }

        setHasPermission(true);

        const initialLoc = await Location.getLastKnownPositionAsync({});
        if (initialLoc) {
          setCurrentCoords({
            latitude: initialLoc.coords.latitude,
            longitude: initialLoc.coords.longitude,
          });
        }
        setIsLoading(false);

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 1,
          },
          (newLocation) => {
            const coords = {
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
            };

            setCurrentCoords(coords);

            const now = Date.now();
            if (
              isSharingRef.current &&
              now - lastLocationSentRef.current >= 3000
            ) {
              lastLocationSentRef.current = now;

              socket.emit("send_location", {
                roomId,
                userId: currentUserId,
                username: currentUsername,
                avatarUrl: user.avatarUrl,
                latitude: coords.latitude,
                longitude: coords.longitude,
              });
            }
          },
        );
      } catch (error) {
        console.error("Erro no GPS:", error);
        setIsLoading(false);
      }
    };

    startTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [roomId, currentUserId, currentUsername, user.avatarUrl]);

  const handleToggleSharing = () => {
    if (!isSharing) {
      setIsSharing(true);
      if (currentCoords) {
        lastLocationSentRef.current = Date.now();
        socket.emit("send_location", {
          roomId,
          userId: currentUserId,
          username: currentUsername,
          avatarUrl: user.avatarUrl,
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
        });
      }
    } else {
      setIsSharing(false);
      socket.emit("stop_sharing_location", {
        roomId,
        userId: currentUserId,
      });
    }
  };

  const handleSetDestination = async () => {
    if (!searchAddress.trim()) return;

    try {
      setIsSearchingAddress(true);

      // Converte o endereço digitado em coordenadas geográficas
      const results = await Location.geocodeAsync(searchAddress);

      if (!results || results.length === 0) {
        Alert.alert(
          "Não encontrado",
          "Não encontramos coordenadas para esse endereço.",
        );
        return;
      }

      const { latitude, longitude } = results[0];

      const newDestination: Destination = {
        title: searchAddress.trim(),
        latitude,
        longitude,
        setBy: currentUsername,
      };

      setDestination(newDestination);

      // Dispara para o backend repassar a todos
      socket.emit("set_room_destination", {
        roomId,
        destination: newDestination,
      });

      setSearchAddress("");
      setShowAddressInput(false);

      // Move a câmera para o ponto recém-criado
      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01 * ASPECT_RATIO,
        },
        800,
      );
    } catch (error) {
      console.error("Erro ao buscar endereço:", error);
      Alert.alert("Erro", "Falha ao processar o endereço digitado.");
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleClearDestination = () => {
    Alert.alert(
      "Remover Ponto de Encontro",
      "Tem certeza de que deseja remover o destino do rolê para todos?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => {
            setDestination(null);
            setSearchAddress("");
            setShowAddressInput(false);

            socket.emit("clear_room_destination", { roomId });
          },
        },
      ],
    );
  };

  const handleFocusDestination = () => {
    if (destination && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: destination.latitude,
          longitude: destination.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008 * ASPECT_RATIO,
        },
        500,
      );
    }
  };

  const friendsListWithDistance = useMemo(() => {
    return Object.values(participants)
      .map((friend) => {
        let distanceMeters = 0;
        if (currentCoords) {
          distanceMeters = calculateDistanceInMeters(
            currentCoords.latitude,
            currentCoords.longitude,
            friend.latitude,
            friend.longitude,
          );
        }
        return {
          ...friend,
          distanceMeters,
          distanceFormatted: currentCoords
            ? formatDistance(distanceMeters)
            : "--",
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [participants, currentCoords]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Iniciando mapa...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.permissionTitle}>
          Permissão de GPS necessária 📍
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: roomName ? `Mapa - ${roomName}` : "Mapa do Rolê" }}
      />

      <View
        style={[
          styles.mapSection,
          isExpanded ? styles.mapExpanded : styles.mapHalf,
        ]}
      >
        {currentCoords && (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: currentCoords.latitude,
              longitude: currentCoords.longitude,
              latitudeDelta: LATITUDE_DELTA,
              longitudeDelta: LONGITUDE_DELTA,
            }}
            showsMyLocationButton={false}
            showsCompass={false}
          >
            <Marker
              key={`my-marker-${isSharing ? "sharing" : "paused"}`}
              coordinate={currentCoords}
              title="Você"
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={tracksViewChanges}
            >
              <View style={styles.markerContainer}>
                <View
                  style={[
                    styles.userAvatarContainer,
                    isSharing
                      ? styles.userAvatarActive
                      : styles.userAvatarInactive,
                  ]}
                >
                  <Text style={styles.userInitialText}>
                    {currentUsername.charAt(0).toUpperCase()}
                  </Text>

                  <View
                    style={[
                      styles.statusBadgeDot,
                      isSharing ? styles.badgeActive : styles.badgeInactive,
                    ]}
                  />
                </View>

                <View style={styles.userLabelContainer}>
                  <Text style={styles.userLabelText}>Você</Text>
                </View>
              </View>
            </Marker>

            {friendsListWithDistance.map((friend) => (
              <FriendMarker key={friend.userId} friend={friend} />
            ))}

            {destination && (
              <Marker
                key={`dest-${destination.latitude}-${destination.longitude}`}
                coordinate={{
                  latitude: destination.latitude,
                  longitude: destination.longitude,
                }}
                title="Ponto de Encontro"
                description={destination.title}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.destinationPinContainer}>
                  <View style={styles.destinationIconCircle}>
                    <Text style={styles.destinationEmoji}>🏁</Text>
                  </View>
                  <View style={styles.destinationLabel}>
                    <Text style={styles.destinationTitleText} numberOfLines={1}>
                      {destination.title}
                    </Text>
                  </View>
                  <View style={styles.destinationArrow} />
                </View>
              </Marker>
            )}
          </MapView>
        )}

        {/* 🎯 Grupo de Ações Rápidas (Destino + Usuário) */}
        <View style={styles.mapActionsGroup}>
          {destination && (
            <TouchableOpacity
              style={styles.destinationFocusButton}
              activeOpacity={0.8}
              onPress={handleFocusDestination}
            >
              <Text style={styles.actionButtonEmoji}>🏁</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.recenterButton}
            activeOpacity={0.8}
            onPress={() => {
              if (currentCoords && mapRef.current) {
                mapRef.current.animateToRegion(
                  {
                    ...currentCoords,
                    latitudeDelta: LATITUDE_DELTA,
                    longitudeDelta: LONGITUDE_DELTA,
                  },
                  500,
                );
              }
            }}
          >
            <Text style={styles.actionButtonEmoji}>🎯</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.expandToggleButton}
          activeOpacity={0.8}
          onPress={toggleMapExpansion}
        >
          <Text style={styles.expandToggleIcon}>
            {isExpanded ? "Menu do rolê" : "⛶ Tela cheia"}
          </Text>
        </TouchableOpacity>
      </View>

      {!isExpanded && (
        <View style={styles.bottomSection}>
          <View style={styles.shareCard}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusIndicator,
                  isSharing ? styles.statusActive : styles.statusInactive,
                ]}
              />
              <Text style={styles.statusText}>
                {isSharing
                  ? "Transmitindo sua posição ao vivo"
                  : "Seu local está oculto no rolê"}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.actionButton,
                isSharing
                  ? styles.actionButtonActive
                  : styles.actionButtonInactive,
              ]}
              onPress={handleToggleSharing}
              activeOpacity={0.85}
            >
              <Text style={styles.actionButtonText}>
                {isSharing
                  ? "Parar de Compartilhar"
                  : "Compartilhar com o rolê"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Amigos no Rolê</Text>
            <View style={styles.onlineBadge}>
              <Text style={styles.onlineBadgeText}>
                {friendsListWithDistance.length} online
              </Text>
            </View>
          </View>

          {destination ? (
            <View style={styles.destinationCard}>
              <View style={styles.destinationCardLeft}>
                <Text style={styles.destinationCardBadge}>🏁 DESTINO</Text>
                <Text style={styles.destinationCardTitle} numberOfLines={1}>
                  {destination.title}
                </Text>
                <Text style={styles.destinationSetBy}>
                  Definido por {destination.setBy}
                </Text>
                {currentCoords && (
                  <Text style={styles.destinationCardDist}>
                    Você está a{" "}
                    {formatDistance(
                      calculateDistanceInMeters(
                        currentCoords.latitude,
                        currentCoords.longitude,
                        destination.latitude,
                        destination.longitude,
                      ),
                    )}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.clearDestButton}
                onPress={handleClearDestination}
              >
                <Text style={styles.clearDestIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.setDestWrapper}>
              {showAddressInput ? (
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.addressInput}
                    placeholder="Digite o endereço ou nome do local..."
                    placeholderTextColor="#94A3B8"
                    value={searchAddress}
                    onChangeText={setSearchAddress}
                    onSubmitEditing={handleSetDestination}
                    returnKeyType="search"
                  />
                  <TouchableOpacity
                    style={styles.confirmSearchButton}
                    onPress={handleSetDestination}
                    disabled={isSearchingAddress}
                  >
                    {isSearchingAddress ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.confirmSearchText}>Fixar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.openInputButton}
                  onPress={() => setShowAddressInput(true)}
                >
                  <Text style={styles.openInputText}>
                    + Definir Ponto de Encontro
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView
            style={styles.friendsList}
            contentContainerStyle={styles.friendsListContent}
            showsVerticalScrollIndicator={false}
          >
            {friendsListWithDistance.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>⏳</Text>
                <Text style={styles.emptyText}>
                  Nenhum amigo compartilhando localização no momento.
                </Text>
              </View>
            ) : (
              friendsListWithDistance.map((friend) => (
                <TouchableOpacity
                  key={friend.userId}
                  style={styles.friendCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (mapRef.current) {
                      mapRef.current.animateToRegion(
                        {
                          latitude: friend.latitude,
                          longitude: friend.longitude,
                          latitudeDelta: 0.008,
                          longitudeDelta: 0.008 * ASPECT_RATIO,
                        },
                        600,
                      );
                    }
                  }}
                >
                  <View style={styles.friendLeft}>
                    {friend.avatarUrl ? (
                      <Image
                        source={{ uri: friend.avatarUrl }}
                        style={styles.cardAvatar}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.cardFallbackAvatar}>
                        <Text style={styles.cardFallbackText}>
                          {friend.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{friend.username}</Text>
                      <Text style={styles.friendSubtext}>
                        Toque para focar no mapa
                      </Text>
                    </View>
                  </View>

                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceText}>
                      {friend.distanceFormatted}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: { marginTop: 12, fontSize: 15, color: "#64748B" },
  permissionTitle: { fontSize: 16, fontWeight: "bold", color: "#1E293B" },

  mapSection: { width: "100%", position: "relative" },
  mapHalf: { height: "48%" },
  mapExpanded: { height: "100%" },
  map: { width: "100%", height: "100%" },

  bottomSection: {
    height: "52%",
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    paddingTop: 16,
    paddingHorizontal: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },

  mapActionsGroup: {
    position: "absolute",
    bottom: 20,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  destinationFocusButton: {
    backgroundColor: "#FEF2F2",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  recenterButton: {
    backgroundColor: "#FFF",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  actionButtonEmoji: {
    fontSize: 20,
  },

  expandToggleButton: {
    position: "absolute",
    bottom: 40,
    left: 16,
    backgroundColor: "rgba(6, 54, 167, 0.9)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    elevation: 5,
  },
  expandToggleIcon: { color: "#FFF", fontSize: 13, fontWeight: "bold" },

  shareCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  statusRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  statusIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusActive: { backgroundColor: "#10B981" },
  statusInactive: { backgroundColor: "#94A3B8" },
  statusText: { fontSize: 12, color: "#64748B", fontWeight: "600", flex: 1 },

  actionButton: { paddingVertical: 11, borderRadius: 10, alignItems: "center" },
  actionButtonInactive: { backgroundColor: "#3B82F6" },
  actionButtonActive: { backgroundColor: "#EF4444" },
  actionButtonText: { color: "#FFF", fontSize: 14, fontWeight: "bold" },

  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  listTitle: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  onlineBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  onlineBadgeText: { fontSize: 11, color: "#475569", fontWeight: "700" },

  friendsList: { flex: 1 },
  friendsListContent: { paddingBottom: 20 },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  friendLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  friendInfo: { marginLeft: 12, flex: 1 },
  friendName: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  friendSubtext: { fontSize: 11, color: "#94A3B8", marginTop: 2 },

  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  distanceIcon: { fontSize: 12, marginRight: 4 },
  distanceText: { fontSize: 14, fontWeight: "700", color: "#1D4ED8" },

  emptyContainer: { alignItems: "center", paddingVertical: 28 },
  emptyEmoji: { fontSize: 26, marginBottom: 6 },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    maxWidth: 220,
  },

  markerContainer: { alignItems: "center" },
  userAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    backgroundColor: "#0F172A",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  userAvatarActive: {
    borderColor: "#10B981",
  },
  userAvatarInactive: {
    borderColor: "#94A3B8",
  },
  userInitialText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 18,
  },

  statusBadgeDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    zIndex: 10,
  },
  badgeActive: {
    backgroundColor: "#10B981",
  },
  badgeInactive: {
    backgroundColor: "#94A3B8",
  },

  userLabelContainer: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  userLabelText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },

  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E2E8F0",
  },
  cardFallbackAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  cardFallbackText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },

  destinationPinContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 140,
  },
  destinationIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#DC2626",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  destinationEmoji: {
    fontSize: 18,
  },
  destinationLabel: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
    maxWidth: 130,
  },
  destinationTitleText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  destinationArrow: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "rgba(15, 23, 42, 0.9)",
    marginTop: -1,
  },

  destinationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  destinationCardLeft: {
    flex: 1,
    marginRight: 8,
  },
  destinationCardBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  destinationCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  destinationSetBy: {
    fontSize: 11,
    color: "#888",
    fontWeight: "500",
    marginTop: 2,
  },
  destinationCardDist: {
    fontSize: 12,
    color: "#B91C1C",
    fontWeight: "600",
    marginTop: 2,
  },
  clearDestButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  clearDestIcon: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "bold",
  },

  // ==========================================
  // 🔍 INPUT DE BUSCA DE ENDEREÇO
  // ==========================================
  setDestWrapper: {
    marginBottom: 12,
  },
  openInputButton: {
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  openInputText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addressInput: {
    flex: 1,
    height: 44,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#0F172A",
  },
  confirmSearchButton: {
    height: 44,
    backgroundColor: "#0F172A",
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmSearchText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
});
