import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  StatusBar,
  Platform,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import AdminHeader from '../../../src/components/AdminHeader';
import LogoLoader from '../../../src/components/LogoLoader';
import { useAuth } from '../../../src/hooks/useAuth';
import { useTheme } from '../../../src/hooks/useTheme';
import { useAccountsWebChrome } from '../../../src/contexts/AccountsWebChromeContext';
import { FeeService } from '../../../src/services/feeService';
import { FeeTransaction } from '../../../src/types/models';
import { SCHOOL_NAME } from '../../../src/constants/school';
import { alertCompat } from '../../../src/utils/crossPlatformAlert';
import {
  PAYMENT_MODES,
  computeCollectionTotals,
  exportCollectionCsv,
  formatAmount,
  formatClassSection,
  formatPaymentMethod,
  formatTime,
  printCollectionReport,
  type PaymentMode,
} from '../../../src/utils/collectionReport';

type PaymentFilter = 'all' | PaymentMode;

interface CollectionFilters {
  paymentMode: PaymentFilter;
  feeType: string;
  search: string;
}

const EMPTY_FILTERS: CollectionFilters = {
  paymentMode: 'all',
  feeType: 'all',
  search: '',
};

function applyCollectionFilters(rows: FeeTransaction[], filters: CollectionFilters): FeeTransaction[] {
  let list = rows;
  if (filters.paymentMode !== 'all') {
    list = list.filter((tx) => String(tx.payment_method ?? '').toLowerCase() === filters.paymentMode);
  }
  if (filters.feeType !== 'all') {
    list = list.filter((tx) => (tx.fee_type ?? '') === filters.feeType);
  }
  const q = filters.search.trim().toLowerCase();
  if (q) {
    list = list.filter((tx) => {
      const name = (tx.student_name ?? '').toLowerCase();
      const adm = (tx.admission_no ?? '').toLowerCase();
      const ref = (tx.transaction_ref ?? '').toLowerCase();
      const father = (tx.father_name ?? '').toLowerCase();
      return name.includes(q) || adm.includes(q) || ref.includes(q) || father.includes(q);
    });
  }
  return list;
}

