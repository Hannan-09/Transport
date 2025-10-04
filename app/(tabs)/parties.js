import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as supabaseAPI from "../../lib/supabase";
const { partiesAPI, transactionsAPI } = supabaseAPI;

export default function Parties() {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selection states
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedParties, setSelectedParties] = useState(new Set());

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [partyName, setPartyName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");

  // Load parties when component mounts
  useEffect(() => {
    loadParties();
  }, []);

  const loadParties = async () => {
    try {
      setLoading(true);

      const data = await partiesAPI.getAll();

      // First load parties with default values
      const formattedParties = [];

      for (const party of data) {
        try {
          // Get all transactions for this party
          const transactions = await transactionsAPI.getByParty(party.id);

          // Calculate separate totals for Jama and Udhar
          let totalAmount = 0;
          let jamaTotal = 0;
          let udharTotal = 0;

          transactions.forEach((transaction) => {
            const transactionAmount = parseFloat(transaction.amount || 0);
            totalAmount += transactionAmount;

            // Calculate separate totals
            if (transaction.type === "Jama") {
              jamaTotal += Math.abs(transactionAmount);
            } else {
              udharTotal += Math.abs(transactionAmount);
            }
          });

          // Find the most recent transaction for last trip date
          const sortedTransactions = transactions.sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );
          const lastTrip =
            sortedTransactions.length > 0
              ? sortedTransactions[0].date
              : new Date().toISOString().split("T")[0];

          formattedParties.push({
            id: party.id,
            name: party.name,
            phone_number: party.phone_number,
            address: party.address,
            totalJama: jamaTotal,
            totalUdhar: udharTotal,
            netAmount: totalAmount,
            lastTrip: lastTrip,
            rawAmount: totalAmount,
            transactionCount: transactions.length,
          });
        } catch (error) {
          console.error(
            `Error loading transactions for party ${party.name}:`,
            error.message || error
          );
          // Add party with default values if transaction loading fails
          formattedParties.push({
            id: party.id,
            name: party.name,
            phone_number: party.phone_number,
            address: party.address,
            totalJama: 0,
            totalUdhar: 0,
            netAmount: 0,
            lastTrip: new Date().toISOString().split("T")[0],
            rawAmount: 0,
            transactionCount: 0,
          });
        }
      }

      setParties(formattedParties);
    } catch (error) {
      console.error("Error loading parties:", error);
      Alert.alert("Error", "Failed to load parties. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadParties();
    setRefreshing(false);
  };

  const handleAddParty = async () => {
    if (!partyName.trim()) {
      Alert.alert("Error", "Please enter party name");
      return;
    }

    try {
      const partyData = {
        name: partyName.trim(),
        phone_number: phoneNumber.trim() || null,
        address: address.trim() || null,
      };

      await partiesAPI.create(partyData);

      // Reset form
      setPartyName("");
      setPhoneNumber("");
      setAddress("");
      setModalVisible(false);

      // Reload parties
      await loadParties();

      Alert.alert("Success", "Party added successfully!");
    } catch (error) {
      console.error("Error adding party:", error);
      Alert.alert("Error", "Failed to add party. Please try again.");
    }
  };

  // Selection functions
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedParties(new Set());
  };

  const togglePartySelection = (partyId) => {
    const newSelected = new Set(selectedParties);
    if (newSelected.has(partyId)) {
      newSelected.delete(partyId);
    } else {
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

  const handleDeleteSingle = async (partyId) => {
    Alert.alert(
      "Delete Party",
      "Are you sure you want to delete this party? This will also delete all associated transactions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await partiesAPI.delete(partyId);
              await loadParties();
              Alert.alert("Success", "Party deleted successfully!");
            } catch (error) {
              console.error("Error deleting party:", error);
              Alert.alert("Error", "Failed to delete party. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedParties.size === 0) {
      Alert.alert("No Selection", "Please select parties to delete.");
      return;
    }

    Alert.alert(
      "Delete Parties",
      `Are you sure you want to delete ${selectedParties.size} party(ies)? This will also delete all associated transactions.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete all selected parties
              const deletePromises = Array.from(selectedParties).map((id) =>
                partiesAPI.delete(id)
              );

              await Promise.all(deletePromises);

              // Reset selection and reload
              setSelectedParties(new Set());
              setSelectionMode(false);
              await loadParties();

              Alert.alert(
                "Success",
                `${selectedParties.size} party(ies) deleted successfully!`
              );
            } catch (error) {
              console.error("Error deleting parties:", error);
              Alert.alert(
                "Error",
                "Failed to delete some parties. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const renderPartyItem = ({ item }) => {
    const isSelected = selectedParties.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.partyItem,
          selectionMode && styles.selectableItem,
          isSelected && styles.selectedItem,
        ]}
        onPress={() => {
          if (selectionMode) {
            togglePartySelection(item.id);
          } else {
            router.push(`/ledger/${encodeURIComponent(item.name)}`);
          }
        }}
        onLongPress={() => {
          if (!selectionMode) {
            handleDeleteSingle(item.id);
          }
        }}
      >
        {selectionMode && (
          <View style={styles.checkboxContainer}>
            <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
              {isSelected && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
            </View>
          </View>
        )}

        <View style={styles.partyContent}>
          {/* Top Row: Party Info (Left) + Delete Button (Right) */}
          <View style={styles.topRow}>
            <View style={styles.partyInfo}>
              <Text style={styles.partyName}>{item.name}</Text>
              <Text style={styles.lastTrip}>Last Trip: {item.lastTrip}</Text>
              {item.phone_number && (
                <Text style={styles.phoneNumber}>
                  Phone: {item.phone_number}
                </Text>
              )}
              <Text style={styles.transactionCount}>
                {item.transactionCount || 0} transaction(s)
              </Text>
            </View>

            {!selectionMode && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteSingle(item.id)}
              >
                <Ionicons name="trash-outline" size={20} color="#dc2626" />
              </TouchableOpacity>
            )}
          </View>

          {/* Bottom Row: Amounts (50% width each) */}
          <View style={styles.amountRow}>
            <View style={styles.amountItem}>
              <Text style={styles.amountLabel}>Total Udhar</Text>
              <Text style={[styles.amount, styles.udharAmount]}>
                ₹{item.totalUdhar.toFixed(2)}
              </Text>
            </View>
            <View style={styles.amountItem}>
              <Text style={styles.amountLabel}>Total Jama</Text>
              <Text style={[styles.amount, styles.jamaAmount]}>
                ₹{item.totalJama.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        {selectionMode ? (
          <View style={styles.selectionHeader}>
            <TouchableOpacity
              style={styles.cancelSelectionButton}
              onPress={toggleSelectionMode}
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>

            <Text style={styles.selectionTitle}>
              {selectedParties.size} selected
            </Text>

            <View style={styles.selectionActions}>
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
            </View>
          </View>
        ) : (
          <View style={styles.normalHeader}>
            <Text style={styles.headerTitle}>Parties</Text>
            <TouchableOpacity
              style={styles.selectModeButton}
              onPress={toggleSelectionMode}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={24}
                color="#6366f1"
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={parties}
        renderItem={renderPartyItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>
              {loading
                ? "Loading parties and calculating balances..."
                : "No parties found"}
            </Text>
            <Text style={styles.emptySubtext}>
              Tap the + button to add your first party
            </Text>
          </View>
        }
      />

      {selectionMode && selectedParties.size > 0 && (
        <TouchableOpacity
          style={styles.deleteSelectedButton}
          onPress={handleDeleteSelected}
        >
          <Ionicons name="trash" size={24} color="white" />
          <Text style={styles.deleteSelectedText}>
            Delete ({selectedParties.size})
          </Text>
        </TouchableOpacity>
      )}

      {!selectionMode && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Add Party Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "position" : "padding"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalContent}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Party</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.formContainer}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Party Name *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={partyName}
                      onChangeText={setPartyName}
                      placeholder="Enter party name"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <TextInput
                      style={styles.textInput}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      placeholder="Enter phone number"
                      placeholderTextColor="#9ca3af"
                      keyboardType="phone-pad"
                    />
                  </View>

                  {/* <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Address</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={address}
                      onChangeText={setAddress}
                      placeholder="Enter address"
                      placeholderTextColor="#9ca3af"
                      multiline={true}
                      numberOfLines={3}
                    />
                  </View> */}

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleAddParty}
                    >
                      <Text style={styles.saveButtonText}>Add Party</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
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
  normalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    paddingLeft: 30,
    textAlign: "center",
  },
  selectModeButton: {
    padding: 4,
  },
  selectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cancelSelectionButton: {
    padding: 4,
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
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
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  partyItem: {
    backgroundColor: "white",
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectableItem: {
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  selectedItem: {
    borderColor: "#6366f1",
    backgroundColor: "#f0f9ff",
  },
  checkboxContainer: {
    marginRight: 12,
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
  partyContent: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  partyInfo: {
    flex: 1,
  },
  partyName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  lastTrip: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 2,
  },
  phoneNumber: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 2,
  },
  transactionCount: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  amountRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 12,
    marginTop: 8,
  },
  amountItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  amountLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
    fontWeight: "500",
    textAlign: "center",
  },
  amount: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  jamaAmount: {
    color: "#059669",
  },
  udharAmount: {
    color: "#dc2626",
  },
  balanceStatus: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
    fontStyle: "italic",
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  addButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  deleteSelectedButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dc2626",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  deleteSelectedText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  keyboardAvoidingView: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  scrollContainer: {
    maxHeight: 400,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    minHeight: "75%",
  },
  modalContent: {
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: "100%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 0,
    maxHeight: "80%",
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
  },
  closeButton: {
    padding: 4,
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    gap: 12,
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
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#6366f1",
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "white",
  },
});
