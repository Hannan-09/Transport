import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { partiesAPI, transactionsAPI } from "../../lib/supabase";

export default function Reports() {
  const [parties, setParties] = useState([]);
  const [selectedParties, setSelectedParties] = useState(new Set());
  const [partyModalVisible, setPartyModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState("single");

  useEffect(() => {
    loadParties();
  }, []);

  const loadParties = async () => {
    try {
      const partiesData = await partiesAPI.getAll();
      setParties(partiesData);
    } catch (error) {
      console.error("Error loading parties:", error);
      Alert.alert("Error", "Failed to load parties");
    }
  };

  const togglePartySelection = (partyId) => {
    const newSelected = new Set(selectedParties);
    if (newSelected.has(partyId)) {
      newSelected.delete(partyId);
    } else {
      if (selectionMode === "single") {
        newSelected.clear();
      }
      newSelected.add(partyId);
    }
    setSelectedParties(newSelected);
  };

  const selectAllParties = () => {
    if (selectedParties.size === parties.length) {
      setSelectedParties(new Set());
    } else {
      setSelectedParties(new Set(parties.map((party) => party.id)));
    }
  };

  const generatePartyReport = (party, transactions) => {
    const totalJama = transactions
      .filter((t) => t.type === "Jama")
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

    const totalUdhar = transactions
      .filter((t) => t.type === "Udhar")
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

    const balance = totalJama - totalUdhar;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Party Report - ${party.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .party-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .summary { display: flex; justify-content: space-around; margin-bottom: 30px; }
            .summary-item { text-align: center; }
            .summary-value { font-size: 18px; font-weight: bold; }
            .jama { color: #059669; }
            .udhar { color: #dc2626; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .date { font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Transport Ledger Report</h1>
            <h2>${party.name}</h2>
            <p class="date">Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="party-info">
            <p><strong>Party Name:</strong> ${party.name}</p>
            ${
              party.phone_number
                ? `<p><strong>Phone:</strong> ${party.phone_number}</p>`
                : ""
            }
            ${
              party.address
                ? `<p><strong>Address:</strong> ${party.address}</p>`
                : ""
            }
          </div>

          <div class="summary">
            <div class="summary-item">
              <div class="summary-value jama">₹${totalJama.toFixed(2)}</div>
              <div>Total Jama</div>
            </div>
            <div class="summary-item">
              <div class="summary-value udhar">₹${totalUdhar.toFixed(2)}</div>
              <div>Total Udhar</div>
            </div>
            <div class="summary-item">
              <div class="summary-value ${
                balance >= 0 ? "jama" : "udhar"
              }">₹${Math.abs(balance).toFixed(2)}</div>
              <div>Net ${balance >= 0 ? "Jama" : "Udhar"}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Rounds</th>
              </tr>
            </thead>
            <tbody>
              ${transactions
                .map(
                  (transaction) => `
                <tr>
                  <td>${transaction.date}</td>
                  <td>${transaction.type}</td>
                  <td class="${transaction.type.toLowerCase()}">₹${Math.abs(
                    parseFloat(transaction.amount)
                  ).toFixed(2)}</td>
                  <td>${transaction.rounds}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    return {
      totalJama,
      totalUdhar,
      balance,
      transactions,
      party,
      htmlContent,
    };
  };

  const handleGeneratePDF = async () => {
    if (selectedParties.size === 0) {
      Alert.alert("No Selection", "Please select at least one party");
      return;
    }

    try {
      setLoading(true);

      const selectedPartiesArray = parties.filter((party) =>
        selectedParties.has(party.id)
      );

      for (const party of selectedPartiesArray) {
        // Get transactions for this party
        const transactions = await transactionsAPI.getByParty(party.id);

        // Generate report data with HTML content
        const reportData = generatePartyReport(party, transactions);

        // Generate PDF
        const { uri } = await Print.printToFileAsync({
          html: reportData.htmlContent,
          base64: false,
        });

        // Create filename and save to device storage
        // Use the generated PDF URI directly (no need to move)
        const fileUri = uri;

        // Share via WhatsApp with PDF attachment
        if (party.phone_number) {
          await shareToWhatsApp(party, reportData, fileUri);
        } else {
          // Just share the PDF file
          await Sharing.shareAsync(fileUri, {
            mimeType: "application/pdf",
            dialogTitle: `${party.name} Report`,
          });
        }
      }

      Alert.alert(
        "Success",
        `PDF${
          selectedParties.size > 1 ? "s" : ""
        } generated! Select WhatsApp to send with message.`
      );

      setPartyModalVisible(false);
      setSelectedParties(new Set());
    } catch (error) {
      console.error("Error generating PDF:", error);
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const shareToWhatsApp = async (party, reportData, fileUri) => {
    try {
      const phoneNumber = party.phone_number.replace(/[^0-9]/g, "");

      // Simplified message as requested
      const message = `Hi ${party.name}, here is your transport ledger report:

📊 *Transport Ledger Summary*
Party: ${party.name}
Date: ${new Date().toLocaleDateString()}

💰 *Financial Summary:*
Total Amount: ₹${reportData.totalUdhar.toFixed(2)}

📋 Total Transactions: ${reportData.transactions.length}

Thank you for your business!`;

      // Single action: Share PDF with message directly to WhatsApp contact
      // Share PDF with message as caption - single action
      // Copy message to clipboard for easy pasting as caption
      await Clipboard.setStringAsync(message);

      // Share PDF and show helpful message
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/pdf",
        dialogTitle: `Send to ${party.name}`,
        UTI: "com.adobe.pdf",
      });

      // Show helpful alert about clipboard
      // Alert.alert(
      //   "Message Copied!",
      //   "The message has been copied to your clipboard. After selecting WhatsApp, you can paste it as a caption for the PDF.",
      //   [{ text: "OK" }]
      // );

      // No need for separate WhatsApp message - everything is in the PDF share
    } catch (error) {
      console.error("Error sharing to WhatsApp:", error);
      Alert.alert("Error", "Failed to share to WhatsApp");
    }
  };

  const renderPartyItem = ({ item }) => {
    const isSelected = selectedParties.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.partyItem, isSelected && styles.selectedPartyItem]}
        onPress={() => togglePartySelection(item.id)}
      >
        <View style={styles.partyInfo}>
          <Text style={styles.partyName}>{item.name}</Text>
          {item.phone_number && (
            <Text style={styles.partyPhone}>{item.phone_number}</Text>
          )}
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
          {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
        </View>
      </TouchableOpacity>
    );
  };

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

        <TouchableOpacity
          style={styles.reportOption}
          onPress={() => setPartyModalVisible(true)}
        >
          <View style={styles.reportIconContainer}>
            <Ionicons name="people-outline" size={24} color="#059669" />
          </View>
          <View style={styles.reportInfo}>
            <Text style={styles.reportTitle}>Party-wise PDF</Text>
            <Text style={styles.reportDescription}>
              Generate PDF reports for specific parties.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6b7280" />
        </TouchableOpacity>

        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.closeMonth}>
            <Text style={styles.closeButtonText}>Close Month</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Party Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={partyModalVisible}
        onRequestClose={() => setPartyModalVisible(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Parties for PDF</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setPartyModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <View style={styles.selectionModeContainer}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  selectionMode === "single" && styles.selectedModeButton,
                ]}
                onPress={() => {
                  setSelectionMode("single");
                  setSelectedParties(new Set());
                }}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    selectionMode === "single" && styles.selectedModeButtonText,
                  ]}
                >
                  Single Party
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeButton,
                  selectionMode === "multiple" && styles.selectedModeButton,
                ]}
                onPress={() => {
                  setSelectionMode("multiple");
                  setSelectedParties(new Set());
                }}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    selectionMode === "multiple" &&
                      styles.selectedModeButtonText,
                  ]}
                >
                  Multiple Parties
                </Text>
              </TouchableOpacity>
            </View>

            {selectionMode === "multiple" && (
              <View style={styles.selectAllContainer}>
                <TouchableOpacity
                  style={styles.selectAllButton}
                  onPress={selectAllParties}
                >
                  <Text style={styles.selectAllText}>
                    {selectedParties.size === parties.length
                      ? "Deselect All"
                      : "Select All"}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.selectedCount}>
                  {selectedParties.size} selected
                </Text>
              </View>
            )}

            <ScrollView style={styles.partiesList}>
              <FlatList
                data={parties}
                renderItem={renderPartyItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No parties found</Text>
                  </View>
                }
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setPartyModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.generateButton,
                  (selectedParties.size === 0 || loading) &&
                    styles.disabledButton,
                ]}
                onPress={handleGeneratePDF}
                disabled={selectedParties.size === 0 || loading}
              >
                <Text style={styles.generateButtonText}>
                  {loading
                    ? "Generating..."
                    : `Generate PDF${selectedParties.size > 1 ? "s" : ""}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    padding: 4,
    borderRadius: 25,
    alignItems: "center",
  },
  closeMonth: {
    backgroundColor: "#dc2626",
    padding: 16,
    borderRadius: 25,
    alignItems: "center",
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 0,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  selectionModeContainer: {
    flexDirection: "row",
    padding: 20,
    paddingBottom: 10,
    gap: 12,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  selectedModeButton: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  selectedModeButtonText: {
    color: "white",
  },
  selectAllContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
  },
  selectAllText: {
    fontSize: 14,
    color: "#6366f1",
    fontWeight: "500",
  },
  selectedCount: {
    fontSize: 14,
    color: "#6b7280",
  },
  partiesList: {
    maxHeight: 300,
    paddingHorizontal: 20,
  },
  partyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  selectedPartyItem: {
    backgroundColor: "#f0f9ff",
    borderColor: "#6366f1",
  },
  partyInfo: {
    flex: 1,
  },
  partyName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  partyPhone: {
    fontSize: 14,
    color: "#6b7280",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
  },
  checkedBox: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
  },
  modalActions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6b7280",
  },
  generateButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#059669",
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#9ca3af",
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "white",
  },
});
