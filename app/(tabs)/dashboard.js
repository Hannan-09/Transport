import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
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
import { useAuth } from "../../contexts/AuthContext_Simple";
import * as tempFixAPI from "../../lib/supabase_temp_fix";
const { expensesAPI, partiesAPI, transactionsAPI } = tempFixAPI;

// Expense types data
const expenseTypes = [
  { id: "1", name: "Vehicle Repair", icon: "car-outline" },
  { id: "2", name: "Fuel", icon: "car-sport-outline" },
  { id: "3", name: "Other Expenses", icon: "receipt-outline" },
];

export default function Dashboard() {
  const { logout, user } = useAuth();

  // Set the user ID getter for the temp fix
  React.useEffect(() => {
    if (user?.id && tempFixAPI.setUserIdGetter) {
      tempFixAPI.setUserIdGetter(() => user.id);
    }
  }, [user]);

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

  // PDF Generation modal
  const [pdfModalVisible, setPdfModalVisible] = useState(false);

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
      rounds: "1",
      date: new Date().toISOString().split("T")[0],
      description: "",
      baseAmount: "",
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

      // Get current active month transactions to calculate separate Jama and Udhar totals
      const allParties = await partiesAPI.getAll(user?.id);
      let totalJama = 0;
      let totalUdhar = 0;

      for (const party of allParties) {
        // Get only current active month transactions (excludes closed months)
        const transactions = await transactionsAPI.getCurrentByParty(
          party.id,
          user?.id
        );

        transactions.forEach((transaction) => {
          const transactionAmount = Math.abs(parseFloat(transaction.amount));
          if (transaction.type === "Jama") {
            totalJama += transactionAmount;
          } else if (transaction.type === "Udhar") {
            totalUdhar += transactionAmount;
          }
        });
      }

      // Get current active month expenses to calculate total expenses
      const currentExpenses = await expensesAPI.getCurrentActive(user?.id);
      const totalExpenses = currentExpenses.reduce((sum, expense) => {
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
      const partiesData = await partiesAPI.getAll(user?.id);
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
          description: entry.description || "",
          running_balance: 0, // Will be calculated properly in sequence
        };

        return transactionsAPI.create(transactionData, user?.id);
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

      await expensesAPI.create(expenseData, user?.id);

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

  // PDF Generation Functions (copied from reports.js)
  const generatePartyReport = (party, transactions, options = {}) => {
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
          
          ${
            options.includeSummaryMessage
              ? `
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2196f3;">
            <h3 style="margin-top: 0; color: #1976d2;">📱 WhatsApp Message</h3>
            <p style="margin-bottom: 0; font-style: italic;">
              Hi ${party.name}, here is your transport ledger report:<br><br>
              📊 <strong>Transport Ledger Summary</strong><br>
              Party: ${party.name}<br>
              Date: ${new Date().toLocaleDateString()}<br><br>
              💰 <strong>Financial Summary:</strong><br>
              Total Amount: ₹${totalUdhar.toFixed(2)}<br><br>
              📋 Total Transactions: ${transactions.length}<br><br>
              Thank you for your business!
            </p>
          </div>
          `
              : ""
          }
          
          <div class="party-info">
            <p><strong>Party Name:</strong> ${party.name}</p>
            ${
              party.phone_number
                ? `<p><strong>Phone:</strong> ${party.phone_number}</p>`
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
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Rounds</th>
                <th>Description</th>
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
                  <td>${transaction.description || "-"}</td>
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

  const shareToWhatsApp = async (party, reportData, fileUri) => {
    try {
      // Simple manual PDF sharing - message is embedded in PDF
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Share via WhatsApp",
      });

      // No alert needed - user will see the share picker
    } catch (error) {
      console.error("Error sharing to WhatsApp:", error);
      Alert.alert("Error", "Failed to share PDF");
    }
  };

  const handleGeneratePDF = async (party) => {
    try {
      // Get current active month transactions for this party (excludes closed months)
      const transactions = await transactionsAPI.getCurrentByParty(
        party.id,
        user?.id
      );

      // Generate report data with HTML content (include WhatsApp message in PDF)
      const reportData = generatePartyReport(party, transactions, {
        includeSummaryMessage: true,
      });

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: reportData.htmlContent,
        base64: false,
      });

      // Share to WhatsApp
      await shareToWhatsApp(party, reportData, uri);
    } catch (error) {
      console.error("Error generating PDF:", error);
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
    }
  };

  const renderPartyItem = ({ item }) => (
    <View style={styles.partySelectItem}>
      <TouchableOpacity
        style={styles.partySelectMain}
        onPress={() => handlePartySelect(item)}
      >
        <Text style={styles.partySelectName}>{item.name}</Text>
        <Ionicons name="chevron-forward" size={20} color="#6b7280" />
      </TouchableOpacity>
      {/* <TouchableOpacity
        style={styles.pdfButton}
        onPress={() => handleGeneratePDF(item)}
      >
        <Ionicons name="document-text-outline" size={20} color="#6366f1" />
        <Text style={styles.pdfButtonText}>PDF</Text>
      </TouchableOpacity> */}
    </View>
  );

  const renderPartyItemForPDF = ({ item }) => (
    <TouchableOpacity
      style={styles.pdfPartyItem}
      onPress={() => {
        setPdfModalVisible(false);
        handleGeneratePDF(item);
      }}
    >
      <View style={styles.pdfPartyInfo}>
        <Ionicons name="document-text-outline" size={24} color="#6366f1" />
        <Text style={styles.pdfPartyName}>{item.name}</Text>
      </View>
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
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert("Logout", "Are you sure you want to logout?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Logout",
                style: "destructive",
                onPress: async () => {
                  try {
                    await logout();
                    router.replace("/auth/login");
                  } catch (error) {
                    console.log("Logout navigation error:", error);
                    // The AuthGuard should handle the redirect
                    await logout();
                  }
                },
              },
            ]);
          }}
        >
          <Ionicons name="log-out-outline" size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
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

          <TouchableOpacity
            style={styles.tertiaryButton}
            onPress={() => setPdfModalVisible(true)}
          >
            <Text style={styles.tertiaryButtonText}>Generate PDF</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
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

              <ScrollView
                style={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
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
                            expenseType === "Jama" &&
                              styles.selectedTypeButtonText,
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
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* PDF Generation Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={pdfModalVisible}
        onRequestClose={() => setPdfModalVisible(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPdfModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate PDF Report</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setPdfModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={parties}
              renderItem={renderPartyItemForPDF}
              keyExtractor={(item) => item.id}
              style={styles.pdfPartyList}
              contentContainerStyle={styles.pdfPartyListContent}
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              bounces={true}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons
                    name="document-text-outline"
                    size={48}
                    color="#9ca3af"
                  />
                  <Text style={styles.emptyText}>No parties found</Text>
                  <Text style={styles.emptySubtext}>
                    Add parties first to generate PDF reports
                  </Text>
                </View>
              }
            />
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: "#f3f4f6",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    // Shadow styles for elevated card effect
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    // Fix for Android elevation border radius
    borderWidth: 0.2,
    borderColor: "rgba(0,0,0,0.05)",
  },
  expenseCard: {
    backgroundColor: "#fff",
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
    backgroundColor: "#dc2626",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
  },
  tertiaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollContentContainer: {
    padding: 20,
    paddingBottom: 40,
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
    minHeight: "fit-content",
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
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  partySelectMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  partySelectName: {
    fontSize: 16,
    color: "#111827",
    flex: 1,
  },
  pdfButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  pdfButtonText: {
    fontSize: 12,
    color: "#6366f1",
    fontWeight: "600",
    marginLeft: 4,
  },
  pdfPartyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#fefefe",
  },
  pdfPartyInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  pdfPartyName: {
    fontSize: 16,
    color: "#111827",
    marginLeft: 12,
    flex: 1,
  },
  pdfPartyList: {
    maxHeight: "100%",
    marginBottom: 15,
    // flexGrow: 1,
  },
  pdfPartyListContent: {
    // paddingBottom: 20,
  },
  expenseTypeList: {
    maxHeight: 200,
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
