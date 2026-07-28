import LoginScreen from "../src/screens/LoginScreen";
import { useLocalSearchParams } from "expo-router/build/hooks/useLocalSearchParams";

export default function Login() {
  const { isRedirected } = useLocalSearchParams<{ isRedirected?: string }>();
  return <LoginScreen isRedirected={isRedirected === "true"} />;
}
