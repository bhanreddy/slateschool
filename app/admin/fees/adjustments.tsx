import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Platform,
  StatusBar,
} from 'react-native';
import KeyboardAwareScreen from '@/components/keyboard/KeyboardAwareScreen';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';
import { alertCompat } from '../../../src/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../../src/constants/adminTheme';
import { StudentService } from '../../../src/services/studentService';
import { FeeService } from '../../../src/services/feeService';
import { useTheme } from '../../../src/hooks/useTheme';
import { Theme } from '../../../src/theme/themes';
import LogoLoader from '../../../src/components/LogoLoader';
import PremiumButton from '../../../src/components/PremiumButton';
import { StudentFee, Student, FeeAdjustmentType } from '../../../src/types/models';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { clayCard } from '../../../src/theme/clayStyles';

interface AdjustmentLog {
  id: string;
  amount: number;
  reason: string;
  receipt_no: string;
  fee_component: string;
  created_at: string;
  adjusted_by_name: string;
  student_name: string;
  admission_no: string;
  adjustment_type?: FeeAdjustmentType;
}

type HistoryFilter = 'all' | 'waive' | 'add';

const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const HistoryRow = React.memo(function HistoryRow({
  item,
  styles,
  index,
}: {
  item: AdjustmentLog;
  styles: ReturnType<typeof getStyles>;
  index: number;
}) {
  const formattedDate = new Date(item.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', '');

  const isAdd = (item.adjustment_type ?? 'waive') === 'add';
  const amount = Number(item.amount) || 0;
  const amountText = `${isAdd ? '+' : '−'}${fmtINR(amount)}`;

  return (
    <Animated.View
      entering={index < 12 ? FadeInDown.delay(index * 40).duration(300) : undefined}
    >
      <View style={styles.historyCard}>
        <View
          style={[
            styles.historyAccent,
            { backgroundColor: isAdd ? '#F59E0B' : '#10B981' },
          ]}
        />
        <View style={styles.historyBody}>
          <View style={styles.historyTopRow}>
            <View
              style={[
                styles.historyIconWrap,
                { backgroundColor: isAdd ? '#FFFBEB' : '#ECFDF5' },
              ]}
            >
              <Ionicons
                name={isAdd ? 'add-circle' : 'remove-circle'}
                size={18}
                color={isAdd ? '#D97706' : '#059669'}
              />
            </View>
            <View style={styles.historyTitleCol}>
              <Text style={styles.historyStudent} numberOfLines={1}>
                {item.student_name}
              </Text>
              <Text style={styles.historyMeta} numberOfLines={1}>
                #{item.admission_no} · {item.fee_component}
              </Text>
            </View>
            <View style={styles.historyAmountCol}>
              <Text
                style={[
                  styles.historyAmount,
                  isAdd ? styles.historyAmountAdd : styles.historyAmountWaive,
                ]}
              >
                {amountText}
              </Text>
              <View
                style={[
                  styles.historyBadge,
                  isAdd ? styles.historyBadgeAdd : styles.historyBadgeWaive,
                ]}
              >
                <Text
                  style={[
                    styles.historyBadgeText,
                    isAdd && styles.historyBadgeTextAdd,
                  ]}
                >
                  {isAdd ? 'Added' : 'Waived'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.historyReasonRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={12} color="#94A3B8" />
            <Text style={styles.historyReason} numberOfLines={2}>
              {item.reason}
            </Text>
          </View>

          <View style={styles.historyFooter}>
            <View style={styles.historyFooterItem}>
              <Ionicons name="time-outline" size={12} color="#94A3B8" />
              <Text style={styles.historyFooterText}>{formattedDate}</Text>
            </View>
            <View style={styles.historyFooterItem}>
              <Ionicons name="person-outline" size={12} color="#94A3B8" />
              <Text style={styles.historyFooterText}>{item.adjusted_by_name}</Text>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

export default function FeeAdjustmentsScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<FeeAdjustmentType>('waive');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState<AdjustmentLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await FeeService.getAdjustments();
      setHistory(res?.data || []);
    } catch (error) {
      console.error('Failed to load adjustments history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    const query = text.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      const results = await StudentService.search(query);
      setSearchResults(results || []);
    } catch (error) {
      console.error('Student search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFee(null);
    setAdjustAmount('');
    setReason('');

    try {
      setLoadingFees(true);
      const feeData = await FeeService.getStudentFees(student.id);
      setStudentFees(feeData?.fees || []);
    } catch (error) {
      alertCompat('Error', 'Failed to load student fees');
    } finally {
      setLoadingFees(false);
    }
  };

  const clearStudent = () => {
    setSelectedStudent(null);
    setStudentFees([]);
    setSelectedFee(null);
    setAdjustAmount('');
    setReason('');
  };

  const handleSelectFee = (fee: StudentFee) => {
    setSelectedFee(fee);
    setAdjustAmount('');
  };

  const handleSubmit = async () => {
    if (!selectedStudent || !selectedFee || !adjustAmount || !reason.trim()) {
      alertCompat('Error', 'Please fill in all required fields');
      return;
    }

    const parsedAmount = Number(adjustAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      if (adjustmentType === 'add') {
        alertCompat('Error', 'Amount must be greater than zero');
      } else {
        alertCompat('Error', 'Adjustment amount must be a positive number');
      }
      return;
    }

    const remaining = selectedFee.amount_due - selectedFee.discount - selectedFee.amount_paid;
    if (adjustmentType === 'waive' && parsedAmount > remaining) {
      alertCompat(
        'Error',
        `Cannot waive more than the outstanding amount (${fmtINR(remaining)})`
      );
      return;
    }

    try {
      setSubmitting(true);
      await FeeService.adjustFee({
        student_fee_id: selectedFee.id,
        amount: parsedAmount,
        reason: reason.trim(),
        adjustment_type: adjustmentType,
      });

      alertCompat('Success', 'Adjustment applied successfully');

      setAdjustAmount('');
      setReason('');
      setSelectedFee(null);

      const updatedFeeData = await FeeService.getStudentFees(selectedStudent.id);
      setStudentFees(updatedFeeData?.fees || []);

      loadHistory();
    } catch (error: any) {
      alertCompat('Error', error?.message || 'Failed to apply fee adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  const summary = useMemo(() => {
    let waived = 0;
    let added = 0;
    let waiveCount = 0;
    let addCount = 0;
    for (const item of history) {
      const amount = Number(item.amount) || 0;
      const isAdd = (item.adjustment_type ?? 'waive') === 'add';
      if (isAdd) {
        added += amount;
        addCount += 1;
      } else {
        waived += amount;
        waiveCount += 1;
      }
    }
    return { waived, added, waiveCount, addCount, total: history.length };
  }, [history]);
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return history;
    return history.filter(
      (item) => (item.adjustment_type ?? 'waive') === historyFilter
    );
  }, [history, historyFilter]);

  const remainingBalance = selectedFee
    ? selectedFee.amount_due - selectedFee.discount - selectedFee.amount_paid
    : 0;

  const canSubmit =
    !!selectedStudent &&
    !!selectedFee &&
    !!adjustAmount.trim() &&
    !!reason.trim() &&
    !submitting;

  const renderHistoryItem = useCallback(
    ({ item, index }: { item: AdjustmentLog; index: number }) => (
      <HistoryRow item={item} styles={styles} index={index} />
    ),
    [styles]
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      <AdminHeader title="Fee Adjustments" showBackButton />

      <KeyboardAwareScreen
        variant="scroll"
        contentContainerStyle={styles.scrollContent}
        bottomOffset={24}
      >
        {/* Intro */}
        <Animated.View entering={FadeInDown.duration(320)} style={styles.introCard}>
          <LinearGradient
            colors={isDark ? ['#1E1B4B', '#312E81'] : ['#EEF2FF', '#E0E7FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.introOrb} />
          <View style={styles.introRow}>
            <View style={styles.introIconWrap}>
              <Ionicons name="swap-horizontal" size={22} color={ADMIN_THEME.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>Waive or correct fees</Text>
              <Text style={styles.introDesc}>
                Search a student, pick a fee head, then waive or add an amount with a clear reason.
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Summary strip */}
        {history.length > 0 && (
          <Animated.View entering={FadeInDown.delay(60).duration(300)} style={styles.summaryStrip}>
            <View style={styles.summaryHero}>
              <Text style={styles.summaryHeroLabel}>Logged</Text>
              <Text style={styles.summaryHeroAmount}>{summary.total}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryChip}>
              <View style={[styles.summaryDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.summaryLabel}>Waived</Text>
              <Text style={styles.summaryAmount}>{fmtINR(summary.waived)}</Text>
            </View>
            <View style={styles.summaryChip}>
              <View style={[styles.summaryDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.summaryLabel}>Added</Text>
              <Text style={styles.summaryAmount}>{fmtINR(summary.added)}</Text>
            </View>
          </Animated.View>
        )}

        {/* Apply Adjustment */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(320)}
          style={[styles.card, clayCard(isDark, 'md')]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBadge}>
              <Ionicons name="create-outline" size={16} color={ADMIN_THEME.colors.primary} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Apply Adjustment</Text>
              <Text style={styles.cardSubtitle}>Step through student → fee → amount</Text>
            </View>
          </View>

          {/* Step 1: Search */}
          <View style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <Text style={styles.stepLabel}>Find student</Text>
          </View>

          {!selectedStudent ? (
            <>
              <View
                style={[
                  styles.searchContainer,
                  searchFocused && styles.searchContainerFocused,
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={searchFocused ? ADMIN_THEME.colors.primary : '#94A3B8'}
                  style={styles.searchIcon}
                />
                <AppTextInput
                  value={searchQuery}
                  onChangeText={handleSearch}
                  placeholder="Name or admission number…"
                  placeholderTextColor="#94A3B8"
                  style={[ds.inputInChrome, styles.searchInput]}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                {searching ? (
                  <LogoLoader size={18} color={ADMIN_THEME.colors.primary} />
                ) : searchQuery.length > 0 ? (
                  <Pressable
                    onPress={clearSearch}
                    style={({ pressed }) => [
                      styles.clearSearchBtn,
                      pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
                    ]}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                ) : null}
              </View>

              {searchQuery.trim().length === 1 && (
                <Text style={styles.hintText}>Type at least 2 characters to search</Text>
              )}

              {searchResults.length > 0 && (
                <View style={styles.dropdown}>
                  {searchResults.map((student, idx) => (
                    <Pressable
                      key={student.id}
                      style={({ pressed }) => [
                        styles.dropdownItem,
                        idx === searchResults.length - 1 && styles.dropdownItemLast,
                        pressed && styles.dropdownItemPressed,
                      ]}
                      onPress={() => handleSelectStudent(student)}
                    >
                      <View style={styles.dropdownAvatar}>
                        <Text style={styles.dropdownAvatarText}>
                          {(student.display_name || 'S').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dropdownName}>{student.display_name}</Text>
                        <Text style={styles.dropdownMeta}>#{student.admission_no}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                    </Pressable>
                  ))}
                </View>
              )}

              {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
                <View style={styles.inlineEmpty}>
                  <Ionicons name="person-outline" size={20} color="#94A3B8" />
                  <Text style={styles.inlineEmptyText}>No students matched that search</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.studentBanner}>
              <LinearGradient
                colors={['rgba(102,89,144,0.12)', 'rgba(102,89,144,0.04)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(selectedStudent.display_name || 'S').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{selectedStudent.display_name}</Text>
                <Text style={styles.studentDetails}>
                  Admission · {selectedStudent.admission_no}
                </Text>
              </View>
              <Pressable
                onPress={clearStudent}
                style={({ pressed }) => [
                  styles.clearStudentBtn,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
                ]}
                hitSlop={8}
                accessibilityLabel="Change student"
              >
                <Ionicons name="close" size={16} color="#64748B" />
              </Pressable>
            </View>
          )}

          {/* Step 2: Fee component */}
          {selectedStudent && (
            <>
              <View style={[styles.stepRow, { marginTop: 22 }]}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>2</Text>
                </View>
                <Text style={styles.stepLabel}>Select fee component</Text>
              </View>

              {loadingFees ? (
                <View style={styles.inlineLoader}>
                  <LogoLoader size={28} color={ADMIN_THEME.colors.primary} />
                  <Text style={styles.hintText}>Loading fee heads…</Text>
                </View>
              ) : studentFees.length === 0 ? (
                <View style={styles.inlineEmpty}>
                  <Ionicons name="document-outline" size={20} color="#94A3B8" />
                  <Text style={styles.inlineEmptyText}>
                    No fee structures assigned to this student
                  </Text>
                </View>
              ) : (
                <View style={styles.chipGrid}>
                  {studentFees.map((fee) => {
                    const remaining = fee.amount_due - fee.discount - fee.amount_paid;
                    const isSelected = selectedFee?.id === fee.id;
                    const isFullyPaid = remaining <= 0;
                    const chipDisabled = adjustmentType === 'waive' && isFullyPaid;

                    return (
                      <Pressable
                        key={fee.id}
                        disabled={chipDisabled}
                        style={({ pressed }) => [
                          styles.feeChip,
                          isSelected && styles.feeChipActive,
                          chipDisabled && styles.feeChipDisabled,
                          pressed && !chipDisabled && { transform: [{ scale: 0.98 }], opacity: 0.92 },
                        ]}
                        onPress={() => handleSelectFee(fee)}
                      >
                        {isSelected && (
                          <View style={styles.feeChipCheck}>
                            <Ionicons name="checkmark" size={10} color="#fff" />
                          </View>
                        )}
                        <Text
                          style={[
                            styles.feeChipText,
                            isSelected && styles.feeChipTextActive,
                            chipDisabled && styles.feeChipTextDisabled,
                          ]}
                          numberOfLines={1}
                        >
                          {fee.fee_type}
                        </Text>
                        <Text
                          style={[
                            styles.feeChipBalance,
                            isSelected && styles.feeChipBalanceActive,
                            chipDisabled && styles.feeChipBalanceDisabled,
                            isFullyPaid && !chipDisabled && styles.feeChipPaid,
                          ]}
                        >
                          {isFullyPaid ? 'Fully paid' : `${fmtINR(remaining)} due`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* Step 3: Form */}
          {selectedFee && (
            <Animated.View entering={FadeInDown.duration(280)} style={styles.formContainer}>
              <View style={[styles.stepRow, { marginTop: 4 }]}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>3</Text>
                </View>
                <Text style={styles.stepLabel}>Amount & reason</Text>
              </View>

              {/* Balance mini grid */}
              <View style={styles.balanceGrid}>
                <View style={styles.balanceCell}>
                  <Text style={styles.balanceCellLabel}>Assigned</Text>
                  <Text style={styles.balanceCellVal}>
                    {fmtINR(selectedFee.amount_due)}
                  </Text>
                </View>
                <View style={styles.balanceCell}>
                  <Text style={styles.balanceCellLabel}>Paid</Text>
                  <Text style={[styles.balanceCellVal, { color: '#059669' }]}>
                    {fmtINR(selectedFee.amount_paid)}
                  </Text>
                </View>
                <View style={styles.balanceCell}>
                  <Text style={styles.balanceCellLabel}>Waiver</Text>
                  <Text style={[styles.balanceCellVal, { color: ADMIN_THEME.colors.primary }]}>
                    {fmtINR(selectedFee.discount)}
                  </Text>
                </View>
                <View style={[styles.balanceCell, styles.balanceCellHighlight]}>
                  <Text style={styles.balanceCellLabel}>Remaining</Text>
                  <Text style={[styles.balanceCellVal, { color: '#DC2626' }]}>
                    {fmtINR(remainingBalance)}
                  </Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Adjustment type</Text>
              <View style={styles.typeSelector}>
                <Pressable
                  style={({ pressed }) => [
                    styles.typeOption,
                    adjustmentType === 'waive' && styles.typeOptionActive,
                    pressed && { transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => setAdjustmentType('waive')}
                >
                  <View
                    style={[
                      styles.typeIconWrap,
                      adjustmentType === 'waive' && styles.typeIconWrapActive,
                    ]}
                  >
                    <Ionicons
                      name="arrow-down-circle"
                      size={18}
                      color={adjustmentType === 'waive' ? '#059669' : '#94A3B8'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.typeOptionTitle,
                      adjustmentType === 'waive' && styles.typeOptionTitleActive,
                    ]}
                  >
                    Waive
                  </Text>
                  <Text style={styles.typeOptionDesc}>Reduce what they owe</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.typeOption,
                    adjustmentType === 'add' && styles.typeOptionActiveAdd,
                    pressed && { transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => setAdjustmentType('add')}
                >
                  <View
                    style={[
                      styles.typeIconWrap,
                      adjustmentType === 'add' && styles.typeIconWrapActiveAdd,
                    ]}
                  >
                    <Ionicons
                      name="arrow-up-circle"
                      size={18}
                      color={adjustmentType === 'add' ? '#D97706' : '#94A3B8'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.typeOptionTitle,
                      adjustmentType === 'add' && styles.typeOptionTitleActiveAdd,
                    ]}
                  >
                    Add
                  </Text>
                  <Text style={styles.typeOptionDesc}>Increase what they owe</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>
                {adjustmentType === 'add' ? 'Amount to add' : 'Amount to waive'}
                <Text style={styles.req}> *</Text>
              </Text>
              <View style={styles.amountInputWrap}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <AppTextInput
                  value={adjustAmount}
                  onChangeText={setAdjustAmount}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#94A3B8"
                  style={[ds.inputInChrome, styles.amountInput]}
                />
                {adjustmentType === 'waive' && remainingBalance > 0 && (
                  <Pressable
                    onPress={() => setAdjustAmount(String(remainingBalance))}
                    style={({ pressed }) => [
                      styles.maxBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                    hitSlop={6}
                  >
                    <Text style={styles.maxBtnText}>MAX</Text>
                  </Pressable>
                )}
              </View>

              <Text style={styles.fieldLabel}>
                Reason<Text style={styles.req}> *</Text>
              </Text>
              <AppTextInput
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Sibling concession, fee correction…"
                placeholderTextColor="#94A3B8"
                style={styles.formInput}
                multiline
              />

              <PremiumButton
                title={
                  adjustmentType === 'add' ? 'Apply Fee Addition' : 'Apply Fee Waiver'
                }
                onPress={handleSubmit}
                loading={submitting}
                disabled={!canSubmit}
                colors={
                  adjustmentType === 'add'
                    ? ['#D97706', '#F59E0B']
                    : ['#4F46E5', '#6366F1']
                }
                icon={
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#fff"
                    style={{ marginLeft: 8 }}
                  />
                }
                style={{ marginTop: 8 }}
              />
            </Animated.View>
          )}
        </Animated.View>

        {/* History */}
        <Animated.View
          entering={FadeInDown.delay(160).duration(320)}
          style={[styles.card, clayCard(isDark, 'md'), { marginTop: 18 }]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBadge}>
              <Ionicons name="time-outline" size={16} color={ADMIN_THEME.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>History</Text>
              <Text style={styles.cardSubtitle}>
                {summary.total === 0
                  ? 'No adjustments yet'
                  : `${summary.total} adjustment${summary.total === 1 ? '' : 's'} logged`}
              </Text>
            </View>
          </View>

          {history.length > 0 && (
            <View style={styles.filterRow}>
              {(
                [
                  { key: 'all' as const, label: 'All', count: summary.total },
                  { key: 'waive' as const, label: 'Waived', count: summary.waiveCount },
                  { key: 'add' as const, label: 'Added', count: summary.addCount },
                ] as const
              ).map((tab) => {
                const active = historyFilter === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    style={({ pressed }) => [
                      styles.filterChip,
                      active && styles.filterChipActive,
                      pressed && { opacity: 0.9 },
                    ]}
                    onPress={() => setHistoryFilter(tab.key)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        active && styles.filterChipTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                    <View
                      style={[
                        styles.filterCount,
                        active && styles.filterCountActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterCountText,
                          active && styles.filterCountTextActive,
                        ]}
                      >
                        {tab.count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {loadingHistory ? (
            <View style={styles.inlineLoader}>
              <LogoLoader size={36} color={ADMIN_THEME.colors.primary} />
              <Text style={styles.hintText}>Loading history…</Text>
            </View>
          ) : filteredHistory.length === 0 ? (
            <Animated.View entering={FadeIn.duration(320)} style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <LinearGradient
                  colors={isDark ? ['#1E293B', '#334155'] : ['#EEF2FF', '#E0E7FF']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Ionicons name="receipt-outline" size={28} color="#818CF8" />
              </View>
              <Text style={styles.emptyTitle}>
                {historyFilter === 'all'
                  ? 'No adjustments yet'
                  : `No ${historyFilter === 'waive' ? 'waivers' : 'additions'} found`}
              </Text>
              <Text style={styles.emptySubtitle}>
                {historyFilter === 'all'
                  ? 'When you waive or add a fee, it will appear here with the reason and amount.'
                  : 'Try switching the filter or apply a new adjustment above.'}
              </Text>
            </Animated.View>
          ) : (
            <FlatList
              data={filteredHistory}
              renderItem={renderHistoryItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            />
          )}
        </Animated.View>

        <View style={{ height: 48 }} />
      </KeyboardAwareScreen>
    </View>
  );
}

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    scrollContent: {
      padding: 16,
      paddingTop: 12,
    },

    /* Intro */
    introCard: {
      borderRadius: 22,
      padding: 18,
      marginBottom: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.12)',
    },
    introOrb: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.55)',
      top: -40,
      right: -20,
    },
    introRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    introIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#6366F1',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        },
        android: { elevation: 3 },
        default: {},
      }),
    },
    introTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: isDark ? '#EEF2FF' : '#312E81',
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    introDesc: {
      fontSize: 13,
      lineHeight: 18,
      color: isDark ? '#A5B4FC' : '#6366F1',
      fontWeight: '500',
    },

    /* Summary */
    summaryStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
      gap: 12,
      flexWrap: 'wrap',
    },
    summaryHero: {
      minWidth: 64,
    },
    summaryHeroLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: '#94A3B8',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    summaryHeroAmount: {
      fontSize: 22,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#0F172A',
      letterSpacing: -0.5,
      marginTop: 2,
    },
    summaryDivider: {
      width: 1,
      height: 36,
      backgroundColor: isDark ? '#334155' : '#E2E8F0',
    },
    summaryChip: {
      flex: 1,
      minWidth: 90,
    },
    summaryDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginBottom: 4,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: '#94A3B8',
    },
    summaryAmount: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? '#E2E8F0' : '#1E293B',
      marginTop: 2,
    },

    /* Cards */
    card: {
      padding: 20,
      overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 18,
    },
    cardIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#EEF2FF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#0F172A',
      letterSpacing: -0.3,
    },
    cardSubtitle: {
      fontSize: 12,
      color: '#94A3B8',
      marginTop: 2,
      fontWeight: '500',
    },

    /* Steps */
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    stepBadge: {
      width: 22,
      height: 22,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(99,102,241,0.25)' : '#EEF2FF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: ADMIN_THEME.colors.primary,
    },
    stepLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#CBD5E1' : '#475569',
    },

    /* Search */
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#121824' : '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: isDark ? '#334155' : '#E2E8F0',
      paddingHorizontal: 12,
      minHeight: 48,
      gap: 8,
    },
    searchContainerFocused: {
      borderColor: ADMIN_THEME.colors.primary,
      ...Platform.select({
        ios: {
          shadowColor: '#6366F1',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
        web: {
          boxShadow: '0 0 0 3px rgba(99,102,241,0.18)',
        } as any,
        default: {},
      }),
    },
    searchIcon: {
      marginTop: 1,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: isDark ? '#F1F5F9' : '#0F172A',
      fontWeight: '500',
    },
    clearSearchBtn: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#94A3B8',
      alignItems: 'center',
      justifyContent: 'center',
    },
    hintText: {
      fontSize: 12,
      color: '#94A3B8',
      marginTop: 8,
      fontWeight: '500',
    },

    /* Dropdown */
    dropdown: {
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderRadius: 14,
      marginTop: 8,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
        },
        android: { elevation: 4 },
        default: {},
      }),
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#334155' : '#F1F5F9',
    },
    dropdownItemLast: {
      borderBottomWidth: 0,
    },
    dropdownItemPressed: {
      backgroundColor: isDark ? '#334155' : '#F8FAFC',
    },
    dropdownAvatar: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#EEF2FF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dropdownAvatarText: {
      fontSize: 14,
      fontWeight: '800',
      color: ADMIN_THEME.colors.primary,
    },
    dropdownName: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : '#0F172A',
    },
    dropdownMeta: {
      fontSize: 12,
      color: '#94A3B8',
      marginTop: 1,
      fontWeight: '500',
    },

    /* Student banner */
    studentBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      padding: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.18)',
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(99,102,241,0.3)' : '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '800',
      color: ADMIN_THEME.colors.primary,
    },
    studentName: {
      fontSize: 15,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#0F172A',
      letterSpacing: -0.2,
    },
    studentDetails: {
      fontSize: 12,
      color: '#64748B',
      marginTop: 2,
      fontWeight: '500',
    },
    clearStudentBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* Fee chips */
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    feeChip: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: isDark ? '#334155' : '#E2E8F0',
      backgroundColor: isDark ? '#121824' : '#FFFFFF',
      minWidth: 118,
      position: 'relative',
    },
    feeChipActive: {
      borderColor: ADMIN_THEME.colors.primary,
      backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF',
    },
    feeChipDisabled: {
      opacity: 0.45,
      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
      borderColor: 'transparent',
    },
    feeChipCheck: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: ADMIN_THEME.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    feeChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : '#0F172A',
      paddingRight: 18,
    },
    feeChipTextActive: {
      color: ADMIN_THEME.colors.primary,
    },
    feeChipTextDisabled: {
      color: '#94A3B8',
      textDecorationLine: 'line-through',
    },
    feeChipBalance: {
      fontSize: 11,
      color: '#64748B',
      marginTop: 4,
      fontWeight: '600',
    },
    feeChipBalanceActive: {
      color: ADMIN_THEME.colors.primary,
    },
    feeChipBalanceDisabled: {
      color: '#94A3B8',
    },
    feeChipPaid: {
      color: '#059669',
    },

    /* Form */
    formContainer: {
      marginTop: 18,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : 'rgba(226,232,240,0.9)',
      paddingTop: 16,
    },
    balanceGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    balanceCell: {
      flexGrow: 1,
      flexBasis: '45%',
      backgroundColor: isDark ? '#121824' : '#FFFFFF',
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
    },
    balanceCellHighlight: {
      borderColor: isDark ? 'rgba(239,68,68,0.35)' : '#FECACA',
      backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2',
    },
    balanceCellLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: '#94A3B8',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginBottom: 4,
    },
    balanceCellVal: {
      fontSize: 15,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#0F172A',
      letterSpacing: -0.3,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#94A3B8' : '#475569',
      marginBottom: 8,
      marginTop: 4,
    },
    req: {
      color: '#EF4444',
    },
    typeSelector: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    },
    typeOption: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: isDark ? '#334155' : '#E2E8F0',
      borderRadius: 16,
      padding: 14,
      backgroundColor: isDark ? '#121824' : '#FFFFFF',
      alignItems: 'flex-start',
    },
    typeOptionActive: {
      borderColor: '#22C55E',
      backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : '#F0FDF4',
    },
    typeOptionActiveAdd: {
      borderColor: '#F59E0B',
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FFFBEB',
    },
    typeIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    typeIconWrapActive: {
      backgroundColor: isDark ? 'rgba(34,197,94,0.2)' : '#DCFCE7',
    },
    typeIconWrapActiveAdd: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.2)' : '#FEF3C7',
    },
    typeOptionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#0F172A',
    },
    typeOptionTitleActive: {
      color: '#166534',
    },
    typeOptionTitleActiveAdd: {
      color: '#C2410C',
    },
    typeOptionDesc: {
      fontSize: 11,
      color: '#64748B',
      marginTop: 3,
      fontWeight: '500',
      lineHeight: 15,
    },
    amountInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#121824' : '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: isDark ? '#334155' : '#E2E8F0',
      paddingHorizontal: 14,
      minHeight: 52,
      marginBottom: 12,
      gap: 6,
    },
    currencyPrefix: {
      fontSize: 18,
      fontWeight: '800',
      color: ADMIN_THEME.colors.primary,
    },
    amountInput: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : '#0F172A',
      letterSpacing: -0.3,
    },
    maxBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#EEF2FF',
    },
    maxBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: ADMIN_THEME.colors.primary,
      letterSpacing: 0.4,
    },
    formInput: {
      backgroundColor: isDark ? '#121824' : '#FFFFFF',
      borderWidth: 1.5,
      borderColor: isDark ? '#334155' : '#E2E8F0',
      borderRadius: 14,
      padding: 14,
      fontSize: 14,
      color: isDark ? '#F1F5F9' : '#0F172A',
      marginBottom: 12,
      minHeight: 72,
      textAlignVertical: 'top',
      fontWeight: '500',
    },

    /* Filters */
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: isDark ? '#121824' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
    },
    filterChipActive: {
      backgroundColor: isDark ? 'rgba(99,102,241,0.25)' : '#EEF2FF',
      borderColor: ADMIN_THEME.colors.primary,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#64748B',
    },
    filterChipTextActive: {
      color: ADMIN_THEME.colors.primary,
    },
    filterCount: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: isDark ? '#334155' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterCountActive: {
      backgroundColor: ADMIN_THEME.colors.primary,
    },
    filterCountText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#64748B',
    },
    filterCountTextActive: {
      color: '#FFFFFF',
    },

    /* History cards */
    historyCard: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#121824' : '#FFFFFF',
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
    },
    historyAccent: {
      width: 4,
    },
    historyBody: {
      flex: 1,
      padding: 14,
    },
    historyTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    historyIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    historyTitleCol: {
      flex: 1,
      minWidth: 0,
    },
    historyStudent: {
      fontSize: 14,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#0F172A',
      letterSpacing: -0.2,
    },
    historyMeta: {
      fontSize: 12,
      color: '#64748B',
      marginTop: 2,
      fontWeight: '500',
    },
    historyAmountCol: {
      alignItems: 'flex-end',
      gap: 4,
    },
    historyAmount: {
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    historyAmountWaive: {
      color: '#059669',
    },
    historyAmountAdd: {
      color: '#D97706',
    },
    historyBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    historyBadgeWaive: {
      backgroundColor: '#DCFCE7',
    },
    historyBadgeAdd: {
      backgroundColor: '#FFEDD5',
    },
    historyBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#166534',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    historyBadgeTextAdd: {
      color: '#C2410C',
    },
    historyReasonRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#1E293B' : '#F1F5F9',
    },
    historyReason: {
      flex: 1,
      fontSize: 12,
      color: isDark ? '#94A3B8' : '#64748B',
      fontWeight: '500',
      lineHeight: 17,
    },
    historyFooter: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 10,
    },
    historyFooterItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    historyFooterText: {
      fontSize: 11,
      color: '#94A3B8',
      fontWeight: '500',
    },

    /* Empty / loaders */
    inlineLoader: {
      alignItems: 'center',
      paddingVertical: 20,
      gap: 8,
    },
    inlineEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 12,
      backgroundColor: isDark ? '#121824' : '#F8FAFC',
      borderRadius: 12,
      marginTop: 4,
    },
    inlineEmptyText: {
      fontSize: 13,
      color: '#94A3B8',
      fontWeight: '500',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 36,
      paddingHorizontal: 20,
    },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#0F172A',
      marginBottom: 6,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 13,
      color: '#94A3B8',
      textAlign: 'center',
      lineHeight: 19,
      fontWeight: '500',
      maxWidth: 280,
    },
  });
