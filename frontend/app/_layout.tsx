import { useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import {
  Slot,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import * as Linking from "expo-linking";

function InitialLayout() {
  const { token, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const navigationState = useRootNavigationState();
  const url = Linking.useLinkingURL();

  useEffect(() => {
    if (isLoading) return;

    if (!navigationState?.key) return;

    const firstSegment = segments[0];

    const parsedUrl = url ? Linking.parse(url) : null;
    const hasDeepLinkPath = Boolean(
      url && (parsedUrl?.hostname || parsedUrl?.path),
    );

    const inAuthGroup = firstSegment === undefined || firstSegment === "index";
    const isProtectedRoute = firstSegment === "room" || firstSegment === "home";

    if (!token) {
      if (isProtectedRoute || hasDeepLinkPath) {
        router.replace("/");
      }
    } else {
      if (inAuthGroup && !hasDeepLinkPath) {
        router.replace("/home");
      }
    }
  }, [token, isLoading, segments, navigationState?.key]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <InitialLayout />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F5F7",
  },
});
