import React, { useState, useEffect, useRef } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, Modal, KeyboardAvoidingView, Platform, ScrollView,
  Animated as RNAnimated
} from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useExpenses } from '../../src/hooks/useExpenses';
import { useAuth } from '../../src/hooks/useAuth';
import { CreateExpenseRequest, Expense } from '../../src/types/expenses';
import { PolicyService } from '../../src/services/policyService';
import NetBalanceTab from '../../src/components/NetBalanceTab';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
import ExpenseDateFilterBar from '../../src/components/expenses/ExpenseDateFilterBar';
import BulkExpenseSheet from '../../src/components/expenses/BulkExpenseSheet';
import { monthStartInput, todayDateInput } from '../../src/components/expenses/expenseConstants';

// --- CONSTANTS ---
const CATEGORIES = ['Education', 'Maintenance', 'Sports', 'Utility', 'Events', 'Salary', 'Other'];

const CATEGORY_META: Record<string, { icon: string; color: string; bg: string }> = {
  Education: { icon: 'graduation-cap', color: '#6366F1', bg: '#EEF2FF' },
  Maintenance: { icon: 'tools', color: '#F59E0B', bg: '#FEF3C7' },
  Sports: { icon: 'running', color: '#10B981', bg: '#D1FAE5' },
  Utility: { icon: 'bolt', color: '#3B82F6', bg: '#DBEAFE' },
  Events: { icon: 'calendar-alt', color: '#EC4899', bg: '#FCE7F3' },
  Salary: { icon: 'wallet', color: '#8B5CF6', bg: '#EDE9FE' },
  Other: { icon: 'ellipsis-h', color: '#6B7280', bg: '#F3F4F6' },
};

const STATUS_META = {
  approved: { bg: '#ECFDF5', text: '#065F46', dot: '#10B981', border: '#A7F3D0', label: 'APPROVED' },
  paid: { bg: '#EFF6FF', text: '#1E40AF', dot: '#3B82F6', border: '#BFDBFE', label: 'PAID' },
  pending: { bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B', border: '#FDE68A', label: 'PENDING' },
};

// Pulsing dot for live status feel
const PulseDot = ({ color }: { color: string }) => {
  const scale = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(scale, { toValue: 1.8, duration: 900, useNativeDriver: true }),
        RNAnimated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: 10, height: 10, justifyContent: 'center', alignItems: 'center' }}>
      <RNAnimated.View style={{
        position: 'absolute', width: 10, height: 10, borderRadius: 5,
        backgroundColor: color, opacity: 0.25, transform: [{ scale }],
      }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
};

