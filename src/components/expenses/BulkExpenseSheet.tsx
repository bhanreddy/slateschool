import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';
import { Ionicons } from '@expo/vector-icons';
import AppDatePicker from '@/src/components/AppDatePicker';
import { alertCompat } from '@/src/utils/crossPlatformAlert';
import LogoLoader from '@/src/components/LogoLoader';
import { EXPENSE_CATEGORIES, todayDateInput } from './expenseConstants';
import { CreateExpenseRequest } from '@/src/types/expenses';

export type BulkExpenseRow = {
  id: string;
  expense_date: string;
  title: string;
  category: string;
  amount: string;
  description: string;
};

let rowCounter = 0;
function newRow(): BulkExpenseRow {
  rowCounter += 1;
  return {
    id: `row-${rowCounter}`,
    expense_date: todayDateInput(),
    title: '',
    category: EXPENSE_CATEGORIES[0],
    amount: '',
    description: '',
  };
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (items: CreateExpenseRequest[]) => Promise<{ ok: boolean; count?: number; errors?: { row: number; error: string }[] }>;
  isDark?: boolean;
};

const COL = {
  date: 108,
  title: 140,
  category: 110,
  amount: 88,
  description: 160,
  action: 36,
} as const;

const TABLE_MIN_WIDTH = COL.date + COL.title + COL.category + COL.amount + COL.description + COL.action + 24;

