import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { expensesAPI, partiesAPI, transactionsAPI } from "../../lib/supabase";

// Expense types data
const expenseTypes = [
  { id: "1", name: "Vehicle Repair", icon: "car-outline" },
  { id: "2", name: "Fuel", icon: "car-sport-outline" },
  { id: "3", name: "Other Expenses", icon: "receipt-outline" },
];

export default function Dashboard() {
  // Dashboard data states
  const [dashboardData, setDashboardData] = useState({
    totalUdhar: 0,
    totalJama: 0,
    totalExpenses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Parties data
  const [parties, setParties] = useState([]);

  // Modal states
  const [partyModalVisible, setPartyModalVisible] = useState(false);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);

  // Expense modals
  const [expenseTypeModalVisible, setExpenseTypeModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [selectedExpenseType, setSelectedExpenseType] = useState(null);

  // Transaction form states - Multiple transactions support
  const [transactionEntries, setTransactionEntries] = useState([
    {
      id: Date.now(),
      amount: "",
      type: "Jama",
      rounds: "",
      date: new Date().toISOString().split("T")[0],
    },
  ]);

  // Expense form states
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseType, setExpenseType] = useState("Udhar"); // Default to Udhar for expenses
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [description, setDescription] = useState("");

  // Load dashboard data when component mounts
  useEffect(() => {
    loadDashboardData();
    loadParties();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get all transactions to calculate separate Jama and Udhar totals
      const allParties = await partiesAPI.getAll();
      let totalJama = 0;
      let totalUdhar = 0;

      for (const party of allParties) {
        const transactions = await transactionsAPI.getByParty(party.id);

        transactions.forEach((transaction) => {
          const transactionAmount = Math.abs(parseFloat(transaction.amount));
          if (transaction.type === "Jama") {
            totalJama += transactionAmount;
          } else if (transaction.type === "Udhar") {
            totalUdhar += transactionAmount;
          }
        });
      }

      // Get all expenses to calculate total expenses
      const allExpenses = await expensesAPI.getAll();
      const totalExpenses = allExpenses.reduce((sum, expense) => {
        return sum + Math.abs(parseFloat(expense.amount));
      }, 0);

      setDashboardData({
        totalJama,
        totalUdhar,
        totalExpenses,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      Alert.alert("Error", "Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadParties = async () => {
    try {
      const partiesData = await partiesAPI.getAll();
      setParties(partiesData);
    } catch (error) {
      console.error("Error loading parties:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    await loadParties();
    setRefreshing(false);
  };

  const handlePartySelect = (party) => {
    setSelectedParty(party);
    setPartyModalVisible(false);
    setTransactionModalVisible(true);
  };

  const handleAddTransactions = async () => {
    // Validate all entries
    for (let i = 0; i < transactionEntries.length; i++) {
      const entry = transactionEntries[i];
      if (!entry.amount.trim()) {
        Alert.alert("Error", `Please enter amount for transaction ${i + 1}`);
        return;
      }
      if (!entry.rounds.trim()) {
        Alert.alert(
          "Error",
          `Please enter number of rounds for transaction ${i + 1}`
        );
        return;
      }
    }

    if (!selectedParty) {
      Alert.alert("Error", "No party selected");
      return;
    }

    try {
      // Create all transactions
      const createPromises = transactionEntries.map((entry) => {
        const transactionAmount = parseFloat(entry.amount);
        const finalAmount =
          entry.type === "Jama" ? transactionAmount : -transactionAmount;

        const transactionData = {
          party_id: selectedParty.id,
          date: entry.date,
          amount: finalAmount,
          type: entry.type,
          rounds: parseInt(entry.rounds),
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
          rounds: "",
          date: new Date().toISOString().split("T")[0],
        },
      ]);
      setTransactionModalVisible(false);
      setSelectedParty(null);

      // Reload dashboard data
      await loadDashboardData();

      Alert.alert(
        "Success",
        `${transactionEntries.length} transaction(s) added for ${selectedParty.name}!`
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
        rounds: "",
        date: new Date().toISOString().split("T")[0],
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
      transactionEntries.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  const handleExpenseTypeSelect = (expenseType) => {
    setSelectedExpenseType(expenseType);
    setExpenseTypeModalVisible(false);
    setExpenseModalVisible(true);
  };

  const handleAddExpense = async () => {
    if (!expenseAmount.trim()) {
      Alert.alert("Error", "Please enter amount");
      return;
    }

    if (!selectedExpenseType) {
      Alert.alert("Error", "No expense type selected");
      return;
    }

    try {
      const expenseAmountValue = parseFloat(expenseAmount);
      const finalAmount =
        expenseType === "Jama"
          ? expenseAmountValue
          : -Math.abs(expenseAmountValue);

      const expenseData = {
        date: expenseDate,
        amount: finalAmount,
        category: selectedExpenseType.name,
        type: expenseType,
        payment_method: paymentMethod,
        description: description.trim() || null,
      };

      await expensesAPI.create(expenseData);

      // Reset form and close modal
      setExpenseAmount("");
      setExpenseType("Udhar");
      setExpenseDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("Cash");
      setDescription("");
      setExpenseModalVisible(false);
      setSelectedExpenseType(null);

      // Reload dashboard data
      await loadDashboardData();

      Alert.alert("Success", `${selectedExpenseType.name} expense added!`);
    } catch (error) {
      console.error("Error adding expense:", error);
      Alert.alert("Error", "Failed to add expense. Please try again.");
    }
  };

  const renderPartyItem = ({ item }) => (
    <TouchableOpacity
      style={styles.partySelectItem}
      onPress={() => handlePartySelect(item)}
    >
      <Text style={styles.partySelectName}>{item.name}</Text>
      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
    </TouchableOpacity>
  );

  const renderExpenseTypeItem = ({ item }) => (
    <TouchableOpacity
      style={styles.expenseTypeItem}
      onPress={() => handleExpenseTypeSelect(item)}
    >
      <View style={styles.expenseTypeLeft}>
        <Ionicons name={item.icon} size={24} color="#6366f1" />
        <Text style={styles.expenseTypeName}>{item.name}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header]}>
        <Text style={styles.headerTitle}>Transport Ledger</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.summaryCard, styles.udharCard]}>
          <Text style={styles.cardTitle}>Total Udhar</Text>
          <Text style={[styles.cardAmount, styles.udharAmount]}>
            {loading ? "Loading..." : `₹${dashboardData.totalUdhar.toFixed(2)}`}
          </Text>
        </View>

        <View style={[styles.summaryCard, styles.expenseCard]}>
          <Text style={styles.cardTitle}>Total Expense</Text>
          <Text style={styles.cardAmount}>
            {loading
              ? "Loading..."
              : `₹${dashboardData.totalExpenses.toFixed(2)}`}
          </Text>
        </View>

        <View style={[styles.summaryCard, styles.jamaCard]}>
          <Text style={styles.cardTitle}>Total Jama</Text>
          <Text style={[styles.cardAmount, styles.jamaAmount]}>
            {loading ? "Loading..." : `₹${dashboardData.totalJama.toFixed(2)}`}
          </Text>
        </View>

        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setPartyModalVisible(true)}
          >
            <Text style={styles.primaryButtonText}>Add Round</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setExpenseTypeModalVisible(true)}
          >
            <Text style={styles.secondaryButtonText}>Add Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tertiaryButton}>
            <Text style={styles.tertiaryButtonText}>Generate PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Refresh Control */}
      <View style={styles.refreshContainer}>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Ionicons
            name="refresh"
            size={20}
            color={refreshing ? "#9ca3af" : "#6366f1"}
          />
          <Text
            style={[styles.refreshText, refreshing && styles.refreshingText]}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Text>
        </TouchableOpacity>
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
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPartyModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Party</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setPartyModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={parties}
              renderItem={renderPartyItem}
              keyExtractor={(item) => item.id}
              style={styles.partyList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No parties found</Text>
                  <Text style={styles.emptySubtext}>
                    Add parties first to create transactions
                  </Text>
                </View>
              }
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Add Multiple Transactions Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={transactionModalVisible}
        onRequestClose={() => setTransactionModalVisible(false)}
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
            onPress={() => setTransactionModalVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalContent}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Add Transactions ({transactionEntries.length}) -{" "}
                  {selectedParty?.name}
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
                    onPress={() => setTransactionModalVisible(false)}
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
                        <Text style={styles.inputLabel}>Amount *</Text>
                        <TextInput
                          style={styles.textInput}
                          value={entry.amount}
                          onChangeText={(value) =>
                            updateTransactionEntry(entry.id, "amount", value)
                          }
                          placeholder="Enter amount (without ₹ sign)"
                          placeholderTextColor="#9ca3af"
                          keyboardType="numeric"
                        />
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
                        <TextInput
                          style={styles.textInput}
                          value={entry.rounds}
                          onChangeText={(value) =>
                            updateTransactionEntry(entry.id, "rounds", value)
                          }
                          placeholder="Enter number of rounds"
                          placeholderTextColor="#9ca3af"
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  ))}

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setTransactionModalVisible(false)}
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

      {/* Expense Type Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={expenseTypeModalVisible}
        onRequestClose={() => setExpenseTypeModalVisible(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setExpenseTypeModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Expense Type</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setExpenseTypeModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={expenseTypes}
              renderItem={renderExpenseTypeItem}
              keyExtractor={(item) => item.id}
              style={styles.expenseTypeList}
              showsVerticalScrollIndicator={false}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Expense Form Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={expenseModalVisible}
        onRequestClose={() => setExpenseModalVisible(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setExpenseModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Add Expense - {selectedExpenseType?.name}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setExpenseModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date</Text>
                <TextInput
                  style={styles.textInput}
                  value={expenseDate}
                  onChangeText={setExpenseDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount *</Text>
                <TextInput
                  style={styles.textInput}
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  placeholder="Enter amount (without ₹ sign)"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Type *</Text>
                <View style={styles.typeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      expenseType === "Jama" && styles.selectedTypeButton,
                    ]}
                    onPress={() => setExpenseType("Jama")}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        expenseType === "Jama" && styles.selectedTypeButtonText,
                      ]}
                    >
                      Jama (+)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      expenseType === "Udhar" && styles.selectedTypeButton,
                    ]}
                    onPress={() => setExpenseType("Udhar")}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        expenseType === "Udhar" &&
                          styles.selectedTypeButtonText,
                      ]}
                    >
                      Udhar (-)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Payment Method</Text>
                <View style={styles.paymentContainer}>
                  {["Cash", "Online"].map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.paymentButton,
                        paymentMethod === method &&
                          styles.selectedPaymentButton,
                      ]}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Text
                        style={[
                          styles.paymentButtonText,
                          paymentMethod === method &&
                            styles.selectedPaymentButtonText,
                        ]}
                      >
                        {method}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Enter description"
                  placeholderTextColor="#9ca3af"
                  multiline={true}
                  numberOfLines={3}
                />
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setExpenseModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleAddExpense}
                >
                  <Text style={styles.saveButtonText}>Add Expense</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  summaryCard: {
    backgroundColor: "#f3f4f6",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  expenseCard: {
    backgroundColor: "#ecfdf5",
  },
  udharCard: {
    backgroundColor: "#fef2f2",
  },
  jamaCard: {
    backgroundColor: "#f0fdf4",
  },
  udharAmount: {
    color: "#dc2626",
  },
  jamaAmount: {
    color: "#059669",
  },
  cardTitle: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 8,
  },
  cardAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  balanceSection: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 32,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: 16,
    color: "#374151",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: "600",
  },
  positiveBalance: {
    color: "#059669",
  },
  negativeBalance: {
    color: "#dc2626",
  },
  buttonSection: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#6366f1",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#059669",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  tertiaryButton: {
    backgroundColor: "#f3f4f6",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
  },
  tertiaryButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
  },
  refreshContainer: {
    position: "absolute",
    top: 93,
    // right: 20,
    left: 0,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  refreshText: {
    marginLeft: 6,
    fontSize: 14,
    color: "#6366f1",
    fontWeight: "500",
  },
  refreshingText: {
    color: "#9ca3af",
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
  closeButton: {
    padding: 4,
  },
  partyList: {
    maxHeight: 300,
  },
  partySelectItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  partySelectName: {
    fontSize: 16,
    color: "#111827",
    flex: 1,
  },
  expenseTypeList: {
    maxHeight: 300,
  },
  expenseTypeItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  expenseTypeLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  expenseTypeName: {
    fontSize: 16,
    color: "#111827",
    marginLeft: 12,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
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
  paymentContainer: {
    flexDirection: "row",
    gap: 8,
  },
  paymentButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  selectedPaymentButton: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  paymentButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  selectedPaymentButtonText: {
    color: "white",
  },
  // New styles for multi-transaction modal
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
  // }
  //   alignItems: "center",
  //   backgroundColor: "#f9fafb",
  // },
  selectedPaymentButton: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  paymentButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6b7280",
  },
  selectedPaymentButtonText: {
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
