import { Stack } from "expo-router";
import { AuthProvider } from "../contexts/AuthContext_Simple";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="index" />
        <Stack.Screen name="dashboard" />
      </Stack>
    </AuthProvider>
  );
}