export default function BulkExpenseSheet({ visible, onClose, onSubmit, isDark = false }: Props) {
  const [rows, setRows] = useState<BulkExpenseRow[]>(() => [newRow(), newRow(), newRow()]);
  const [submitting, setSubmitting] = useState(false);

  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const cellBg = isDark ? '#1E293B' : '#F8FAFC';
  const textColor = isDark ? '#E2E8F0' : '#0F172A';

  const reset = useCallback(() => {
    setRows([newRow(), newRow(), newRow()]);
  }, []);

  const updateRow = (id: string, patch: Partial<BulkExpenseRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const validPayload = useMemo(() => {
    const items: CreateExpenseRequest[] = [];
    const rowErrors: { row: number; error: string }[] = [];

    rows.forEach((row, index) => {
      const hasAny = row.title.trim() || row.amount.trim() || row.description.trim();
      if (!hasAny) return;

      if (!row.amount.trim()) {
        rowErrors.push({ row: index + 1, error: 'Amount is required' });
        return;
      }
      const amount = parseFloat(row.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        rowErrors.push({ row: index + 1, error: 'Invalid amount' });
        return;
      }
      if (!row.title.trim()) {
        rowErrors.push({ row: index + 1, error: 'Title is required' });
        return;
      }

      items.push({
        title: row.title.trim(),
        category: row.category,
        amount,
        expense_date: row.expense_date,
        description: row.description.trim() || undefined,
      });
    });

    return { items, rowErrors };
  }, [rows]);

  const handleSubmit = async () => {
    const { items, rowErrors } = validPayload;
    if (items.length === 0) {
      alertCompat('Required', rowErrors.length
        ? `Fix row errors:\n${rowErrors.map((e) => `Row ${e.row}: ${e.error}`).join('\n')}`
        : 'Add at least one expense row with title and amount.');
      return;
    }
    if (rowErrors.length) {
      alertCompat('Validation', rowErrors.map((e) => `Row ${e.row}: ${e.error}`).join('\n'));
      return;
    }

    setSubmitting(true);
    const result = await onSubmit(items);
    setSubmitting(false);

    if (result.ok) {
      const msg = result.errors?.length
        ? `${result.count ?? items.length} saved. ${result.errors.length} row(s) skipped.`
        : `${result.count ?? items.length} expense(s) saved successfully.`;
      alertCompat('Success', msg);
      reset();
      onClose();
    } else {
      alertCompat('Error', 'Failed to save expenses. Please try again.');
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { backgroundColor: isDark ? '#111827' : '#fff' }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: textColor }]}>Bulk Expense Entry</Text>
                <Text style={[styles.subtitle, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                  Add multiple rows like a spreadsheet
                </Text>
              </View>
              <Pressable style={[styles.closeBtn, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]} onPress={handleClose}>
                <Ionicons name="close" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{ minWidth: TABLE_MIN_WIDTH }}>
                <View style={[styles.headerRow, { borderBottomColor: border }]}>
                  {[
                    { label: 'Date', width: COL.date },
                    { label: 'Title', width: COL.title },
                    { label: 'Category', width: COL.category },
                    { label: 'Amount', width: COL.amount },
                    { label: 'Description', width: COL.description },
                    { label: '', width: COL.action },
                  ].map((col) => (
                    <Text key={col.label || 'action'} style={[styles.headerCell, { width: col.width, color: isDark ? '#64748B' : '#94A3B8' }]}>
                      {col.label}
                    </Text>
                  ))}
                </View>

                <ScrollView style={styles.bodyScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {rows.map((row) => (
                    <View key={row.id} style={[styles.dataRow, { borderBottomColor: border }]}>
                      <View style={{ width: COL.date }}>
                        <AppDatePicker
                          value={row.expense_date}
                          onChange={(v) => updateRow(row.id, { expense_date: v })}
                          variant="compact"
                          isDark={isDark}
                          containerStyle={{ marginBottom: 0 }}
                        />
                      </View>
                      <AppTextInput
                        style={[styles.cellInput, ds.inputInChrome, { width: COL.title, backgroundColor: cellBg, borderColor: border, color: textColor }]}
                        placeholder="Title"
                        placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                        value={row.title}
                        onChangeText={(v) => updateRow(row.id, { title: v })}
                      />
                      <Pressable
                        style={[styles.categoryCell, { width: COL.category, backgroundColor: cellBg, borderColor: border }]}
                        onPress={() => {
                          const idx = EXPENSE_CATEGORIES.indexOf(row.category as typeof EXPENSE_CATEGORIES[number]);
                          const next = EXPENSE_CATEGORIES[(idx + 1) % EXPENSE_CATEGORIES.length];
                          updateRow(row.id, { category: next });
                        }}
                      >
                        <Text style={[styles.categoryText, { color: textColor }]} numberOfLines={1}>{row.category}</Text>
                        <Ionicons name="chevron-down" size={12} color={isDark ? '#64748B' : '#94A3B8'} />
                      </Pressable>
                      <AppTextInput
                        style={[styles.cellInput, ds.inputInChrome, { width: COL.amount, backgroundColor: cellBg, borderColor: border, color: textColor }]}
                        placeholder="0"
                        placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                        keyboardType="numeric"
                        value={row.amount}
                        onChangeText={(v) => updateRow(row.id, { amount: v })}
                      />
                      <AppTextInput
                        style={[styles.cellInput, ds.inputInChrome, { width: COL.description, backgroundColor: cellBg, borderColor: border, color: textColor }]}
                        placeholder="Notes"
                        placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                        value={row.description}
                        onChangeText={(v) => updateRow(row.id, { description: v })}
                      />
                      <Pressable style={[styles.deleteBtn, { width: COL.action }]} onPress={() => removeRow(row.id)}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>

            <Pressable style={[styles.addRowBtn, { borderColor: border }]} onPress={addRow}>
              <Ionicons name="add-circle-outline" size={18} color="#6366F1" />
              <Text style={styles.addRowText}>Add row</Text>
            </Pressable>

            <Pressable
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <LogoLoader color="#fff" size={22} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                  <Text style={styles.submitText}>Save all rows</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheetWrap: { maxHeight: '92%' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottomWidth: 1 },
  headerCell: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  bodyScroll: { maxHeight: 280 },
  dataRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderBottomWidth: 1 },
  cellInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '500',
  },
  categoryCell: {
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  categoryText: { flex: 1, fontSize: 12, fontWeight: '600' },
  deleteBtn: { alignItems: 'center', justifyContent: 'center', height: 40 },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  addRowText: { fontSize: 13, fontWeight: '700', color: '#6366F1' },
  submitBtn: {
    marginTop: 12,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
