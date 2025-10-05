import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
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
import { useAuth } from "../../contexts/AuthContext_Simple";
import * as tempFixAPI from "../../lib/supabase_temp_fix";
const { expensesAPI, monthlyClosuresAPI, partiesAPI, transactionsAPI } =
  tempFixAPI;

export default function Reports() {
  const { user } = useAuth();

  // Set the user ID getter for the temp fix
  React.useEffect(() => {
    if (user?.id && tempFixAPI.setUserIdGetter) {
      tempFixAPI.setUserIdGetter(() => user.id);
    }
  }, [user]);

  const [parties, setParties] = useState([]);
  const [selectedParties, setSelectedParties] = useState(new Set());
  const [partyModalVisible, setPartyModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState("single");

  // Monthly Report States
  const [monthlyReportVisible, setMonthlyReportVisible] = useState(false);
  const [monthlyData, setMonthlyData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  ); // YYYY-MM format

  // Close Month States
  const [closeMonthVisible, setCloseMonthVisible] = useState(false);
  const [currentActiveMonth, setCurrentActiveMonth] = useState(null);
  const [monthlyClosures, setMonthlyClosures] = useState([]);
  const [monthSelectorVisible, setMonthSelectorVisible] = useState(false);
  const [availableMonths, setAvailableMonths] = useState([]);

  useEffect(() => {
    loadParties();
    loadMonthlyClosures();
    loadCurrentActiveMonth();
  }, []);

  // Update selectedMonth when currentActiveMonth changes
  useEffect(() => {
    if (currentActiveMonth) {
      setSelectedMonth(currentActiveMonth);
    }
  }, [currentActiveMonth]);

  const loadParties = async () => {
    try {
      const partiesData = await partiesAPI.getAll(user?.id);
      setParties(partiesData);
    } catch (error) {
      console.error("Error loading parties:", error);
      Alert.alert("Error", "Failed to load parties");
    }
  };

  const loadMonthlyClosures = async () => {
    try {
      const closures = await monthlyClosuresAPI.getAll(user?.id);
      setMonthlyClosures(closures);

      // Generate available months for selection (6 months back + current + 6 months forward)
      const months = [];
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();

      for (let i = -6; i <= 6; i++) {
        // Calculate year and month properly to avoid timezone issues
        let targetYear = currentYear;
        let targetMonth = currentMonth + i;

        // Handle year overflow/underflow
        while (targetMonth < 0) {
          targetMonth += 12;
          targetYear -= 1;
        }
        while (targetMonth > 11) {
          targetMonth -= 12;
          targetYear += 1;
        }

        // Create month string in YYYY-MM format (avoid timezone issues)
        const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(
          2,
          "0"
        )}`;

        // Create date for display label
        const displayDate = new Date(targetYear, targetMonth, 1);

        months.push({
          value: monthStr,
          label: displayDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
          }),
          isClosed: closures.some((c) => c.month === monthStr),
        });

        // Debug logging to verify month generation
        console.log(
          `Generated month: ${monthStr}, Label: ${displayDate.toLocaleDateString(
            "en-US",
            { year: "numeric", month: "long" }
          )}, Closed: ${closures.some((c) => c.month === monthStr)}`
        );
      }

      setAvailableMonths(months);
    } catch (error) {
      console.error("Error loading monthly closures:", error);
    }
  };

  const loadCurrentActiveMonth = async () => {
    try {
      const activeMonth = await monthlyClosuresAPI.getCurrentActiveMonth(
        user?.id
      );
      setCurrentActiveMonth(activeMonth);
    } catch (error) {
      console.error("Error loading current active month:", error);
    }
  };

  const handleCloseMonth = async () => {
    if (!currentActiveMonth) {
      Alert.alert("Error", "No active month found");
      return;
    }

    Alert.alert(
      "Close Month",
      `Are you sure you want to close ${new Date(
        currentActiveMonth + "-01"
      ).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      })}?\n\nThis will:\n• Lock all transactions and expenses for this month\n• Start fresh calculations for next month\n• Generate monthly summary\n\nThis action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close Month",
          style: "destructive",
          onPress: performMonthClosure,
        },
      ]
    );
  };

  const performMonthClosure = async () => {
    try {
      setLoading(true);

      // Check if this month is already closed
      const existingClosure = await monthlyClosuresAPI.getByMonth(
        currentActiveMonth,
        user?.id
      );
      if (existingClosure) {
        Alert.alert(
          "Month Already Closed",
          `${new Date(currentActiveMonth + "-01").toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
          })} has already been closed on ${new Date(
            existingClosure.closed_at
          ).toLocaleDateString()}.`
        );
        setLoading(false);
        setCloseMonthVisible(false);
        return;
      }

      // Get all data for the current month
      const allParties = await partiesAPI.getAll(user?.id);
      const monthTransactions = await transactionsAPI.getByMonth(
        currentActiveMonth,
        user?.id
      );
      const monthExpenses = await expensesAPI.getByMonth(
        currentActiveMonth,
        user?.id
      );

      // Calculate totals
      const totalJama = monthTransactions
        .filter((t) => t.type === "Jama")
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      const totalUdhar = monthTransactions
        .filter((t) => t.type === "Udhar")
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      const totalExpenses = monthExpenses.reduce(
        (sum, e) => sum + Math.abs(parseFloat(e.amount)),
        0
      );

      // Count unique parties that had transactions
      const partiesWithTransactions = new Set(
        monthTransactions.map((t) => t.party_id)
      );

      // Create monthly closure record
      const closureData = {
        month: currentActiveMonth,
        total_jama: totalJama,
        total_udhar: totalUdhar,
        total_expenses: totalExpenses,
        net_balance: totalJama - totalUdhar - totalExpenses,
        transactions_count: monthTransactions.length,
        expenses_count: monthExpenses.length,
        parties_count: partiesWithTransactions.size,
        user_id: user?.id || "00000000-0000-0000-0000-000000000001", // Add user_id to the closure data
      };

      await monthlyClosuresAPI.create(closureData);

      // Reload data
      await loadMonthlyClosures();
      await loadCurrentActiveMonth();

      Alert.alert(
        "Success",
        `Month ${new Date(currentActiveMonth + "-01").toLocaleDateString(
          "en-US",
          { year: "numeric", month: "long" }
        )} has been closed successfully!\n\nSummary:\n• Total Jama: ₹${totalJama.toFixed(
          2
        )}\n• Total Udhar: ₹${totalUdhar.toFixed(
          2
        )}\n• Total Expenses: ₹${totalExpenses.toFixed(2)}`
      );

      setCloseMonthVisible(false);
    } catch (error) {
      console.error("Error closing month:", error);
      Alert.alert("Error", "Failed to close month. Please try again.");
    } finally {
      setLoading(false);
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
            <h1>Trips Ledger Report</h1>
            <h2>${party.name}</h2>
            <p class="date">Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          
          ${
            options.includeSummaryMessage
              ? `
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2196f3;">
            <h3 style="margin-top: 0; color: #1976d2;">📱 Trips Message</h3>
            <p style="margin-bottom: 0; font-style: italic;">
              Hi ${party.name}, here is your trips ledger report:<br><br>
              📊 <strong>Trips Ledger Summary</strong><br>
              Party: ${party.name}<br>
              Date: ${new Date().toLocaleDateString()}<br><br>
              💰 <strong>Financial Summary:</strong><br>
              Total Amount: ₹${transactions
                .filter((t) => t.type === "Udhar")
                .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0)
                .toFixed(2)}<br><br>
              📋 Total Trip: ${transactions.length}<br><br>
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
        `PDF${selectedParties.size > 1 ? "s" : ""} generated successfully.`
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

      // Simple manual PDF sharing - message is embedded in PDF
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Share via WhatsApp",
      });

      // No alert needed - user will see the share picker
    } catch (error) {
      console.error("Error sharing to WhatsApp:", error);
      Alert.alert("Error", "Failed to share to WhatsApp");
    }
  };

  // Monthly Report Functions
  const generateMonthlyReport = async () => {
    try {
      setLoading(true);

      // Get all parties
      const allParties = await partiesAPI.getAll(user?.id);

      // Get all transactions for the selected month
      const monthTransactions = await transactionsAPI.getByMonth(
        selectedMonth,
        user?.id
      );

      // Add party info to each transaction
      const allTransactions = monthTransactions.map((transaction) => {
        const party = allParties.find((p) => p.id === transaction.party_id);
        return {
          ...transaction,
          partyName: party?.name || "Unknown Party",
          partyPhone: party?.phone_number || "",
        };
      });

      // Get all expenses for the selected month
      const monthExpenses = await expensesAPI.getByMonth(
        selectedMonth,
        user?.id
      );

      // Calculate totals
      const totalJama = allTransactions
        .filter((t) => t.type === "Jama")
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      const totalUdhar = allTransactions
        .filter((t) => t.type === "Udhar")
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      const totalExpenses = monthExpenses.reduce(
        (sum, e) => sum + Math.abs(parseFloat(e.amount)),
        0
      );

      // Group transactions by party
      const transactionsByParty = {};
      allTransactions.forEach((transaction) => {
        if (!transactionsByParty[transaction.partyName]) {
          transactionsByParty[transaction.partyName] = [];
        }
        transactionsByParty[transaction.partyName].push(transaction);
      });

      // Group expenses by category
      const expensesByCategory = {};
      monthExpenses.forEach((expense) => {
        if (!expensesByCategory[expense.category]) {
          expensesByCategory[expense.category] = [];
        }
        expensesByCategory[expense.category].push(expense);
      });

      const monthlyReportData = {
        month: selectedMonth,
        totalJama,
        totalUdhar,
        totalExpenses,
        netBalance: totalJama - totalUdhar - totalExpenses,
        allTransactions,
        monthExpenses,
        transactionsByParty,
        expensesByCategory,
        partiesCount: Object.keys(transactionsByParty).length,
        transactionsCount: allTransactions.length,
        expensesCount: monthExpenses.length,
      };

      setMonthlyData(monthlyReportData);
      setMonthlyReportVisible(true);
    } catch (error) {
      console.error("Error generating monthly report:", error);
      Alert.alert("Error", "Failed to generate monthly report");
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyPDF = async () => {
    if (!monthlyData) return;

    try {
      const monthName = new Date(selectedMonth + "-01").toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
        }
      );

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Monthly Report - ${monthName}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .summary { display: flex; justify-content: space-around; margin-bottom: 30px; background: #f8f9fa; padding: 20px; border-radius: 8px; }
              .summary-item { text-align: center; }
              .summary-value { font-size: 18px; font-weight: bold; }
              .jama { color: #059669; }
              .udhar { color: #dc2626; }
              .expense { color: #f59e0b; }
              .net { color: #6366f1; }
              .section { margin-bottom: 30px; }
              .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #111827; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .party-section { margin-bottom: 25px; }
              .party-title { font-size: 16px; font-weight: bold; color: #374151; margin-bottom: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Monthly Transport Report</h1>
              <h2>${monthName}</h2>
              <p>Generated on: ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="summary">
              <div class="summary-item">
                <div class="summary-value jama">₹${monthlyData.totalJama.toFixed(
                  2
                )}</div>
                <div>Total Jama</div>
              </div>
              <div class="summary-item">
                <div class="summary-value udhar">₹${monthlyData.totalUdhar.toFixed(
                  2
                )}</div>
                <div>Total Udhar</div>
              </div>
              <div class="summary-item">
                <div class="summary-value expense">₹${monthlyData.totalExpenses.toFixed(
                  2
                )}</div>
                <div>Total Expenses</div>
              </div>

            </div>
            
            <div class="section">
              <div class="section-title">📊 Overview</div>
              <p><strong>Parties:</strong> ${monthlyData.partiesCount}</p>
              <p><strong>Transactions:</strong> ${
                monthlyData.transactionsCount
              }</p>
              <p><strong>Expenses:</strong> ${monthlyData.expensesCount}</p>
            </div>
            
            <div class="section">
              <div class="section-title">🚛 Transactions by Party</div>
              ${Object.entries(monthlyData.transactionsByParty)
                .map(
                  ([partyName, transactions]) => `
                <div class="party-section">
                  <div class="party-title">${partyName}</div>
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
                </div>
              `
                )
                .join("")}
            </div>
            
            <div class="section">
              <div class="section-title">💰 Expenses by Category</div>
              ${Object.entries(monthlyData.expensesByCategory)
                .map(
                  ([category, expenses]) => `
                <div class="party-section">
                  <div class="party-title">${category}</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Payment Method</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${expenses
                        .map(
                          (expense) => `
                        <tr>
                          <td>${expense.date}</td>
                          <td class="expense">₹${Math.abs(
                            parseFloat(expense.amount)
                          ).toFixed(2)}</td>
                          <td>${expense.payment_method}</td>
                          <td>${expense.description || "-"}</td>
                        </tr>
                      `
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              `
                )
                .join("")}
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: `Monthly Report - ${monthName}`,
      });
    } catch (error) {
      console.error("Error generating monthly PDF:", error);
      Alert.alert("Error", "Failed to generate PDF");
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
        <TouchableOpacity
          style={styles.reportOption}
          onPress={generateMonthlyReport}
        >
          <View style={styles.reportIconContainer}>
            <Ionicons name="document-text-outline" size={24} color="#6366f1" />
          </View>
          <View style={styles.reportInfo}>
            <Text style={styles.reportTitle}>Monthly Report</Text>
            <Text style={styles.reportDescription}>
              Generate comprehensive monthly summary with all transactions and
              expenses.
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
          <TouchableOpacity
            style={styles.closeMonth}
            onPress={() => setCloseMonthVisible(true)}
          >
            <Ionicons name="lock-closed-outline" size={20} color="white" />
            <Text style={styles.closeButtonText}>Close Month</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.monthSelector}
            onPress={() => setMonthSelectorVisible(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#6366f1" />
            <Text style={styles.monthSelectorText}>
              {currentActiveMonth
                ? new Date(currentActiveMonth + "-01").toLocaleDateString(
                    "en-US",
                    { year: "numeric", month: "long" }
                  )
                : "Select Month"}
            </Text>
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

            {/* <View style={styles.selectionModeContainer}>
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
            </View> */}

            {/* {selectionMode === "multiple" && (
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
            )} */}

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

      {/* Monthly Report Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={monthlyReportVisible}
        onRequestClose={() => setMonthlyReportVisible(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.monthlyModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Monthly Report -{" "}
                {new Date(selectedMonth + "-01").toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                })}
              </Text>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.pdfButton}
                  onPress={generateMonthlyPDF}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color="#6366f1"
                  />
                  <Text style={styles.pdfButtonText}>Export PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setMonthlyReportVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>

            {monthlyData && (
              <ScrollView
                style={styles.monthlyContent}
                contentContainerStyle={styles.monthlyContentContainer}
                showsVerticalScrollIndicator={true}
                bounces={true}
              >
                {/* Summary Cards */}
                <View style={styles.summarySection}>
                  <View style={styles.summaryGrid}>
                    <View style={[styles.summaryCard, styles.jamaCard]}>
                      <Text style={styles.summaryLabel}>Total Jama</Text>
                      <Text style={[styles.summaryValue, styles.jamaText]}>
                        ₹{monthlyData.totalJama.toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.summaryCard, styles.expenseCard]}>
                      <Text style={styles.summaryLabel}>Total Expenses</Text>
                      <Text style={[styles.summaryValue, styles.expenseText]}>
                        ₹{monthlyData.totalExpenses.toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.summaryCard, styles.udharCard]}>
                      <Text style={styles.summaryLabel}>Total Udhar</Text>
                      <Text style={[styles.summaryValue, styles.udharText]}>
                        ₹{monthlyData.totalUdhar.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Overview Stats */}
                <View style={styles.overviewSection}>
                  <Text style={styles.sectionTitle}>📊 Overview</Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>
                        {monthlyData.partiesCount}
                      </Text>
                      <Text style={styles.statLabel}>Parties</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>
                        {monthlyData.transactionsCount}
                      </Text>
                      <Text style={styles.statLabel}>Transactions</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>
                        {monthlyData.expensesCount}
                      </Text>
                      <Text style={styles.statLabel}>Expenses</Text>
                    </View>
                  </View>
                </View>

                {/* Transactions by Party */}
                <View style={styles.transactionsSection}>
                  <Text style={styles.sectionTitle}>
                    🚛 Transactions by Party
                  </Text>
                  {Object.entries(monthlyData.transactionsByParty).map(
                    ([partyName, transactions]) => (
                      <View key={partyName} style={styles.partySection}>
                        <Text style={styles.partyTitle}>{partyName}</Text>
                        {transactions.map((transaction, index) => (
                          <View key={index} style={styles.transactionItem}>
                            <View style={styles.transactionLeft}>
                              <Text style={styles.transactionDate}>
                                {transaction.date}
                              </Text>
                              <Text style={styles.transactionType}>
                                {transaction.type}
                              </Text>
                              <Text style={styles.transactionRounds}>
                                Rounds: {transaction.rounds}
                              </Text>
                              {transaction.description && (
                                <Text style={styles.transactionDesc}>
                                  {transaction.description}
                                </Text>
                              )}
                            </View>
                            <Text
                              style={[
                                styles.transactionAmount,
                                transaction.type === "Jama"
                                  ? styles.jamaText
                                  : styles.udharText,
                              ]}
                            >
                              ₹
                              {Math.abs(parseFloat(transaction.amount)).toFixed(
                                2
                              )}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )
                  )}
                </View>

                {/* Expenses by Category */}
                <View style={styles.expensesSection}>
                  <Text style={styles.sectionTitle}>
                    💰 Expenses by Category
                  </Text>
                  {Object.entries(monthlyData.expensesByCategory).map(
                    ([category, expenses]) => (
                      <View key={category} style={styles.categorySection}>
                        <Text style={styles.categoryTitle}>{category}</Text>
                        {expenses.map((expense, index) => (
                          <View key={index} style={styles.expenseItem}>
                            <View style={styles.expenseLeft}>
                              <Text style={styles.expenseDate}>
                                {expense.date}
                              </Text>
                              <Text style={styles.expenseMethod}>
                                {expense.payment_method}
                              </Text>
                              {expense.description && (
                                <Text style={styles.expenseDesc}>
                                  {expense.description}
                                </Text>
                              )}
                            </View>
                            <Text
                              style={[styles.expenseAmount, styles.expenseText]}
                            >
                              ₹{Math.abs(parseFloat(expense.amount)).toFixed(2)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Close Month Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={closeMonthVisible}
        onRequestClose={() => setCloseMonthVisible(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Close Current Month</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setCloseMonthVisible(false)}
              >
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.closeMonthContent}>
              <View style={styles.currentMonthInfo}>
                <Text style={styles.currentMonthTitle}>
                  Current Active Month:{" "}
                  {currentActiveMonth
                    ? new Date(currentActiveMonth + "-01").toLocaleDateString(
                        "en-US",
                        { year: "numeric", month: "long" }
                      )
                    : "Loading..."}
                </Text>

                <View style={styles.warningBox}>
                  <Ionicons name="warning-outline" size={24} color="#f59e0b" />
                  <Text style={styles.warningText}>
                    Closing this month will lock all transactions and expenses.
                    This action cannot be undone.
                  </Text>
                </View>

                <View style={styles.closureEffects}>
                  <Text style={styles.effectsTitle}>
                    What happens when you close the month:
                  </Text>
                  <Text style={styles.effectItem}>
                    • All current transactions become read-only
                  </Text>
                  <Text style={styles.effectItem}>
                    • All current expenses become read-only
                  </Text>
                  <Text style={styles.effectItem}>
                    • Monthly summary is generated and saved
                  </Text>
                  <Text style={styles.effectItem}>
                    • New transactions start fresh for next month
                  </Text>
                  <Text style={styles.effectItem}>
                    • Historical data remains accessible for reports
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setCloseMonthVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.closeMonthButton,
                  loading && styles.disabledButton,
                ]}
                onPress={handleCloseMonth}
                disabled={loading}
              >
                <Ionicons name="lock-closed" size={20} color="white" />
                <Text style={styles.closeMonthButtonText}>
                  {loading ? "Closing..." : "Close Month"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Month Selector Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={monthSelectorVisible}
        onRequestClose={() => setMonthSelectorVisible(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Month for Report</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setMonthSelectorVisible(false)}
              >
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.monthsList}>
              {availableMonths.map((month) => (
                <TouchableOpacity
                  key={month.value}
                  style={[
                    styles.monthItem,
                    selectedMonth === month.value && styles.selectedMonthItem,
                    month.isClosed && styles.closedMonthItem,
                  ]}
                  onPress={() => {
                    setSelectedMonth(month.value);
                    setMonthSelectorVisible(false);
                  }}
                >
                  <View style={styles.monthInfo}>
                    <Text
                      style={[
                        styles.monthLabel,
                        selectedMonth === month.value &&
                          styles.selectedMonthLabel,
                      ]}
                    >
                      {month.label}
                    </Text>
                    {month.isClosed && (
                      <View style={styles.closedBadge}>
                        <Ionicons
                          name="lock-closed"
                          size={12}
                          color="#dc2626"
                        />
                        <Text style={styles.closedBadgeText}>Closed</Text>
                      </View>
                    )}
                  </View>
                  {selectedMonth === month.value && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#6366f1"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 12,
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  monthSelector: {
    backgroundColor: "#f3f4f6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  monthSelectorText: {
    color: "#6366f1",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  closeMonthContent: {
    maxHeight: 400,
  },
  currentMonthInfo: {
    padding: 20,
  },
  currentMonthTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 20,
    textAlign: "center",
  },
  warningBox: {
    backgroundColor: "#fef3c7",
    padding: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  warningText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: "#92400e",
    lineHeight: 20,
  },
  closureEffects: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  effectsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  effectItem: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
    lineHeight: 20,
  },
  closeMonthButton: {
    flex: 1,
    backgroundColor: "#dc2626",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  closeMonthButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  monthsList: {
    maxHeight: 400,
  },
  monthItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  selectedMonthItem: {
    backgroundColor: "#f0f9ff",
    borderLeftWidth: 4,
    borderLeftColor: "#6366f1",
  },
  closedMonthItem: {
    backgroundColor: "#fef2f2",
  },
  monthInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthLabel: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  selectedMonthLabel: {
    color: "#6366f1",
    fontWeight: "600",
  },
  closedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  closedBadgeText: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "500",
    marginLeft: 4,
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
    maxHeight: 500,
    paddingHorizontal: 20,
    paddingTop: 20,
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
  // Monthly Report Styles
  monthlyModalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    margin: 20,
    marginTop: 60,
    flex: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  pdfButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 12,
  },
  pdfButtonText: {
    fontSize: 12,
    color: "#6366f1",
    fontWeight: "600",
    marginLeft: 4,
  },
  monthlyContent: {
    flex: 1,
  },
  monthlyContentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  summarySection: {
    marginBottom: 24,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  summaryCard: {
    width: "48%",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  jamaCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#059669",
  },
  udharCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
    width: "100%",
  },
  expenseCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },

  summaryLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  jamaText: {
    color: "#059669",
  },
  udharText: {
    color: "#dc2626",
  },
  expenseText: {
    color: "#f59e0b",
  },

  overviewSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#6366f1",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  transactionsSection: {
    marginBottom: 24,
  },
  partySection: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  partyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
  },
  transactionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  transactionLeft: {
    flex: 1,
  },
  transactionDate: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  transactionType: {
    fontSize: 12,
    color: "#6b7280",
  },
  transactionRounds: {
    fontSize: 12,
    color: "#6b7280",
  },
  transactionDesc: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  expensesSection: {
    marginBottom: 24,
  },
  categorySection: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
  },
  expenseItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  expenseLeft: {
    flex: 1,
  },
  expenseDate: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  expenseMethod: {
    fontSize: 12,
    color: "#6b7280",
  },
  expenseDesc: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
