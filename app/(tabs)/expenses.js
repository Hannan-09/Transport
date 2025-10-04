import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Alert,
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
import { expensesAPI } from "../../lib/supabase";
// ``;

const expenseCategories = ["Vehicle Repair", "Fuel", "Other Expenses"];

export default function Expenses() {
  const [selectedCategory, setSelectedCategory] = useState("Fuel");
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selection states
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedExpenses, setSelectedExpenses] = useState(new Set());

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("Udhar"); // Default to Udhar for expenses
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Load expenses when component mounts or category changes
  useEffect(() => {
    loadExpenses();
  }, [selectedCategory]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      // Get current active month expenses by category (excludes closed months)
      const data = await expensesAPI.getCurrentByCategory(selectedCategory);

      // Format the data to match the UI expectations
      const formattedExpenses = data.map((expense) => ({
        id: expense.id,
        date: expense.date,
        amount: `₹${Math.abs(expense.amount).toFixed(2)}`,
        category: expense.category,
        payment: expense.payment_method || "Cash",
        type: expense.type,
        description: expense.description,
      }));

      setExpenses(formattedExpenses);
    } catch (error) {
      console.error("Error loading expenses:", error);
      Alert.alert("Error", "Failed to load expenses. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  };

  const handleAddExpense = async () => {
    if (!amount.trim()) {
      Alert.alert("Error", "Please enter amount");
      return;
    }

    try {
      const expenseData = {
        date: date,
        amount: parseFloat(amount),
        category: selectedCategory,
        type: type,
        payment_method: paymentMethod,
        description: description.trim() || null,
      };

      await expensesAPI.create(expenseData);

      // Reset form
      setAmount("");
      setType("Udhar");
      setPaymentMethod("Cash");
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);
      setModalVisible(false);

      // Reload expenses
      await loadExpenses();

      Alert.alert("Success", `${selectedCategory} expense added successfully!`);
    } catch (error) {
      console.error("Error adding expense:", error);
      Alert.alert("Error", "Failed to add expense. Please try again.");
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedExpenses(new Set());
  };

  const toggleExpenseSelection = (expenseId) => {
    const newSelected = new Set(selectedExpenses);
    if (newSelected.has(expenseId)) {
      newSelected.delete(expenseId);
    } else {
      newSelected.add(expenseId);
    }
    setSelectedExpenses(newSelected);
  };

  const selectAllExpenses = () => {
    if (selectedExpenses.size === expenses.length) {
      setSelectedExpenses(new Set());
    } else {
      setSelectedExpenses(new Set(expenses.map((expense) => expense.id)));
    }
  };

  const handleDeleteSingle = async (expenseId) => {
    Alert.alert(
      "Delete Expense",
      "Are you sure you want to delete this expense?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await expensesAPI.delete(expenseId);
              await loadExpenses();
              Alert.alert("Success", "Expense deleted successfully!");
            } catch (error) {
              console.error("Error deleting expense:", error);
              Alert.alert(
                "Error",
                "Failed to delete expense. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedExpenses.size === 0) {
      Alert.alert("No Selection", "Please select expenses to delete.");
      return;
    }

    Alert.alert(
      "Delete Expenses",
      `Are you sure you want to delete ₹{selectedExpenses.size} expense(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete all selected expenses
              const deletePromises = Array.from(selectedExpenses).map((id) =>
                expensesAPI.delete(id)
              );

              await Promise.all(deletePromises);

              // Reset selection and reload
              setSelectedExpenses(new Set());
              setSelectionMode(false);
              await loadExpenses();

              Alert.alert(
                "Success",
                `₹{selectedExpenses.size} expense(s) deleted successfully!`
              );
            } catch (error) {
              console.error("Error deleting expenses:", error);
              Alert.alert(
                "Error",
                "Failed to delete some expenses. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const renderExpenseItem = ({ item }) => {
    const isSelected = selectedExpenses.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.expenseItem,
          selectionMode && styles.selectableItem,
          isSelected && styles.selectedItem,
        ]}
        onPress={() => {
          if (selectionMode) {
            toggleExpenseSelection(item.id);
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

        <View style={styles.expenseContent}>
          <View style={styles.expenseInfo}>
            <Text style={styles.expenseDate}>{item.date}</Text>
            <Text style={styles.expenseCategory}>
              Category: {item.category}
            </Text>
            {item.description && (
              <Text style={styles.expenseDescription}>{item.description}</Text>
            )}
          </View>
          <View style={styles.expenseDetails}>
            <Text
              style={[
                styles.expenseAmount,
                item.type === "Jama" ? styles.jamaAmount : styles.udharAmount,
              ]}
            >
              {item.type === "Jama" ? "+" : "-"}
              {item.amount}
            </Text>
            <Text style={styles.expensePayment}>Payment: {item.payment}</Text>
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

  const renderCategoryButton = (category) => (
    <TouchableOpacity
      key={category}
      style={[
        styles.categoryButton,
        selectedCategory === category && styles.selectedCategoryButton,
      ]}
      onPress={() => setSelectedCategory(category)}
    >
      <Text
        style={[
          styles.categoryButtonText,
          selectedCategory === category && styles.selectedCategoryButtonText,
        ]}
      >
        {category}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header Section */}
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
              {selectedExpenses.size} selected
            </Text>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={selectAllExpenses}
            >
              <Text style={styles.selectAllText}>
                {selectedExpenses.size === expenses.length
                  ? "Deselect All"
                  : "Select All"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.normalHeader}>
            <Text style={styles.headerTitle}>Expenses</Text>
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

      {/* Category Buttons */}
      <View style={styles.categorySection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContainer}
        >
          {expenseCategories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.selectedCategoryButton,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  selectedCategory === category &&
                    styles.selectedCategoryButtonText,
                ]}
              >
                {category === "Fuel" ? "Fuel Expense" : category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Expense List */}
      <View style={styles.mainContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading expenses...</Text>
          </View>
        ) : expenses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>No expenses found</Text>
            <Text style={styles.emptySubtext}>
              Tap the + button to add your first expense
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.expenseList}>
              {expenses.map((item, index) => (
                <View key={item.id || index} style={styles.expenseItemWrapper}>
                  {renderExpenseItem({ item })}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Floating Action Buttons */}
      {selectionMode && selectedExpenses.size > 0 && (
        <TouchableOpacity
          style={styles.deleteSelectedButton}
          onPress={handleDeleteSelected}
        >
          <Ionicons name="trash" size={24} color="white" />
          <Text style={styles.deleteSelectedText}>
            Delete ({selectedExpenses.size})
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

      {/* Add Expense Modal */}
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
                  Add {selectedCategory} Expense
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContentContainer}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                bounces={true}
              >
                <View style={styles.formContainer}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Date</Text>
                    <TextInput
                      style={styles.textInput}
                      value={date}
                      onChangeText={setDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Amount *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={amount}
                      onChangeText={setAmount}
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
                          type === "Jama" && styles.selectedTypeButton,
                        ]}
                        onPress={() => setType("Jama")}
                      >
                        <Text
                          style={[
                            styles.typeButtonText,
                            type === "Jama" && styles.selectedTypeButtonText,
                          ]}
                        >
                          Jama (+)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.typeButton,
                          type === "Udhar" && styles.selectedTypeButton,
                        ]}
                        onPress={() => setType("Udhar")}
                      >
                        <Text
                          style={[
                            styles.typeButtonText,
                            type === "Udhar" && styles.selectedTypeButtonText,
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
                    <Text style={styles.inputLabel}>
                      Description (Optional)
                    </Text>
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
                      onPress={() => setModalVisible(false)}
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
  categorySection: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  mainContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  expenseList: {
    padding: 16,
  },
  expenseItemWrapper: {
    marginBottom: 12,
  },
  categoryScrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryContainer: {
    flexDirection: "row",
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    height: 65,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  selectedCategoryButton: {
    backgroundColor: "#6366f1",
  },
  categoryButtonText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  selectedCategoryButtonText: {
    color: "white",
  },
  expenseListSection: {
    flex: 1,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  expenseScrollView: {
    flex: 1,
  },
  expenseScrollContent: {
    paddingBottom: 100,
  },
  expenseItem: {
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
    flexDirection: "row",
    alignItems: "center",
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
  expenseContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  expenseInfo: {
    marginBottom: 8,
  },
  expenseDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  expenseCategory: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 2,
  },
  expenseDescription: {
    fontSize: 14,
    color: "#6b7280",
    fontStyle: "italic",
  },
  expenseDetails: {
    alignItems: "flex-end",
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  jamaAmount: {
    color: "#059669",
  },
  udharAmount: {
    color: "#dc2626",
  },
  expensePayment: {
    fontSize: 14,
    color: "#6b7280",
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
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  emptyStateSubtext: {
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
    overflow: "hidden",
    minHeight: 500,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    // flexDirection: "column",
  },
  keyboardAvoidingView: {
    // justifyContent: "center",
    // alignItems: "center",
    flex: 1,
    // width: "100%",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 20,
    flexGrow: 1,
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
