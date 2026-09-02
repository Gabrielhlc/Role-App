import "dotenv/config";
import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Role",
  slug: "role-app",
  scheme: "roleapp",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.gabriel.roleapp",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Precisamos da sua localização para você ver e compartilhar sua posição com seus amigos no rolê.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Sua localização será compartilhada em segundo plano apenas enquanto o compartilhamento do rolê estiver ativo.",
    },
  },
  android: {
    package: "com.gabriel.roleapp",
    predictiveBackGestureEnabled: false,
    usesCleartextTraffic: true,
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
    ],
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "@react-native-google-signin/google-signin",
    "expo-secure-store",
    "expo-router",
    "expo-status-bar",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Permitir que o aplicativo acesse sua localização para compartilhar com seus amigos no rolê.",
      },
    ],
  ],
});