function buildFilterNote(filters: CollectionFilters): string | undefined {
  const parts: string[] = [];
  if (filters.paymentMode !== 'all') parts.push(`Payment: ${formatPaymentMethod(filters.paymentMode)}`);
  if (filters.feeType !== 'all') parts.push(`Fee: ${filters.feeType}`);
  if (filters.search.trim()) parts.push(`Search: ${filters.search.trim()}`);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function hasActiveCollectionFilters(filters: CollectionFilters): boolean {
  return filters.paymentMode !== 'all' || filters.feeType !== 'all' || filters.search.trim().length > 0;
}

const toDateInput = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function todayRange() {
  const today = toDateInput(new Date());
  return { today, fromDate: today, toDate: `${today}T23:59:59` };
}

function formatTodayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const TransactionCard = React.memo(function TransactionCard({
  item,
  index,
  isDark,
}: {
  item: FeeTransaction;
  index: number;
  isDark: boolean;
}) {
  const cardBg = isDark ? '#1C1F2A' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  const textPri = isDark ? '#F9FAFB' : '#111827';
  const textSec = isDark ? 'rgba(255,255,255,0.45)' : '#6B7280';

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(350).springify()}>
      <View style={[cardStyles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <View style={[cardStyles.accent, { backgroundColor: '#10B981' }]} />
        <View style={cardStyles.inner}>
          <View style={cardStyles.topRow}>
            <View style={cardStyles.titleBlock}>
              <Text style={[cardStyles.student, { color: textPri }]} numberOfLines={1}>
                {item.student_name ?? '—'}
              </Text>
              {item.father_name ? (
                <Text style={[cardStyles.father, { color: textSec }]} numberOfLines={1}>
                  {item.father_name}
                </Text>
              ) : null}
            </View>
            <Text style={[cardStyles.amount, { color: '#10B981' }]}>
              {formatAmount(Number(item.amount || 0))}
            </Text>
          </View>

          <View style={cardStyles.metaRow}>
            <MetaChip label={item.fee_type ?? 'Fee'} isDark={isDark} />
            <MetaChip label={formatPaymentMethod(item.payment_method)} isDark={isDark} accent="#6366F1" />
            <MetaChip
              label={formatClassSection(item.class_name, item.section_name)}
              isDark={isDark}
            />
          </View>

          <View style={cardStyles.detailRow}>
            <DetailCell label="Adm no" value={item.admission_no ?? '—'} color={textSec} />
            <DetailCell label="Time" value={formatTime(item.paid_at)} color={textSec} />
            <DetailCell label="Ref" value={item.transaction_ref ?? '—'} color={textSec} flex />
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

function MetaChip({ label, isDark, accent }: { label: string; isDark: boolean; accent?: string }) {
  return (
    <View
      style={[
        cardStyles.chip,
        {
          backgroundColor: accent
            ? `${accent}18`
            : isDark
              ? 'rgba(255,255,255,0.06)'
              : '#F3F4F6',
        },
      ]}
    >
      <Text
        style={[
          cardStyles.chipText,
          { color: accent ?? (isDark ? 'rgba(255,255,255,0.65)' : '#475569') },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function DetailCell({
  label,
  value,
  color,
  flex,
}: {
  label: string;
  value: string;
  color: string;
  flex?: boolean;
}) {
  return (
    <View style={[cardStyles.detailCell, flex ? { flex: 1 } : undefined]}>
      <Text style={[cardStyles.detailLabel, { color }]}>{label}</Text>
      <Text style={[cardStyles.detailValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SummaryStrip({
  totals,
  isDark,
}: {
  totals: ReturnType<typeof computeCollectionTotals>;
  isDark: boolean;
}) {
  const bg = isDark ? '#1C1F2A' : '#1E293B';
  const textSec = 'rgba(255,255,255,0.45)';

  return (
    <Animated.View entering={FadeIn.duration(400)} style={[sumStyles.wrap, { backgroundColor: bg }]}>
      <View style={sumStyles.topRow}>
        <SumCell label="Transactions" value={String(totals.count)} color="#60A5FA" sec={textSec} />
        <View style={sumStyles.sep} />
        <SumCell label="Grand total" value={formatAmount(totals.grandTotal)} color="#34D399" sec={textSec} />
      </View>

      <View style={sumStyles.modeRow}>
        {PAYMENT_MODES.map((mode) => {
          const bucket = totals.byMode[mode];
          if (!bucket || bucket.count === 0) return null;
          return (
            <View key={mode} style={sumStyles.modeChip}>
              <Text style={sumStyles.modeLabel}>{formatPaymentMethod(mode)}</Text>
              <Text style={sumStyles.modeValue}>{formatAmount(bucket.total)}</Text>
              <Text style={sumStyles.modeCount}>{bucket.count} txn</Text>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

function SumCell({
  label,
  value,
  color,
  sec,
}: {
  label: string;
  value: string;
  color: string;
  sec: string;
}) {
  return (
    <View style={sumStyles.cell}>
      <Text style={[sumStyles.label, { color: sec }]}>{label}</Text>
      <Text style={[sumStyles.value, { color }]}>{value}</Text>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  isDark,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  isDark: boolean;
  count?: number;
}) {
  const border = isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';
  const idleBg = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';
  const idleText = isDark ? 'rgba(255,255,255,0.55)' : '#6B7280';

  return (
    <Pressable
      onPress={onPress}
      style={[
        filterStyles.chip,
        {
          backgroundColor: active ? '#3B82F6' : idleBg,
          borderColor: active ? '#3B82F6' : border,
        },
      ]}
    >
      <Text style={[filterStyles.chipText, { color: active ? '#fff' : idleText }]}>{label}</Text>
      {count !== undefined && count > 0 ? (
        <View style={[filterStyles.chipBadge, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : (isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB') }]}>
          <Text style={[filterStyles.chipBadgeText, { color: active ? '#fff' : idleText }]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function CollectionFiltersPanel({
  expanded,
  onToggle,
  isDark,
  filters,
  onChange,
  onClear,
  feeTypes,
  allRows,
}: {
  expanded: boolean;
  onToggle: () => void;
  isDark: boolean;
  filters: CollectionFilters;
  onChange: (patch: Partial<CollectionFilters>) => void;
  onClear: () => void;
  feeTypes: string[];
  allRows: FeeTransaction[];
}) {
  const border = isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';
  const chipText = isDark ? 'rgba(255,255,255,0.55)' : '#6B7280';
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB';
  const active = hasActiveCollectionFilters(filters);

  const modeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allRows.length };
    for (const mode of PAYMENT_MODES) {
      counts[mode] = allRows.filter((tx) => String(tx.payment_method ?? '').toLowerCase() === mode).length;
    }
    return counts;
  }, [allRows]);

  const feeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allRows.length };
    for (const ft of feeTypes) {
      counts[ft] = allRows.filter((tx) => tx.fee_type === ft).length;
    }
    return counts;
  }, [allRows, feeTypes]);

  return (
    <View style={filterStyles.wrap}>
      <Pressable style={[filterStyles.toggleRow, { borderColor: border }]} onPress={onToggle}>
        <View style={filterStyles.toggleLeft}>
          <Ionicons name="options-outline" size={16} color={active ? '#3B82F6' : chipText} />
          <Text style={[filterStyles.toggleText, { color: active ? '#3B82F6' : chipText }]}>
            Filters{active ? ' · active' : ''}
          </Text>
        </View>
        <View style={filterStyles.toggleRight}>
          {active ? (
            <Pressable onPress={(e) => { e.stopPropagation?.(); onClear(); }} hitSlop={8}>
              <Text style={filterStyles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={chipText} />
        </View>
      </Pressable>

      {expanded ? (
        <Animated.View
          entering={FadeIn.duration(250)}
          style={[filterStyles.panel, { borderColor: border, backgroundColor: isDark ? '#171923' : '#FAFAFA' }]}
        >
          <Text style={[filterStyles.label, { color: chipText }]}>SEARCH</Text>
          <AppTextInput
            style={[ds.inputInChrome, filterStyles.searchInput, { borderColor: border, backgroundColor: inputBg, color: isDark ? '#F9FAFB' : '#111827' }]}
            placeholder="Student name, admission no, ref…"
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : '#94A3B8'}
            value={filters.search}
            onChangeText={(search) => onChange({ search })}
          />

          <Text style={[filterStyles.label, { color: chipText }]}>PAYMENT MODE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={filterStyles.chipRow}>
            <FilterChip
              label="All modes"
              active={filters.paymentMode === 'all'}
              onPress={() => onChange({ paymentMode: 'all' })}
              isDark={isDark}
              count={modeCounts.all}
            />
            {PAYMENT_MODES.map((mode) => {
              const count = modeCounts[mode] ?? 0;
              if (count === 0 && filters.paymentMode !== mode) return null;
              return (
                <FilterChip
                  key={mode}
                  label={formatPaymentMethod(mode)}
                  active={filters.paymentMode === mode}
                  onPress={() => onChange({ paymentMode: mode })}
                  isDark={isDark}
                  count={count}
                />
              );
            })}
          </ScrollView>

          <Text style={[filterStyles.label, { color: chipText }]}>FEE TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={filterStyles.chipRow}>
            <FilterChip
              label="All fees"
              active={filters.feeType === 'all'}
              onPress={() => onChange({ feeType: 'all' })}
              isDark={isDark}
              count={feeTypeCounts.all}
            />
            {feeTypes.map((ft) => (
              <FilterChip
                key={ft}
                label={ft}
                active={filters.feeType === ft}
                onPress={() => onChange({ feeType: ft })}
                isDark={isDark}
                count={feeTypeCounts[ft] ?? 0}
              />
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function TodayCollectionScreen() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { shellActive } = useAccountsWebChrome();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [allRows, setAllRows] = useState<FeeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [filters, setFilters] = useState<CollectionFilters>(EMPTY_FILTERS);
  const [schoolFeeTypes, setSchoolFeeTypes] = useState<string[]>([]);

  const { today } = useMemo(() => todayRange(), []);
  const [reportDate, setReportDate] = useState(today);
  const accountantId = user?.userId || user?.id || null;
  const accountantName =
    user?.displayName || user?.display_name || user?.name || 'Accountant';

  const reportMeta = useMemo(
    () => ({
      schoolName: SCHOOL_NAME,
      accountantName,
      dateLabel: formatTodayLabel(reportDate),
      dateIso: reportDate,
      filterNote: buildFilterNote(filters),
    }),
    [accountantName, reportDate, filters],
  );

  const feeTypes = useMemo(() => {
    const set = new Set<string>(schoolFeeTypes);
    for (const row of allRows) {
      if (row.fee_type) set.add(row.fee_type);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allRows, schoolFeeTypes]);

  React.useEffect(() => {
    FeeService.getFeeTypes()
      .then((types) => {
        const names = types
          .map((t) => t.name?.trim())
          .filter((name): name is string => Boolean(name));
        setSchoolFeeTypes(Array.from(new Set(names)));
      })
      .catch(() => setSchoolFeeTypes([]));
  }, []);

  const filteredRows = useMemo(
    () => applyCollectionFilters(allRows, filters),
    [allRows, filters],
  );

  const totals = useMemo(() => computeCollectionTotals(filteredRows), [filteredRows]);
  const filtersActive = hasActiveCollectionFilters(filters);

  const loadData = useCallback(async (): Promise<FeeTransaction[]> => {
    if (!accountantId) {
      setAllRows([]);
      return [];
    }
    const result = await FeeService.getTodayCollection();
    if (result.date) {
      setReportDate(result.date);
    }
    const scoped = result.transactions.filter(
      (tx) =>
        tx.received_by_id === accountantId ||
        tx.received_by_id === result.collector_id,
    );
    setAllRows(scoped);
    return scoped;
  }, [accountantId]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        await loadData();
      } catch {
        if (active) setAllRows([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch {
      alertCompat('Error', 'Could not refresh today\'s collection.');
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const fresh = await loadData();
      const exportRows = applyCollectionFilters(fresh, filters);
      await exportCollectionCsv(exportRows, reportMeta);
    } catch {
      alertCompat('Error', 'Failed to export collection report.');
    } finally {
      setExporting(false);
    }
  }, [filters, loadData, reportMeta]);

  const handlePrint = useCallback(async () => {
    setPrinting(true);
    try {
      const fresh = await loadData();
      const exportRows = applyCollectionFilters(fresh, filters);
      await printCollectionReport(exportRows, reportMeta);
    } catch {
      alertCompat('Error', 'Failed to print collection report.');
    } finally {
      setPrinting(false);
    }
  }, [filters, loadData, reportMeta]);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const ListHeader = (
    <View>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
        <Text style={[styles.schoolName, { color: isDark ? '#F9FAFB' : '#111827' }]}>
          {SCHOOL_NAME}
        </Text>
        <Text style={[styles.heroTitle, { color: isDark ? '#818CF8' : '#4F46E5' }]}>
          Today&apos;s Collection
        </Text>
        <Text style={[styles.heroMeta, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}>
          {accountantName} · {formatTodayLabel(reportDate)}
        </Text>
        <Text style={[styles.scopeNote, { color: isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8' }]}>
          Showing only fees you collected today
        </Text>
      </Animated.View>

      <SummaryStrip totals={totals} isDark={isDark} />

      <CollectionFiltersPanel
        expanded={filtersExpanded}
        onToggle={() => setFiltersExpanded((prev) => !prev)}
        isDark={isDark}
        filters={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onClear={clearFilters}
        feeTypes={feeTypes}
        allRows={allRows}
      />

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionBtn, styles.exportBtn, exporting && styles.actionDisabled]}
          onPress={handleExport}
          disabled={exporting || loading}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Export to Excel</Text>
            </>
          )}
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.printBtn, printing && styles.actionDisabled]}
          onPress={handlePrint}
          disabled={printing || loading}
        >
          {printing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="print-outline" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Print</Text>
            </>
          )}
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>
        Transactions ({totals.count}{allRows.length !== totals.count ? ` of ${allRows.length}` : ''})
      </Text>
    </View>
  );

  const EmptyState = (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyWrap}>
      <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }]}>
        <Ionicons
          name={filtersActive ? 'filter-outline' : 'wallet-outline'}
          size={28}
          color={isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF'}
        />
      </View>
      <Text style={[styles.emptyTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>
        {filtersActive ? 'No matching transactions' : 'No collections today'}
      </Text>
      <Text style={[styles.emptySub, { color: isDark ? 'rgba(255,255,255,0.45)' : '#6B7280' }]}>
        {filtersActive
          ? 'Try clearing filters or choose a different payment mode or fee type.'
          : 'Fee payments you collect today will appear here for end-of-day auditing.'}
      </Text>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {!shellActive && (
          <AdminHeader title="Today's Collection" showBackButton />
        )}
        <LogoLoader />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {!shellActive && <AdminHeader title="Today's Collection" showBackButton />}

      <FlatList
        data={filteredRows}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <TransactionCard item={item} index={index} isDark={isDark} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
        initialNumToRender={12}
        maxToRenderPerBatch={10}
      />
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  accent: { width: 4, alignSelf: 'stretch' },
  inner: { flex: 1, padding: 14, paddingLeft: 12 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  titleBlock: { flex: 1 },
  student: { fontSize: 15, fontWeight: '700' },
  father: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '800' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, maxWidth: '100%' },
  chipText: { fontSize: 10, fontWeight: '800' },
  detailRow: { flexDirection: 'row', gap: 12 },
  detailCell: { minWidth: 72 },
  detailLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  detailValue: { fontSize: 11, fontWeight: '600' },
});

const sumStyles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  topRow: { flexDirection: 'row', marginBottom: 14 },
  sep: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 2 },
  cell: { flex: 1, alignItems: 'center' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' },
  value: { fontSize: 18, fontWeight: '800' },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeChip: {
    minWidth: '30%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modeLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' },
  modeValue: { fontSize: 14, fontWeight: '800', color: '#F9FAFB', marginTop: 2 },
  modeCount: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.45)', marginTop: 2 },
});

const filterStyles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleText: { fontSize: 13, fontWeight: '700' },
  toggleRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clearText: { fontSize: 12, fontWeight: '800', color: '#3B82F6' },
  panel: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 14,
    fontWeight: '500',
  },
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  chipBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  chipBadgeText: { fontSize: 10, fontWeight: '800' },
});

const getStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      paddingTop: 8,
    },
    hero: {
      marginBottom: 14,
      paddingTop: 4,
    },
    schoolName: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.2,
      textTransform: 'uppercase',
    },
    heroTitle: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.5,
      marginTop: 4,
    },
    heroMeta: {
      fontSize: 13,
      fontWeight: '500',
      marginTop: 4,
    },
    scopeNote: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 6,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
    },
    exportBtn: { backgroundColor: '#059669' },
    printBtn: { backgroundColor: '#4F46E5' },
    actionDisabled: { opacity: 0.65 },
    actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 10,
    },
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 48,
      paddingHorizontal: 24,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
    emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  });
