import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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
import { partiesAPI, transactionsAPI } from "../../lib/supabase";

export default function PartyLedger() {
  const { party } = useLocalSearchParams();
  const partyName = decodeURIComponent(party || "");

  const [transactions, setTransactions] = useState([]);
  const [partyData, setPartyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningBalance, setRunningBalance] = useState(0);
  const [totalJama, setTotalJama] = useState(0);
  const [totalUdhar, setTotalUdhar] = useState(0);

  // Selection states
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState(new Set());

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [transactionEntries, setTransactionEntries] = useState([
    {
      id: Date.now(),
      amount: "",
      type: "Jama",
      rounds: "1",
      date: new Date().toISOString().split("T")[0],
      description: "",
      baseAmount: "", // Store base amount for calculation
    },
  ]);

  // Helper function to get day name from date
  const getDayName = (dateString) => {
    const date = new Date(dateString);
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return days[date.getDay()];
  };

  // Load transactions when component mounts
  useEffect(() => {
    loadPartyData();
  }, [partyName]);

  const loadPartyData = async () => {
    try {
      setLoading(true);

      // First, find the party by name
      const allParties = await partiesAPI.getAll();
      const currentParty = allParties.find((p) => p.name === partyName);

      if (!currentParty) {
        Alert.alert("Error", "Party not found");
        router.back();
        return;
      }

      setPartyData(currentParty);

      // Load transactions for this party
      const transactionData = await transactionsAPI.getByParty(currentParty.id);

      // Debug: Check if description field is being fetched
      console.log("Transaction data sample:", transactionData[0]);

      // Calculate separate totals for Jama and Udhar
      let balance = 0;
      let jamaTotal = 0;
      let udharTotal = 0;

      const formattedTransactions = transactionData.map((transaction) => {
        const transactionAmount = parseFloat(transaction.amount);
        balance += transactionAmount;

        // Calculate separate totals
        if (transaction.type === "Jama") {
          jamaTotal += Math.abs(transactionAmount);
        } else {
          udharTotal += Math.abs(transactionAmount);
        }

        return {
          id: transaction.id,
          date: transaction.date,
          amount:
            transaction.type === "Jama"
              ? `+₹${Math.abs(transactionAmount).toFixed(2)}`
              : `-₹${Math.abs(transactionAmount).toFixed(2)}`,
          type: transaction.type,
          rounds: transaction.rounds,
          description: transaction.description || "",
          runningBalance: `₹${balance.toFixed(2)}`,
          rawAmount: transactionAmount,
        };
      });

      setTransactions(formattedTransactions);
      setRunningBalance(balance);
      setTotalJama(jamaTotal);
      setTotalUdhar(udharTotal);
    } catch (error) {
      console.error("Error loading party data:", error);
      Alert.alert("Error", "Failed to load party data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPartyData();
    setRefreshing(false);
  };

  const handleAddTransactions = async () => {
    // Validate all entries
    for (let i = 0; i < transactionEntries.length; i++) {
      const entry = transactionEntries[i];
      if (!entry.baseAmount.trim()) {
        Alert.alert(
          "Error",
          `Please enter base amount for transaction ${i + 1}`
        );
        return;
      }
      if (!entry.rounds.trim() || parseInt(entry.rounds) < 1) {
        Alert.alert(
          "Error",
          `Please enter valid number of rounds for transaction ${i + 1}`
        );
        return;
      }
    }

    if (!partyData) {
      Alert.alert("Error", "Party data not loaded");
      return;
    }

    try {
      // Create all transactions
      const createPromises = transactionEntries.map((entry) => {
        const transactionAmount = parseFloat(entry.amount);
        const finalAmount =
          entry.type === "Jama" ? transactionAmount : -transactionAmount;

        const transactionData = {
          party_id: partyData.id,
          date: entry.date,
          amount: finalAmount,
          type: entry.type,
          rounds: parseInt(entry.rounds),
          description: entry.description || "",
          running_balance: 0, // Will be calculated properly in sequence
        };

        return transactionsAPI.create(transactionData);
      });

      await Promise.all(createPromises);

      // Reset form
      setTransactionEntries([
        {
          id: Date.now(),
          amount: "",
          type: "Jama",
          rounds: "1",
          date: new Date().toISOString().split("T")[0],
          description: "",
          baseAmount: "",
        },
      ]);
      setModalVisible(false);

      // Reload transactions
      await loadPartyData();

      Alert.alert(
        "Success",
        `${transactionEntries.length} transaction(s) added successfully!`
      );
    } catch (error) {
      console.error("Error adding transactions:", error);
      Alert.alert("Error", "Failed to add transactions. Please try again.");
    }
  };

  const addNewTransactionEntry = () => {
    setTransactionEntries([
      ...transactionEntries,
      {
        id: Date.now() + Math.random(),
        amount: "",
        type: "Jama",
        rounds: "1",
        date: new Date().toISOString().split("T")[0],
        description: "",
        baseAmount: "",
      },
    ]);
  };

  const removeTransactionEntry = (id) => {
    if (transactionEntries.length > 1) {
      setTransactionEntries(
        transactionEntries.filter((entry) => entry.id !== id)
      );
    }
  };

  const updateTransactionEntry = (id, field, value) => {
    setTransactionEntries(
      transactionEntries.map((entry) => {
        if (entry.id === id) {
          const updatedEntry = { ...entry, [field]: value };

          // If updating baseAmount, calculate total amount
          if (field === "baseAmount") {
            const rounds = parseInt(updatedEntry.rounds) || 1;
            const baseAmount = parseFloat(value) || 0;
            updatedEntry.amount = (baseAmount * rounds).toString();
          }

          // If updating rounds, recalculate amount based on baseAmount
          if (field === "rounds") {
            const rounds = parseInt(value) || 1;
            const baseAmount = parseFloat(updatedEntry.baseAmount) || 0;
            if (baseAmount > 0) {
              updatedEntry.amount = (baseAmount * rounds).toString();
            }
          }

          return updatedEntry;
        }
        return entry;
      })
    );
  };

  const incrementRounds = (id) => {
    const entry = transactionEntries.find((e) => e.id === id);
    const currentRounds = parseInt(entry.rounds) || 1;
    updateTransactionEntry(id, "rounds", (currentRounds + 1).toString());
  };

  const decrementRounds = (id) => {
    const entry = transactionEntries.find((e) => e.id === id);
    const currentRounds = parseInt(entry.rounds) || 1;
    if (currentRounds > 1) {
      updateTransactionEntry(id, "rounds", (currentRounds - 1).toString());
    }
  };

  // Selection functions
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedTransactions(new Set());
  };

  const toggleTransactionSelection = (transactionId) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const selectAllTransactions = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(
        new Set(transactions.map((transaction) => transaction.id))
      );
    }
  };

  const handleDeleteSingle = async (transactionId) => {
    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to delete this transaction?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await transactionsAPI.delete(transactionId);
              await loadPartyData();
              Alert.alert("Success", "Transaction deleted successfully!");
            } catch (error) {
              console.error("Error deleting transaction:", error);
              Alert.alert(
                "Error",
                "Failed to delete transaction. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedTransactions.size === 0) {
      Alert.alert("No Selection", "Please select transactions to delete.");
      return;
    }

    Alert.alert(
      "Delete Transactions",
      `Are you sure you want to delete ${selectedTransactions.size} transaction(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete all selected transactions
              const deletePromises = Array.from(selectedTransactions).map(
                (id) => transactionsAPI.delete(id)
              );

              await Promise.all(deletePromises);

              // Reset selection and reload
              setSelectedTransactions(new Set());
              setSelectionMode(false);
              await loadPartyData();

              Alert.alert(
                "Success",
                `${selectedTransactions.size} transaction(s) deleted successfully!`
              );
            } catch (error) {
              console.error("Error deleting transactions:", error);
              Alert.alert(
                "Error",
                "Failed to delete some transactions. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const renderLedgerItem = ({ item }) => {
    const isSelected = selectedTransactions.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.ledgerItem,
          selectionMode && styles.selectableItem,
          isSelected && styles.selectedItem,
        ]}
        onPress={() => {
          if (selectionMode) {
            toggleTransactionSelection(item.id);
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

        <View style={styles.ledgerContent}>
          <View style={styles.ledgerTop}>
            <View style={styles.ledgerLeft}>
              <Text style={styles.ledgerDate}>{item.date}</Text>
              <Text style={styles.ledgerDay}>{getDayName(item.date)}</Text>
              <Text style={styles.ledgerRounds}>Rounds: {item.rounds}</Text>
            </View>
            <View style={styles.ledgerRight}>
              <Text
                style={[
                  styles.ledgerAmount,
                  item.type === "Jama" ? styles.jamaAmount : styles.udharAmount,
                ]}
              >
                {item.amount}
              </Text>
            </View>
          </View>

          {/* Description section at the bottom of every card */}
          <View style={styles.descriptionSection}>
            <Text style={styles.descriptionLabel}>Description:</Text>
            <Text style={styles.ledgerDescription}>
              {item.description || "No description provided"}
            </Text>
          </View>
        </View>

        {!selectionMode && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteSingle(item.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#dc2626" />
          </TouchableOpacity>
        )}
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
              {selectedTransactions.size} selected
            </Text>

            <View style={styles.selectionActions}>
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={selectAllTransactions}
              >
                <Text style={styles.selectAllText}>
                  {selectedTransactions.size === transactions.length
                    ? "Deselect All"
                    : "Select All"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.normalHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{partyName}</Text>
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

      <View style={styles.balanceHeader}>
        <Text style={styles.partyName}>{partyName}</Text>

        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Total Udhar</Text>
            <Text style={[styles.balanceAmount, styles.udharBalance]}>
              ₹{totalUdhar.toFixed(2)}
            </Text>
          </View>

          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Total Jama</Text>
            <Text style={[styles.balanceAmount, styles.jamaBalance]}>
              ₹{totalJama.toFixed(2)}
            </Text>
          </View>

          {/* <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Final Balance</Text>
            <Text
              style={[
                styles.balanceAmount,
                styles.finalBalance,
                runningBalance >= 0
                  ? styles.positiveBalance
                  : styles.negativeBalance,
              ]}
            >
              ₹{Math.abs(runningBalance).toFixed(2)}
            </Text>
            <Text
              style={[
                styles.balanceType,
                runningBalance >= 0
                  ? styles.positiveBalance
                  : styles.negativeBalance,
              ]}
            >
              {runningBalance >= 0 ? "Jama" : "Udhar"}
            </Text>
          </View> */}
        </View>
      </View>

      <FlatList
        data={transactions}
        renderItem={renderLedgerItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>
              {loading ? "Loading transactions..." : "No transactions found"}
            </Text>
            <Text style={styles.emptySubtext}>
              Tap the + button to add your first transaction
            </Text>
          </View>
        }
      />

      {selectionMode && selectedTransactions.size > 0 && (
        <TouchableOpacity
          style={styles.deleteSelectedButton}
          onPress={handleDeleteSelected}
        >
          <Ionicons name="trash" size={24} color="white" />
          <Text style={styles.deleteSelectedText}>
            Delete ({selectedTransactions.size})
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

      {/* Add Multiple Transactions Modal */}
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
          behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                <Text style={styles.modalTitle}>
                  Add Transactions ({transactionEntries.length})
                </Text>
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={styles.addEntryButton}
                    onPress={addNewTransactionEntry}
                  >
                    <Ionicons name="add" size={20} color="#6366f1" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setModalVisible(false)}
                  >
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                style={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.formContainer}>
                  {transactionEntries.map((entry, index) => (
                    <View key={entry.id} style={styles.transactionEntry}>
                      <View style={styles.entryHeader}>
                        <Text style={styles.entryTitle}>
                          Transaction {index + 1}
                        </Text>
                        {transactionEntries.length > 1 && (
                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeTransactionEntry(entry.id)}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color="#dc2626"
                            />
                          </TouchableOpacity>
                        )}
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Date</Text>
                        <TextInput
                          style={styles.textInput}
                          value={entry.date}
                          onChangeText={(value) =>
                            updateTransactionEntry(entry.id, "date", value)
                          }
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor="#9ca3af"
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>
                          Base Amount per Round *
                        </Text>
                        <TextInput
                          style={styles.textInput}
                          value={entry.baseAmount}
                          onChangeText={(value) =>
                            updateTransactionEntry(
                              entry.id,
                              "baseAmount",
                              value
                            )
                          }
                          placeholder="Enter amount per round (without ₹ sign)"
                          placeholderTextColor="#9ca3af"
                          keyboardType="numeric"
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Total Amount</Text>
                        <View style={styles.totalAmountContainer}>
                          <Text style={styles.totalAmountText}>
                            ₹{entry.amount || "0"}
                          </Text>
                          <Text style={styles.calculationText}>
                            ({entry.baseAmount || "0"} × {entry.rounds} rounds)
                          </Text>
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Type *</Text>
                        <View style={styles.typeContainer}>
                          <TouchableOpacity
                            style={[
                              styles.typeButton,
                              entry.type === "Jama" &&
                                styles.selectedTypeButton,
                            ]}
                            onPress={() =>
                              updateTransactionEntry(entry.id, "type", "Jama")
                            }
                          >
                            <Text
                              style={[
                                styles.typeButtonText,
                                entry.type === "Jama" &&
                                  styles.selectedTypeButtonText,
                              ]}
                            >
                              Jama (+)
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.typeButton,
                              entry.type === "Udhar" &&
                                styles.selectedTypeButton,
                            ]}
                            onPress={() =>
                              updateTransactionEntry(entry.id, "type", "Udhar")
                            }
                          >
                            <Text
                              style={[
                                styles.typeButtonText,
                                entry.type === "Udhar" &&
                                  styles.selectedTypeButtonText,
                              ]}
                            >
                              Udhar (-)
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Rounds *</Text>
                        <View style={styles.roundsContainer}>
                          <TouchableOpacity
                            style={styles.roundsButton}
                            onPress={() => decrementRounds(entry.id)}
                          >
                            <Ionicons name="remove" size={20} color="#6366f1" />
                          </TouchableOpacity>
                          <TextInput
                            style={styles.roundsInput}
                            value={entry.rounds}
                            onChangeText={(value) =>
                              updateTransactionEntry(entry.id, "rounds", value)
                            }
                            placeholder="1"
                            placeholderTextColor="#9ca3af"
                            keyboardType="numeric"
                            textAlign="center"
                          />
                          <TouchableOpacity
                            style={styles.roundsButton}
                            onPress={() => incrementRounds(entry.id)}
                          >
                            <Ionicons name="add" size={20} color="#6366f1" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Description</Text>
                        <TextInput
                          style={[styles.textInput, styles.descriptionInput]}
                          value={entry.description}
                          onChangeText={(value) =>
                            updateTransactionEntry(
                              entry.id,
                              "description",
                              value
                            )
                          }
                          placeholder="Enter description (optional)"
                          placeholderTextColor="#9ca3af"
                          multiline={true}
                          numberOfLines={2}
                        />
                      </View>
                    </View>
                  ))}

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleAddTransactions}
                    >
                      <Text style={styles.saveButtonText}>
                        Add {transactionEntries.length} Transaction
                        {transactionEntries.length > 1 ? "s" : ""}
                      </Text>
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
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
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
  balanceHeader: {
    backgroundColor: "white",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  partyName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  balanceItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  balanceLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
    textAlign: "center",
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  balanceType: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  udharBalance: {
    color: "#dc2626",
  },
  jamaBalance: {
    color: "#059669",
  },
  finalBalance: {
    fontSize: 18,
  },
  totalBalance: {
    fontSize: 18,
    fontWeight: "600",
  },
  positiveBalance: {
    color: "#059669",
  },
  negativeBalance: {
    color: "#dc2626",
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  ledgerItem: {
    backgroundColor: "white",
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
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
  ledgerContent: {
    flex: 1,
    flexDirection: "column",
  },
  ledgerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  ledgerLeft: {
    flex: 1,
  },
  ledgerDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  ledgerDay: {
    fontSize: 14,
    color: "#6366f1",
    marginBottom: 4,
    fontWeight: "500",
  },
  ledgerRounds: {
    fontSize: 14,
    color: "#6b7280",
  },
  ledgerRight: {
    alignItems: "flex-end",
    marginRight: 40,
    marginTop: 10,
    flex: 1,
  },
  descriptionSection: {
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#e2e8f0",
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 2,
  },
  ledgerDescription: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  ledgerAmount: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
    paddingTop: 25,
  },
  jamaAmount: {
    color: "#059669",
  },
  udharAmount: {
    color: "#dc2626",
  },
  runningBalance: {
    fontSize: 14,
    color: "#6b7280",
  },
  deleteButton: {
    position: "absolute",
    top: 10,
    right: 10,
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addEntryButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#f0f9ff",
  },
  closeButton: {
    padding: 4,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    maxHeight: 400,
  },
  transactionEntry: {
    backgroundColor: "#f8fafc",
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  removeButton: {
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
  descriptionInput: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  roundsContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  roundsButton: {
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    borderRadius: 6,
    margin: 2,
  },
  roundsInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "transparent",
  },
  totalAmountContainer: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  totalAmountText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#059669",
    marginBottom: 4,
  },
  calculationText: {
    fontSize: 14,
    color: "#6b7280",
    fontStyle: "italic",
  },
  typeContainer: {
    flexDirection: "row",
    gap: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  selectedTypeButton: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  selectedTypeButtonText: {
    color: "white",
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
