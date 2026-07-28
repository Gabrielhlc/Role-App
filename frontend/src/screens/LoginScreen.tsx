import { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { api } from "./../services/api";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

interface LoginScreenProps {
  isRedirected: boolean;
}

export default function LoginScreen({ isRedirected }: LoginScreenProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const router = useRouter();

  const { signIn } = useAuth();

  useEffect(() => {
    // Inicializa as credenciais do Google assim que a tela abre
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
    });
  }, []);

  useEffect(() => {
    if (isRedirected) {
      Alert.alert(
        "Acesso Negado",
        "Você precisa estar logado para acessar este rolê.",
      );
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsAuthenticating(true);
    try {
      await GoogleSignin.hasPlayServices();

      const response = await GoogleSignin.signIn();

      const idToken = response.data?.idToken;

      if (!idToken) {
        throw new Error("Não foi possível obter o ID Token do Google.");
      }

      await exchangeTokenWithBackend(idToken);
      router.push("/home");
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert("Cancelado", "Você cancelou o login.");
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert("Aguarde", "O login já está em andamento.");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(
          "Erro",
          "Google Play Services não disponível ou desatualizado.",
        );
      } else {
        console.error("Erro no Google Sign-In:", error);
        Alert.alert(
          "Erro",
          error.message || "Falha ao autenticar com o Google.",
        );
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const exchangeTokenWithBackend = async (idToken: string) => {
    try {
      const res = await api.post("/auth/google", { idToken });

      const data = await res.data;

      if (res.status !== 200)
        throw new Error(data.error || "Erro no servidor do Rolê.");

      await signIn(data.token);

      Alert.alert("Sucesso", `Bem-vindo, ${data.user.username}!`);
      console.log("JWT do Rolê salvo no celular.");
    } catch (error: any) {
      Alert.alert(
        "Erro de Rede",
        error.message || "Não foi possível comunicar com o servidor.",
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* <Text style={styles.emoji}>🚀</Text> */}
        <Text style={styles.title}>Rolê</Text>
        <Text style={styles.subtitle}>facilitador de encontros casuais</Text>
      </View>

      <View style={styles.buttonContainer}>
        {isAuthenticating ? (
          <ActivityIndicator size="large" color="#007AFF" />
        ) : (
          <TouchableOpacity
            style={[styles.button, isAuthenticating && styles.buttonDisabled]}
            onPress={() => {
              setIsAuthenticating(true);
              handleGoogleLogin().finally(() => setIsAuthenticating(false));
            }}
            disabled={isAuthenticating}
          >
            <Text style={styles.buttonText}>Entrar com o Google</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  header: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#1A1A1A",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  buttonContainer: {
    marginBottom: 20,
    height: 80,
    justifyContent: "center",
  },
  button: {
    backgroundColor: "#007AFF", // Azul padrão iOS/Moderno
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Sombra para Android
  },
  buttonDisabled: {
    backgroundColor: "#B3D7FF",
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
