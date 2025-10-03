import { Ionicons } from "@expo/vector-icons";
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Reports() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.reportOption}>
          <View style={styles.reportIconContainer}>
            <Ionicons name="document-text-outline" size={24} color="#6366f1" />
          </View>
          <View style={styles.reportInfo}>
            <Text style={styles.reportTitle}>Monthly Report</Text>
            <Text style={styles.reportDescription}>
              Generate a summary of monthly transactions.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.reportOption}>
          <View style={styles.reportIconContainer}>
            <Ionicons name="people-outline" size={24} color="#059669" />
          </View>
          <View style={styles.reportInfo}>
            <Text style={styles.reportTitle}>Party-wise PDF</Text>
            <Text style={styles.reportDescription}>
              Generate PDF reports for specific parties.
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close Month</Text>
          </TouchableOpacity>
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    color: "#111827",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  reportOption: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  reportDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  bottomSection: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 20,
  },
  closeButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