export default function AdminExpenses() {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const { expenses, loading, fetchExpenses, createExpense, createBulkExpenses, updateStatus } = useExpenses();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState(monthStartInput);
  const [toDate, setToDate] = useState(todayDateInput);
  const [activeTab, setActiveTab] = useState<'list' | 'balance'>('list');

  // --- MODAL STATES ---
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isBulkModalVisible, setIsBulkModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // --- DELETE STATE ---
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  // --- FORM STATES ---
  const [expenseRows, setExpenseRows] = useState([
    { id: '1', title: '', category: CATEGORIES[0], amount: '', description: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addExpenseRows = () => {
    setExpenseRows(prev => [
      ...prev,
      { id: Date.now().toString(), title: '', category: CATEGORIES[0], amount: '', description: '' }
    ]);
  };

  const updateExpenseRow = (id: string, field: string, value: string) => {
    setExpenseRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeExpenseRow = (id: string) => {
    setExpenseRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  };

  // Search focus
  const [searchFocused, setSearchFocused] = useState(false);

  // FAB press animation
  const fabScale = useRef(new RNAnimated.Value(1)).current;
  const onFabPressIn = () => RNAnimated.spring(fabScale, { toValue: 0.91, useNativeDriver: true }).start();
  const onFabPressOut = () => RNAnimated.spring(fabScale, { toValue: 1, useNativeDriver: true }).start();

  // --- EFFECT ---
  const fetchOptions = React.useMemo(
    () => ({ fromDate, toDate }),
    [fromDate, toDate]
  );

  useEffect(() => {
    if (activeTab === 'list') fetchExpenses(searchQuery, fetchOptions);
  }, [searchQuery, activeTab, fetchOptions]);

  const resetDateFilters = () => {
    setFromDate(monthStartInput());
    setToDate(todayDateInput());
  };

  // --- HANDLERS ---
  const handleAddExpense = async () => {
    const validRows = expenseRows.filter(r => r.title.trim() && r.amount.trim());
    if (validRows.length === 0) { alertCompat('Validation', 'Please fill in at least one expense title and amount.'); return; }
    
    let hasError = false;
    const payload: CreateExpenseRequest[] = validRows.map(r => {
      const amount = parseFloat(r.amount);
      if (isNaN(amount) || amount <= 0) hasError = true;
      return {
        title: r.title.trim(),
        category: r.category,
        amount,
        expense_date: new Date().toISOString().split('T')[0],
        description: r.description.trim() || undefined,
        status: 'paid' as any
      };
    });

    if (hasError) { alertCompat('Validation', 'Invalid amount in one or more rows'); return; }

    setIsSubmitting(true);
    const success = await createBulkExpenses(payload);
    setIsSubmitting(false);
    
    if (success.ok) { 
      setIsAddModalVisible(false); 
      resetForm(); 
      alertCompat('Success', 'Expense(s) created successfully'); 
    }
  };

  const resetForm = () => {
    setExpenseRows([{ id: '1', title: '', category: CATEGORIES[0], amount: '', description: '' }]);
  };

  const handleApprove = async (expense: Expense) => {
    alertCompat('Confirm Approve', 'Are you sure you want to approve this expense?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => { const s = await updateStatus(expense.id, 'approved'); if (s) setSelectedExpense(null); } },
    ]);
  };

  const handlePay = async (expense: Expense) => {
    alertCompat('Confirm Payment', 'Mark this expense as Paid?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Paid', onPress: async () => { const s = await updateStatus(expense.id, 'paid'); if (s) setSelectedExpense(null); } },
    ]);
  };

  const handleDeletePress = () => setIsDeleteModalVisible(true);

  const confirmDelete = async () => {
    if (!selectedExpense) return;
    if (!deleteReason.trim()) { alertCompat('Required', 'Please provide a reason for deletion.'); return; }
    setDeleting(true);
    try {
      await PolicyService.deleteWithReason('expenses', selectedExpense.id, deleteReason);
      setIsDeleteModalVisible(false); setSelectedExpense(null); setDeleteReason('');
      fetchExpenses(searchQuery, fetchOptions); alertCompat('Success', 'Expense deleted.');
    } catch { alertCompat('Error', 'Failed to delete expense.'); }
    finally { setDeleting(false); }
  };

  // Derived summary stats
  const totalPending = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const totalApproved = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + e.amount, 0);
  const totalPaid = expenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0);

  // --- RENDER ITEM ---
  const renderItem = ({ item, index }: { item: Expense; index: number }) => {
    const st = STATUS_META[item.status as keyof typeof STATUS_META] ?? STATUS_META.pending;
    const cat = CATEGORY_META[item.category] ?? CATEGORY_META.Other;

    return (
      <Animated.View entering={FadeInDown.delay(index * 55).duration(500).springify().damping(14)}>
        <TouchableOpacity style={styles.card} onPress={() => setSelectedExpense(item)} activeOpacity={0.8}>
          {/* Category-colored top bar */}
          <View style={[styles.cardTopBar, { backgroundColor: cat.color }]} />

          <View style={styles.cardBody}>
            {/* Row 1: Icon + Title + Amount */}
            <View style={styles.headerRow}>
              <View style={[styles.iconBox, { backgroundColor: cat.bg }]}>
                <FontAwesome5 name={cat.icon} size={14} color={cat.color} />
              </View>
              <View style={styles.titleBox}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.date}>{item.expense_date}</Text>
              </View>
              <View style={styles.amountBlock}>
                <Text style={styles.amountCurrency}>₹</Text>
                <Text style={styles.amount}>{item.amount.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            {/* Row 2: Category pill + Status */}
            <View style={styles.cardFooter}>
              <View style={[styles.catLabel, { backgroundColor: cat.bg }]}>
                <Text style={[styles.catLabelText, { color: cat.color }]}>{item.category}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
                <PulseDot color={st.dot} />
                <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
              </View>
            </View>

            {item.description
              ? <Text style={styles.descText} numberOfLines={1}>"{item.description}"</Text>
              : null}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      <AdminHeader title="Expense Tracker" showBackButton={true} />

      {/* ── TAB SWITCHER ── */}
      <View style={styles.tabContainer}>
        {(['list', 'balance'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.activeTabBtn]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={tab === 'list' ? 'receipt-outline' : 'stats-chart-outline'}
              size={14}
              color={activeTab === tab ? '#fff' : theme.colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'list' ? 'Expenses' : 'Net Balance'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'list' ? (
        <>
          {/* ── SEARCH ── */}
          <View style={[styles.searchContainer, ds.searchBarWrapper, searchFocused && styles.searchContainerFocused]}>
            <Ionicons
              name="search-outline" size={17}
              color={searchFocused ? '#6366F1' : '#9CA3AF'}
              style={styles.searchIcon}
            />
            <AppTextInput
              style={[ds.inputInChrome, styles.searchInput]}
              placeholder="Search by title, category..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                <Ionicons name="close" size={13} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <ExpenseDateFilterBar
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            onClear={resetDateFilters}
          />

          {/* ── SUMMARY STRIP ── */}
          {expenses.length > 0 && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.summaryStrip}>
              {[
                { label: 'Pending', amount: totalPending, color: STATUS_META.pending.dot, text: STATUS_META.pending.text },
                { label: 'Approved', amount: totalApproved, color: STATUS_META.approved.dot, text: STATUS_META.approved.text },
                { label: 'Paid', amount: totalPaid, color: STATUS_META.paid.dot, text: STATUS_META.paid.text },
              ].map((stat, i) => (
                <React.Fragment key={stat.label}>
                  {i > 0 && <View style={styles.summaryDivider} />}
                  <View style={[styles.summaryChip, { borderLeftColor: stat.color }]}>
                    <Text style={styles.summaryLabel}>{stat.label}</Text>
                    <Text style={[styles.summaryAmount, { color: stat.text }]}>
                      ₹{stat.amount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </Animated.View>
          )}

          {/* ── LIST ── */}
          {loading && expenses.length === 0 ? (
            <View style={styles.centered}>
              <LogoLoader size={56} color="#6366F1" />
              <Text style={styles.loadingText}>Loading expenses...</Text>
            </View>
          ) : (
            <FlatList
              data={expenses}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Animated.View entering={ZoomIn.duration(400)} style={styles.emptyIconWrap}>
                    <FontAwesome5 name="receipt" size={28} color="#A5B4FC" />
                  </Animated.View>
                  <Text style={styles.emptyTitle}>No Expenses Found</Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery ? `No results for "${searchQuery}"` : 'Tap + to log your first expense'}
                  </Text>
                </View>
              }
              refreshing={loading}
              onRefresh={() => fetchExpenses(searchQuery, fetchOptions)}
            />
          )}

          {/* ── FAB ── */}
          <RNAnimated.View style={[styles.fabWrapper, { transform: [{ scale: fabScale }] }]}>
            <TouchableOpacity
              style={styles.fab}
              onPress={() => setIsAddModalVisible(true)}
              onPressIn={onFabPressIn}
              onPressOut={onFabPressOut}
              activeOpacity={1}
            >
              <Ionicons name="add" size={24} color="#fff" />
              <Text style={styles.fabLabel}>Add Expense</Text>
            </TouchableOpacity>
          </RNAnimated.View>
        </>
      ) : (
        <NetBalanceTab />
      )}

      {/* ════════════════════════════════════
          ADD EXPENSE MODAL  (Bottom Sheet)
      ════════════════════════════════════ */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetOverlay}>
          <Animated.View entering={FadeInUp.duration(320).springify()} style={styles.sheetContent}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <View style={styles.sheetIconBadge}>
                  <Ionicons name="receipt-outline" size={16} color="#6366F1" />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>New Expense</Text>
                  <Text style={styles.sheetSubtitle}>Fill in details to log</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => { setIsAddModalVisible(false); resetForm(); }}>
                <Ionicons name="close" size={18} color="#374151" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldSep} />

            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{ minWidth: 600, paddingVertical: 10 }}>
                {/* Header */}
                <View style={[styles.headerRow, { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 8, marginBottom: 8 }]}>
                  <Text style={[styles.gridHeaderCell, { width: 140 }]}>Title</Text>
                  <Text style={[styles.gridHeaderCell, { width: 110 }]}>Category</Text>
                  <Text style={[styles.gridHeaderCell, { width: 90 }]}>Amount</Text>
                  <Text style={[styles.gridHeaderCell, { width: 160 }]}>Description</Text>
                  <Text style={[styles.gridHeaderCell, { width: 40 }]}></Text>
                </View>

                {/* Rows */}
                <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {expenseRows.map((row, idx) => (
                    <View key={row.id} style={[styles.dataRow, { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 6 }]}>
                      <AppTextInput
                        style={[styles.cellInput, { width: 140 }]}
                        placeholder="e.g. Lab Items"
                        placeholderTextColor="#9CA3AF"
                        value={row.title}
                        onChangeText={(v) => updateExpenseRow(row.id, 'title', v)}
                      />
                      <TouchableOpacity
                        style={[styles.categoryCell, { width: 110 }]}
                        onPress={() => {
                          const cIdx = CATEGORIES.indexOf(row.category);
                          const nextC = CATEGORIES[(cIdx + 1) % CATEGORIES.length];
                          updateExpenseRow(row.id, 'category', nextC);
                        }}
                      >
                        <Text style={styles.categoryText} numberOfLines={1}>{row.category}</Text>
                        <Ionicons name="chevron-down" size={12} color="#9CA3AF" />
                      </TouchableOpacity>
                      <View style={[styles.amountCell, { width: 90 }]}>
                        <Text style={styles.amountPrefix}>₹</Text>
                        <AppTextInput
                          style={[styles.cellInput, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                          placeholder="0.00"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="numeric"
                          value={row.amount}
                          onChangeText={(v) => updateExpenseRow(row.id, 'amount', v)}
                        />
                      </View>
                      <AppTextInput
                        style={[styles.cellInput, { width: 160 }]}
                        placeholder="Notes..."
                        placeholderTextColor="#9CA3AF"
                        value={row.description}
                        onChangeText={(v) => updateExpenseRow(row.id, 'description', v)}
                      />
                      <TouchableOpacity style={styles.deleteRowBtn} onPress={() => removeExpenseRow(row.id)}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.addGridRowBtn} onPress={addExpenseRows}>
              <Ionicons name="add-circle" size={20} color="#6366F1" />
              <Text style={styles.addGridRowText}>Add one more row</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAddExpense} disabled={isSubmitting}>
              {isSubmitting ? (
                <LogoLoader color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Submit Expenses</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════════════════════════════════════
          DETAILS MODAL
      ════════════════════════════════════ */}
      <Modal visible={!!selectedExpense} animationType="fade" transparent={true}>
        <View style={styles.overlayBlur}>
          {selectedExpense && (() => {
            const st = STATUS_META[selectedExpense.status as keyof typeof STATUS_META] ?? STATUS_META.pending;
            const cat = CATEGORY_META[selectedExpense.category] ?? CATEGORY_META.Other;
            return (
              <Animated.View entering={ZoomIn.duration(280).springify()} style={styles.detailsCard}>
                {/* Colored header band */}
                <View style={[styles.detailBand, { backgroundColor: cat.bg }]}>
                  <View style={[styles.detailBandIcon, { backgroundColor: cat.color }]}>
                    <FontAwesome5 name={cat.icon} size={18} color="#fff" />
                  </View>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedExpense(null)}>
                    <Ionicons name="close" size={18} color="#374151" />
                  </TouchableOpacity>
                </View>

                {/* Amount hero */}
                <View style={styles.detailAmountSection}>
                  <Text style={styles.detailAmountLabel}>TOTAL AMOUNT</Text>
                  <Text style={styles.detailAmountValue}>
                    <Text style={styles.detailAmountRs}>₹</Text>
                    {selectedExpense.amount.toLocaleString('en-IN')}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg, borderColor: st.border, alignSelf: 'center', marginTop: 10 }]}>
                    <PulseDot color={st.dot} />
                    <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
                  </View>
                </View>

                <View style={styles.detailSep} />

                {[
                  { label: 'Title', value: selectedExpense.title },
                  { label: 'Date', value: selectedExpense.expense_date },
                ].map(({ label, value }) => (
                  <View key={label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text style={styles.detailValue}>{value}</Text>
                  </View>
                ))}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Category</Text>
                  <View style={[styles.detailCatPill, { backgroundColor: cat.bg }]}>
                    <FontAwesome5 name={cat.icon} size={10} color={cat.color} style={{ marginRight: 4 }} />
                    <Text style={[styles.detailCatText, { color: cat.color }]}>{selectedExpense.category}</Text>
                  </View>
                </View>

                {selectedExpense.description && (
                  <View style={styles.detailDescBox}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailLog}>{selectedExpense.description}</Text>
                  </View>
                )}

                <View style={styles.actionRow}>
                  {selectedExpense.status === 'pending' && (
                    <>
                      <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleApprove(selectedExpense)}>
                        <MaterialIcons name="check" size={17} color="#fff" />
                        <Text style={styles.actionText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDeletePress}>
                        <MaterialIcons name="delete-outline" size={17} color="#fff" />
                        <Text style={styles.actionText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {selectedExpense.status === 'approved' && (
                    <TouchableOpacity style={[styles.actionBtn, styles.payBtn]} onPress={() => handlePay(selectedExpense)}>
                      <MaterialIcons name="attach-money" size={17} color="#fff" />
                      <Text style={styles.actionText}>Mark as Paid</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Animated.View>
            );
          })()}
        </View>
      </Modal>

      {/* ════════════════════════════════════
          DELETE REASON MODAL
      ════════════════════════════════════ */}
      <Modal visible={isDeleteModalVisible} transparent={true} animationType="fade">
        <View style={styles.overlayBlur}>
          <Animated.View entering={ZoomIn.duration(280).springify()} style={styles.deleteCard}>
            <View style={styles.deleteIconRing}>
              <MaterialIcons name="warning-amber" size={26} color="#EF4444" />
            </View>
            <Text style={styles.deleteTitle}>Reject & Delete</Text>
            <Text style={styles.deleteSubtitle}>
              This is permanent and will be recorded in the audit log.
            </Text>
            <AppTextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top', marginTop: 16, width: '100%' }]}
              placeholder="Reason (e.g. Unjustified, Budget exceeded)"
              placeholderTextColor="#9CA3AF"
              multiline
              value={deleteReason}
              onChangeText={setDeleteReason}
            />
            <View style={styles.deleteActions}>
              <TouchableOpacity onPress={() => setIsDeleteModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDelete} style={styles.confirmDeleteBtn} disabled={deleting}>
                {deleting
                  ? <LogoLoader color="#fff" size={28} />
                  : <Text style={styles.confirmDeleteText}>Confirm Delete</Text>
                }
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────
const getStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  loadingText: { marginTop: 14, fontSize: 13, color: theme.colors.textSecondary, letterSpacing: 0.3 },

  // ── TABS ──────────────────────────────────
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    marginHorizontal: 20, marginTop: 14,
    borderRadius: 15, padding: 5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 12, borderRadius: 11,
  },
  activeTabBtn: {
    backgroundColor: '#6366F1',
    elevation: 6,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  activeTabText: { color: '#fff', fontWeight: '800' },

  // ── SEARCH ────────────────────────────────
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.background,
    marginHorizontal: 20, marginTop: 14,
    paddingHorizontal: 14, borderRadius: 14,
    height: 50, elevation: 2,
    borderWidth: 1.5, borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 5,
  },
  searchContainerFocused: {
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#1F2937', fontWeight: '500' },
  clearBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#9CA3AF',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── SUMMARY STRIP ─────────────────────────
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    marginHorizontal: 20, marginTop: 12,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 5,
    alignItems: 'center',
  },
  summaryChip: {
    flex: 1, alignItems: 'center',
    borderLeftWidth: 3, paddingLeft: 10,
  },
  summaryDivider: { width: 1, height: 32, backgroundColor: theme.colors.card, marginHorizontal: 6 },
  summaryLabel: { fontSize: 10, color: theme.colors.textTertiary, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  summaryAmount: { fontSize: 14, fontWeight: '900', marginTop: 3, letterSpacing: -0.4 },

  // ── LIST ──────────────────────────────────
  listContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 120 },

  // ── CARD ──────────────────────────────────
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 20, marginBottom: 14,
    elevation: 5,
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 14,
    overflow: 'hidden',
  },
  cardTopBar: { height: 4 },
  cardBody: { padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconBox: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 13,
  },
  titleBox: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: '#111827', letterSpacing: -0.3 },
  date: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 3, fontWeight: '500' },
  amountBlock: { alignItems: 'flex-end' },
  amountCurrency: { fontSize: 10, color: '#EF4444', fontWeight: '800', lineHeight: 14 },
  amount: { fontSize: 18, fontWeight: '900', color: '#EF4444', letterSpacing: -0.6, lineHeight: 24 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catLabel: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  catLabelText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  descText: {
    fontSize: 11, color: theme.colors.textTertiary, fontStyle: 'italic',
    marginTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.card, paddingTop: 8,
  },

  // ── STATUS BADGE ──────────────────────────
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  sApproved: { backgroundColor: '#ECFDF5' },
  sPending: { backgroundColor: '#FFFBEB' },
  sPaid: { backgroundColor: '#EFF6FF' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },

  // ── FAB ───────────────────────────────────
  fabWrapper: { position: 'absolute', bottom: 28, right: 18 },
  fabWrapperSecondary: { position: 'absolute', bottom: 28, right: 168 },
  fabSecondary: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.background,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  fab: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 15, paddingHorizontal: 24,
    borderRadius: 32,
    elevation: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 16,
    gap: 7,
  },
  fabLabel: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.2 },

  // ── EMPTY STATE ───────────────────────────
  emptyContainer: { alignItems: 'center', paddingTop: 70 },
  emptyIconWrap: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
    elevation: 2,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#374151', letterSpacing: -0.3 },
  emptySubtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },

  // ── OVERLAY ───────────────────────────────
  overlayBlur: {
    flex: 1, backgroundColor: 'rgba(8,8,24,0.62)',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── BOTTOM SHEET ──────────────────────────
  sheetOverlay: {
    flex: 1, backgroundColor: 'rgba(8,8,24,0.55)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 22, paddingBottom: 38, paddingTop: 12,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18, shadowRadius: 22,
  },
  sheetHandle: {
    width: 42, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 18,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetIconBadge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center',
  },
  sheetTitle: { fontSize: 17, fontWeight: '900', color: '#111827', letterSpacing: -0.4 },
  sheetSubtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  fieldSep: { height: 1, backgroundColor: theme.colors.card, marginBottom: 2 },

  // ── SHARED CLOSE BTN ──────────────────────
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.card,
    justifyContent: 'center', alignItems: 'center',
  },

  // ── FORM ──────────────────────────────────
  label: {
    fontSize: 10, fontWeight: '800', color: '#9CA3AF',
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginTop: 16, marginBottom: 8,
  },
  labelOpt: { fontWeight: '400', color: '#C4B5FD', textTransform: 'none', letterSpacing: 0 },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: 13, padding: 14,
    fontSize: 15, color: '#1F2937', fontWeight: '500',
  },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencyBox: {
    width: 48, height: 52, borderRadius: 13,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FECACA',
  },
  currencyBoxText: { fontSize: 18, fontWeight: '900', color: '#EF4444' },
  categoryRow: { paddingVertical: 4 },
  catChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 13, paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    marginRight: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  catText: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '500' },
  submitBtn: {
    backgroundColor: '#6366F1',
    padding: 17, borderRadius: 16,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    marginTop: 22,
    elevation: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.45, shadowRadius: 14,
  },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },

  // ── DETAILS CARD ──────────────────────────
  detailsCard: {
    width: '90%',
    backgroundColor: theme.colors.background,
    borderRadius: 28, overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2, shadowRadius: 28,
  },
  detailBand: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20, paddingBottom: 16,
  },
  detailBandIcon: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
    elevation: 5,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8,
  },
  detailAmountSection: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 24 },
  detailAmountLabel: {
    fontSize: 10, color: '#EF4444', fontWeight: '800',
    letterSpacing: 1.8, textTransform: 'uppercase',
  },
  detailAmountValue: {
    fontSize: 36, fontWeight: '900', color: '#EF4444',
    letterSpacing: -1.5, marginTop: 5,
  },
  detailAmountRs: { fontSize: 22, fontWeight: '700' },
  detailSep: { height: 1, backgroundColor: theme.colors.card, marginHorizontal: 20 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 22, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.colors.card,
  },
  detailRowVertical: { marginBottom: 4 },
  detailLabel: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#111827', letterSpacing: -0.2 },
  detailCatPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  detailCatText: { fontSize: 12, fontWeight: '700' },
  detailDescBox: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 4 },
  detailLog: {
    backgroundColor: theme.colors.card,
    padding: 14, borderRadius: 12, marginTop: 6,
    fontSize: 13, color: '#374151', lineHeight: 20,
    borderLeftWidth: 3, borderLeftColor: '#6366F1',
  },
  actionRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingVertical: 20,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', paddingVertical: 14,
    borderRadius: 14, alignItems: 'center',
    justifyContent: 'center', gap: 7, elevation: 4,
  },
  approveBtn: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38, shadowRadius: 8,
  },
  payBtn: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38, shadowRadius: 8,
  },
  deleteBtn: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38, shadowRadius: 8,
  },
  actionText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.2 },

  // ── DELETE MODAL ──────────────────────────
  deleteCard: {
    width: '88%',
    backgroundColor: theme.colors.background,
    borderRadius: 26, padding: 28,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18, shadowRadius: 24,
    alignItems: 'center',
  },
  deleteIconRing: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    borderWidth: 4, borderColor: '#FECACA',
  },
  deleteTitle: { fontSize: 19, fontWeight: '900', color: '#111827', letterSpacing: -0.4 },
  deleteSubtitle: {
    fontSize: 13, color: theme.colors.textSecondary,
    textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 10,
  },
  deleteActions: {
    flexDirection: 'row', alignSelf: 'stretch',
    justifyContent: 'flex-end', gap: 10, marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 18, paddingVertical: 13,
    borderRadius: 12, backgroundColor: theme.colors.card,
  },
  cancelBtnText: { color: '#6B7280', fontWeight: '700', fontSize: 14 },
  confirmDeleteBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20, paddingVertical: 13,
    borderRadius: 12, elevation: 4,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.38, shadowRadius: 8,
  },
  confirmDeleteText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  // ── GRID LAYOUT ───────────────────────────
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gridHeaderCell: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  cellInput: {
    height: 38,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  categoryCell: {
    height: 38,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  amountCell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    paddingLeft: 8,
    height: 38,
  },
  amountPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginRight: 2,
  },
  deleteRowBtn: {
    width: 40,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGridRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderStyle: 'dashed',
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#F5F8FF',
  },
  addGridRowText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
  },
});