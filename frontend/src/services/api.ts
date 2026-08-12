import axios from "axios";
import * as SecureStore from "expo-secure-store";

const IP_LOCAL = process.env.EXPO_PUBLIC_API_BASE_URL;

export const api = axios.create({
  baseURL: IP_LOCAL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync("userToken");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Erro ao carregar o token do SecureStore:", error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const serverMessage =
        error.response.data?.error ||
        error.response.data?.message ||
        `Erro ${error.response.status}: Não foi possível processar a requisição.`;

      error.message = serverMessage;
    } else if (error.request) {
      error.message =
        "Servidor indisponível. Verifique sua conexão com a internet.";
    }

    return Promise.reject(error);
  },
);
