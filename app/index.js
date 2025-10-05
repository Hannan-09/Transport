import { Link } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext_Simple";

export default function Index() {
  const { isAuthenticated } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Transport Ledger</Text>
        <Text style={styles.subtitle}>Manage your transport business</Text>

        <View style={styles.buttonContainer}>
          {isAuthenticated ? (
            <Link href="/dashboard" asChild>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>Go to Dashboard</Text>
              </TouchableOpacity>
            </Link>
          ) : (
            <>
              <Link href="/auth/login" asChild>
                <TouchableOpacity style={styles.button}>
                  <Text style={styles.buttonText}>Login</Text>
                </TouchableOpacity>
              </Link>

              <Link href="/auth/register" asChild>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                >
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                    Register
                  </Text>
                </TouchableOpacity>
              </Link>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 48,
    textAlign: "center",
  },
  buttonContainer: {
    width: "100%",
    maxWidth: 300,
  },
  button: {
    backgroundColor: "#6366f1",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#6366f1",
  },
  secondaryButtonText: {
    color: "#6366f1",
  },
});
