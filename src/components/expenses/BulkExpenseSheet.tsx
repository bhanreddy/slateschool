import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const CATEGORY_TINT: Record<string, string> = {
  Education: '#4F46E5',
  Maintenance: '#D97706',
  Sports: '#059669',
  Utility: '#2563EB',
  Events: '#DB2777',
  Salary: '#7C3AED',
  Other: '#64748B',
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
  onSubmit: (items: CreateExpenseRequest[]) => Promise<{
    ok: boolean;
    count?: number;
    errors?: { row: number; error: string }[];
  }>;
  isDark?: boolean;
};

const WIDE_BREAKPOINT = 720;

/** Compact select for table rows — one open menu at a time via parent. */
function CategorySelect({
  value,
  onChange,
  isDark,
  open,
  onOpenChange,
}: {
  value: string;
  onChange: (v: string) => void;
  isDark: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)';
  const tint = CATEGORY_TINT[value] ?? '#64748B';

  return (
    <View style={{ zIndex: open ? 40 : 1 }}>
      <Pressable
        onPress={() => onOpenChange(!open)}
        style={({ pressed }) => [
          styles.selectTrigger,
          {
            backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
            borderColor: open ? '#4F46E5' : border,
          },
          pressed && { opacity: 0.9 },
        ]}
      >
        <View style={[styles.selectDot, { backgroundColor: tint }]} />
        <Text
          style={[styles.selectLabel, { color: isDark ? '#E2E8F0' : '#0F172A' }]}
          numberOfLines={1}
        >
          {value}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={isDark ? '#94A3B8' : '#64748B'}
        />
      </Pressable>

      {open ? (
        <View
          style={[
            styles.selectMenu,
            {
              backgroundColor: isDark ? '#1E293B' : '#fff',
              borderColor: border,
              ...(Platform.OS === 'web'
                ? ({ boxShadow: '0 12px 28px rgba(15,23,42,0.14)' } as any)
                : {
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.14,
                    shadowRadius: 16,
                    elevation: 8,
                  }),
            },
          ]}
        >
          {EXPENSE_CATEGORIES.map((cat) => {
            const active = value === cat;
            const c = CATEGORY_TINT[cat] ?? '#64748B';
            return (
              <Pressable
                key={cat}
                onPress={() => {
                  onChange(cat);
                  onOpenChange(false);
                }}
                style={({ pressed }) => [
                  styles.selectOption,
                  active && { backgroundColor: isDark ? 'rgba(79,70,229,0.18)' : '#EEF2FF' },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={[styles.selectDot, { backgroundColor: c }]} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: active ? '700' : '500',
                    color: active ? '#4F46E5' : (isDark ? '#E2E8F0' : '#334155'),
                  }}
                >
                  {cat}
                </Text>
                {active ? <Ionicons name="checkmark" size={14} color="#4F46E5" /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** Chip row for mobile cards. */
function CategoryChips({
  value,
  onChange,
  isDark,
}: {
  value: string;
  onChange: (v: string) => void;
  isDark: boolean;
}) {
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)';
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
    >
      {EXPENSE_CATEGORIES.map((cat) => {
        const active = value === cat;
        const tint = CATEGORY_TINT[cat] ?? '#64748B';
        return (
          <Pressable
            key={cat}
            onPress={() => onChange(cat)}
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: active ? tint : border,
                backgroundColor: active
                  ? `${tint}18`
                  : (isDark ? '#1E293B' : '#F8FAFC'),
              },
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
          >
            <View style={[styles.selectDot, { backgroundColor: tint, width: 6, height: 6 }]} />
            <Text
              style={{
                fontSize: 12,
                fontWeight: active ? '800' : '600',
                color: active ? tint : (isDark ? '#94A3B8' : '#64748B'),
              }}
            >
              {cat}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function BulkExpenseSheet({
  visible,
  onClose,
  onSubmit,
  isDark = false,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= WIDE_BREAKPOINT;
  const isWeb = Platform.OS === 'web';

  const [rows, setRows] = useState<BulkExpenseRow[]>(() => [newRow(), newRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [openCatId, setOpenCatId] = useState<string | null>(null);

  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const cellBg = isDark ? '#1E293B' : '#F8FAFC';
  const textColor = isDark ? '#E2E8F0' : '#0F172A';
  const muted = isDark ? '#64748B' : '#94A3B8';
  const sheetBg = isDark ? '#111827' : '#fff';
  const surfaceAlt = isDark ? '#0B1220' : '#F8FAFC';

  useEffect(() => {
    if (!visible) setOpenCatId(null);
  }, [visible]);

  const filledCount = useMemo(
    () => rows.filter((r) => r.title.trim() || r.amount.trim()).length,
    [rows]
  );

  const reset = useCallback(() => {
    setRows([newRow(), newRow()]);
    setOpenCatId(null);
  }, []);

  const updateRow = (id: string, patch: Partial<BulkExpenseRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
    if (openCatId === id) setOpenCatId(null);
  };

  const addRow = () => {
    setOpenCatId(null);
    setRows((prev) => [...prev, newRow()]);
  };

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
      alertCompat(
        'Required',
        rowErrors.length
          ? `Fix row errors:\n${rowErrors.map((e) => `Row ${e.row}: ${e.error}`).join('\n')}`
          : 'Add at least one expense with title and amount.'
      );
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

  const inputStyle = [
    styles.input,
    ds.inputInChrome,
    { backgroundColor: cellBg, borderColor: border, color: textColor },
  ];

  const renderCardRow = (row: BulkExpenseRow, index: number) => (
    <View
      key={row.id}
      style={[styles.card, { backgroundColor: isDark ? '#0F172A' : '#fff', borderColor: border }]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.cardBadge, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF' }]}>
          <Text style={[styles.cardBadgeText, { color: '#4F46E5' }]}>Expense {index + 1}</Text>
        </View>
        <Pressable
          onPress={() => removeRow(row.id)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.deleteHit,
            { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2' },
            pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] },
          ]}
          accessibilityLabel={`Remove expense ${index + 1}`}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </Pressable>
      </View>

      <Text style={[styles.fieldLabel, { color: muted }]}>Date</Text>
      <AppDatePicker
        value={row.expense_date}
        onChange={(v) => updateRow(row.id, { expense_date: v })}
        variant="compact"
        isDark={isDark}
        containerStyle={{ marginBottom: 10 }}
      />

      <Text style={[styles.fieldLabel, { color: muted }]}>Title *</Text>
      <AppTextInput
        style={inputStyle}
        placeholder="e.g. Lab equipment"
        placeholderTextColor={muted}
        value={row.title}
        onChangeText={(v) => updateRow(row.id, { title: v })}
      />

      <Text style={[styles.fieldLabel, { color: muted }]}>Amount *</Text>
      <View style={[styles.amountWrap, { backgroundColor: cellBg, borderColor: border }]}>
        <View style={[styles.rupeeBox, { backgroundColor: isDark ? '#0F172A' : '#EEF2FF' }]}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#4F46E5' }}>₹</Text>
        </View>
        <AppTextInput
          style={[ds.inputInChrome, styles.amountInput, { color: textColor }]}
          placeholder="0.00"
          placeholderTextColor={muted}
          keyboardType="numeric"
          value={row.amount}
          onChangeText={(v) => updateRow(row.id, { amount: v })}
        />
      </View>

      <Text style={[styles.fieldLabel, { color: muted }]}>Category</Text>
      <View style={{ marginBottom: 10 }}>
        <CategoryChips
          value={row.category}
          onChange={(v) => updateRow(row.id, { category: v })}
          isDark={isDark}
        />
      </View>

      <Text style={[styles.fieldLabel, { color: muted }]}>Notes</Text>
      <AppTextInput
        style={inputStyle}
        placeholder="Optional"
        placeholderTextColor={muted}
        value={row.description}
        onChangeText={(v) => updateRow(row.id, { description: v })}
      />
    </View>
  );

  const renderTable = () => (
    <View style={[styles.table, { borderColor: border, backgroundColor: sheetBg }]}>
      <View style={[styles.tableHeader, { borderBottomColor: border, backgroundColor: surfaceAlt }]}>
        <Text style={[styles.th, styles.colIdx, { color: muted }]}>#</Text>
        <Text style={[styles.th, styles.colDate, { color: muted }]}>Date</Text>
        <Text style={[styles.th, styles.colTitle, { color: muted }]}>Title</Text>
        <Text style={[styles.th, styles.colCat, { color: muted }]}>Category</Text>
        <Text style={[styles.th, styles.colAmt, { color: muted }]}>Amount</Text>
        <Text style={[styles.th, styles.colNotes, { color: muted }]}>Notes</Text>
        <View style={styles.colAction} />
      </View>

      {rows.map((row, index) => {
        const zebra = index % 2 === 1;
        return (
          <View
            key={row.id}
            style={[
              styles.tableRow,
              {
                borderBottomColor: border,
                backgroundColor: zebra ? surfaceAlt : 'transparent',
                zIndex: openCatId === row.id ? 30 : 1,
              },
            ]}
          >
            <Text style={[styles.rowIdx, styles.colIdx, { color: muted }]}>{index + 1}</Text>
            <View style={styles.colDate}>
              <AppDatePicker
                value={row.expense_date}
                onChange={(v) => updateRow(row.id, { expense_date: v })}
                variant="compact"
                isDark={isDark}
                containerStyle={{ marginBottom: 0 }}
              />
            </View>
            <AppTextInput
              style={[inputStyle, styles.colTitle, styles.cellInput]}
              placeholder="What was purchased?"
              placeholderTextColor={muted}
              value={row.title}
              onChangeText={(v) => updateRow(row.id, { title: v })}
            />
            <View style={styles.colCat}>
              <CategorySelect
                value={row.category}
                onChange={(v) => updateRow(row.id, { category: v })}
                isDark={isDark}
                open={openCatId === row.id}
                onOpenChange={(open) => setOpenCatId(open ? row.id : null)}
              />
            </View>
            <View style={[styles.amountWrap, styles.colAmt, styles.cellAmount, { backgroundColor: cellBg, borderColor: border }]}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: muted, marginRight: 4 }}>₹</Text>
              <AppTextInput
                style={[ds.inputInChrome, styles.amountInput, { color: textColor }]}
                placeholder="0.00"
                placeholderTextColor={muted}
                keyboardType="numeric"
                value={row.amount}
                onChangeText={(v) => updateRow(row.id, { amount: v })}
              />
            </View>
            <AppTextInput
              style={[inputStyle, styles.colNotes, styles.cellInput]}
              placeholder="Optional"
              placeholderTextColor={muted}
              value={row.description}
              onChangeText={(v) => updateRow(row.id, { description: v })}
            />
            <Pressable
              style={({ pressed }) => [
                styles.colAction,
                styles.deleteHit,
                { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2' },
                pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] },
              ]}
              onPress={() => removeRow(row.id)}
              accessibilityLabel={`Remove row ${index + 1}`}
            >
              <Ionicons name="trash-outline" size={15} color="#EF4444" />
            </Pressable>
          </View>
        );
      })}

      <Pressable
        style={({ pressed }) => [
          styles.inlineAdd,
          { borderTopColor: border, backgroundColor: isDark ? 'rgba(79,70,229,0.08)' : '#F5F3FF' },
          pressed && { opacity: 0.9 },
        ]}
        onPress={addRow}
      >
        <Ionicons name="add" size={16} color="#4F46E5" />
        <Text style={styles.inlineAddText}>Add another row</Text>
      </Pressable>
    </View>
  );

  const footer = (
    <View
      style={[
        styles.footer,
        {
          backgroundColor: sheetBg,
          borderTopColor: border,
          paddingBottom: Math.max(insets.bottom, isWide ? 16 : 12),
        },
      ]}
    >
      {!isWide ? (
        <Pressable
          style={({ pressed }) => [
            styles.addRowBtn,
            {
              borderColor: isDark ? 'rgba(129,140,248,0.35)' : '#C7D2FE',
              backgroundColor: isDark ? 'rgba(79,70,229,0.08)' : '#F5F3FF',
            },
            pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
          ]}
          onPress={addRow}
        >
          <Ionicons name="add-circle-outline" size={18} color="#4F46E5" />
          <Text style={styles.addRowText}>Add another expense</Text>
        </Pressable>
      ) : (
        <Text style={[styles.footerHint, { color: muted }]}>
          Blank rows are skipped · {rows.length} row{rows.length === 1 ? '' : 's'} ready
        </Text>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.submitBtn,
          submitting && { opacity: 0.7 },
          pressed && !submitting && { opacity: 0.92, transform: [{ scale: 0.985 }] },
        ]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <LogoLoader color="#fff" size={22} />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.submitText}>
              {filledCount > 0
                ? `Save ${filledCount} expense${filledCount === 1 ? '' : 's'}`
                : 'Save expenses'}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );

  const sheetMaxHeight = Math.round(height * (isWide ? 0.86 : 0.94));
  // Content-sized on web wide so we don't leave a huge empty gap; fixed height on mobile for keyboard scroll.
  const sheetHeightStyle = isWide
    ? { maxHeight: sheetMaxHeight }
    : { height: sheetMaxHeight, maxHeight: sheetMaxHeight };

  const body = (
    <>
      {isWide ? renderTable() : rows.map((row, i) => renderCardRow(row, i))}
      {!isWide && (
        <Text style={[styles.hint, { color: muted }]}>
          Leave a card blank to skip it — only filled rows are saved.
        </Text>
      )}
    </>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={handleClose}>
      <View style={[styles.overlay, isWide && styles.overlayCentered]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Dismiss" />

        <View
          style={[
            styles.sheet,
            sheetHeightStyle,
            {
              backgroundColor: sheetBg,
              maxWidth: isWide ? 980 : undefined,
              width: isWide ? Math.min(width * 0.94, 980) : '100%',
              alignSelf: 'center',
              borderRadius: isWide ? 22 : 0,
              borderTopLeftRadius: isWide ? 22 : 28,
              borderTopRightRadius: isWide ? 22 : 28,
              ...(isWide
                ? {
                    borderBottomLeftRadius: 22,
                    borderBottomRightRadius: 22,
                    ...(Platform.OS === 'web'
                      ? ({ boxShadow: '0 24px 64px rgba(15,23,42,0.22)' } as any)
                      : {
                          shadowColor: '#0F172A',
                          shadowOffset: { width: 0, height: 16 },
                          shadowOpacity: 0.2,
                          shadowRadius: 28,
                          elevation: 20,
                        }),
                  }
                : null),
            },
          ]}
        >
          {!isWide ? <View style={styles.handle} /> : null}

          <View style={[styles.header, isWide && styles.headerWide]}>
            <View style={[styles.headerIcon, { backgroundColor: isDark ? 'rgba(129,140,248,0.15)' : '#EEF2FF' }]}>
              <Ionicons name="layers-outline" size={18} color="#4F46E5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: textColor }]}>Bulk expense entry</Text>
              <Text style={[styles.subtitle, { color: muted }]}>
                {isWide
                  ? 'Spreadsheet-style entry — blank rows are ignored on save'
                  : 'One card per expense — scroll freely while typing'}
              </Text>
            </View>
            {isWide ? (
              <View style={[styles.countPill, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF' }]}>
                <Text style={styles.countPillText}>{rows.length} rows</Text>
              </View>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' },
                pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
              ]}
              onPress={handleClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
            </Pressable>
          </View>

          {!isWeb ? (
            <View style={[styles.bodyColumn, { flex: 1 }]}>
              <KeyboardAwareScrollView
                bottomOffset={140}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                style={styles.bodyScroll}
              >
                {body}
              </KeyboardAwareScrollView>
              <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
                {footer}
              </KeyboardStickyView>
            </View>
          ) : (
            <View style={[styles.bodyColumn, isWide ? { flexGrow: 0 } : { flex: 1 }]}>
              {openCatId ? (
                <Pressable
                  style={StyleSheet.absoluteFillObject}
                  onPress={() => setOpenCatId(null)}
                />
              ) : null}
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={isWide}
                contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide]}
                style={isWide ? undefined : styles.bodyScroll}
                nestedScrollEnabled
              >
                {body}
              </ScrollView>
              {footer}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.48)',
    justifyContent: 'flex-end',
  },
  overlayCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  sheet: {
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  bodyColumn: { flexShrink: 1, minHeight: 0 },
  bodyScroll: { flex: 1, minHeight: 0 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
    paddingTop: 4,
  },
  headerWide: {
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.35 },
  subtitle: { fontSize: 12, marginTop: 2, fontWeight: '500', lineHeight: 16 },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  countPillText: { fontSize: 12, fontWeight: '700', color: '#4F46E5' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  scrollContentWide: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 8,
  },
  hint: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },

  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardBadgeText: { fontSize: 12, fontWeight: '800' },
  deleteHit: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
  },
  cellInput: {
    marginBottom: 0,
    height: 40,
    fontSize: 13,
  },
  cellAmount: {
    marginBottom: 0,
    height: 40,
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  rupeeBox: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    height: 38,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },

  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  selectDot: { width: 8, height: 8, borderRadius: 4 },
  selectLabel: { flex: 1, fontSize: 12, fontWeight: '700' },
  selectMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    minWidth: 148,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  table: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'visible',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
  },
  th: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIdx: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  colIdx: { width: 28, flexShrink: 0 },
  colDate: { width: 118, flexShrink: 0 },
  colTitle: { flex: 1.5, minWidth: 140 },
  colCat: { width: 138, flexShrink: 0 },
  colAmt: { width: 108, flexShrink: 0 },
  colNotes: { flex: 1, minWidth: 100 },
  colAction: { width: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },

  inlineAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
  },
  inlineAddText: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 10,
  },
  footerHint: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderWidth: 1.5,
    borderRadius: 14,
    borderStyle: 'dashed',
  },
  addRowText: { fontSize: 14, fontWeight: '700', color: '#4F46E5' },
  submitBtn: {
    minHeight: 50,
    borderRadius: 13,
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
      },
      android: { elevation: 5 },
      web: { boxShadow: '0 8px 20px rgba(79,70,229,0.28)' } as any,
      default: {},
    }),
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
