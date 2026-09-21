import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

export const LOCATION_BACKGROUND_TASK = "ROLE_BACKGROUND_LOCATION_TASK";

const MIN_DISTANCE_THRESHOLD_METERS = 20;

function getDistanceInMeters(
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

TaskManager.defineTask(LOCATION_BACKGROUND_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Erro na tarefa de background:", error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const latest = locations[locations.length - 1];

    if (!latest) return;

    try {
      const activeRoomId = await AsyncStorage.getItem("@role:active_room_id");
      const activeUserRaw = await AsyncStorage.getItem(
        "@role:active_user_data",
      );

      if (!activeRoomId || !activeUserRaw) return;

      const lastSentRaw = await AsyncStorage.getItem("@role:last_sent_coords");
      if (lastSentRaw) {
        const lastSent = JSON.parse(lastSentRaw);
        const distanceMoved = getDistanceInMeters(
          lastSent.latitude,
          lastSent.longitude,
          latest.coords.latitude,
          latest.coords.longitude,
        );

        if (distanceMoved < MIN_DISTANCE_THRESHOLD_METERS) {
          return;
        }

        console.log(
          `🚶 Deslocamento relevante detectado: ${distanceMoved.toFixed(1)}m`,
        );
      }

      const user = JSON.parse(activeUserRaw);

      await api.post(`/room/${activeRoomId}/location`, {
        latitude: latest.coords.latitude,
        longitude: latest.coords.longitude,
        username: user.username,
        avatarUrl: user.avatarUrl,
      });

      await AsyncStorage.setItem(
        "@role:last_sent_coords",
        JSON.stringify({
          latitude: latest.coords.latitude,
          longitude: latest.coords.longitude,
        }),
      );

      console.log(
        `[BG SUCCESS] Posição enviada: ${latest.coords.latitude}, ${latest.coords.longitude}`,
      );
    } catch (err) {
      console.error("[BACKGROUND] Falha ao processar posição:", err);
    }
  }
});

export async function startBackgroundTracking(
  roomId: string,
  user: { username: string; avatarUrl?: string },
) {
  await AsyncStorage.setItem("@role:active_room_id", roomId);
  await AsyncStorage.setItem("@role:active_user_data", JSON.stringify(user));
  await AsyncStorage.removeItem("@role:last_sent_coords");

  await Location.startLocationUpdatesAsync(LOCATION_BACKGROUND_TASK, {
    accuracy: Location.Accuracy.High, // Alterar ao gerar apk
    timeInterval: 5000,
    distanceInterval: 20,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Rolê ao vivo",
      notificationBody:
        "Compartilhando sua localização com os amigos no rolê...",
      notificationColor: "#0F172A",
    },
  });
}

export async function stopBackgroundTracking() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    LOCATION_BACKGROUND_TASK,
  );
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
  }
  await AsyncStorage.removeItem("@role:active_room_id");
  await AsyncStorage.removeItem("@role:active_user_data");
  await AsyncStorage.removeItem("@role:last_sent_coords");
}
