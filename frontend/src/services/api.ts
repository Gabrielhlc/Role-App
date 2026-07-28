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
