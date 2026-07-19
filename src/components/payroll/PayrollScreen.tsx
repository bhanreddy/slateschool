import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  StatusBar,
  Pressable,
  Modal,
  Switch,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { alertCompat } from '../../utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../AdminHeader';
import AppTextInput from '../AppTextInput';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withRepeat,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { usePayroll } from '../../hooks/usePayroll';
import { PayrollEntry } from '../../types/payroll';
import { useTheme } from '../../hooks/useTheme';
import { useAccountsWebChrome } from '../../contexts/AccountsWebChromeContext';
import { Theme, Surfaces, Spacing, Radii, Shadows, Typography } from '../../theme/themes';
import { styles as themeStyles } from '../../theme/styles';
import { AdminService } from '../../services/adminService';

/** Mode A — clay world, glass accents. Soft finance desk, not loud gradients. */
const CLAY = {
  indigoTint: '#EEF2FF',
  indigoInk: '#4338CA',
  emeraldTint: '#ECFDF5',
  emeraldInk: '#047857',
  amberTint: '#FFFBEB',
  amberInk: '#B45309',
  roseTint: '#FEF2F2',
  roseInk: '#B91C1C',
  slateTint: '#F1F5F9',
} as const;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type StatusFilter = 'all' | 'pending' | 'paid';

const getDesig = (name?: string) => {
  const n = name || 'Staff';
  const hash = n.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    { color: '#6366F1', tint: '#EEF2FF', icon: 'star-outline' as const },
    { color: '#3B82F6', tint: '#EFF6FF', icon: 'book-outline' as const },
    { color: '#059669', tint: '#ECFDF5', icon: 'shield-outline' as const },
    { color: '#D97706', tint: '#FFFBEB', icon: 'calculator-outline' as const },
    { color: '#DB2777', tint: '#FDF2F8', icon: 'library-outline' as const },
    { color: '#0284C7', tint: '#F0F9FF', icon: 'briefcase-outline' as const },
    { color: '#DC2626', tint: '#FEF2F2', icon: 'car-outline' as const },
  ];
  const defaults: Record<string, (typeof colors)[number]> = {
    Principal: colors[0],
    'Vice Principal': colors[1],
    Teacher: colors[1],
    'Senior Teacher': colors[5],
    'Lab Assistant': colors[2],
    Librarian: colors[4],
    Clerk: colors[3],
    Accountant: colors[3],
    Admin: colors[2],
    Driver: colors[6],
  };
  return defaults[n] || colors[hash % colors.length];
};

const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const fmtDate = (d?: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch {
    return d;
  }
};

function PressScale({
  children,
  onPress,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: object;
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      disabled={disabled || !onPress}
      onPressIn={() => {
        if (!disabled && onPress) s.value = withTiming(0.97, { duration: 90 });
      }}
      onPressOut={() => {
        s.value = withTiming(1, { duration: 120 });
      }}
      onPress={onPress}
      hitSlop={8}
      style={Platform.OS === 'web' ? ({ cursor: disabled || !onPress ? 'default' : 'pointer' } as object) : undefined}
    >
      <Animated.View style={[style, a, disabled && { opacity: 0.42 }]}>{children}</Animated.View>
    </Pressable>
  );
}

const Skeleton = ({ style }: { style: object }) => {
  const op = useSharedValue(0.35);
  useEffect(() => {
    op.value = withRepeat(
      withSequence(withTiming(0.88, { duration: 650 }), withTiming(0.35, { duration: 650 })),
      -1,
      false,
    );
  }, [op]);
  const anim = useAnimatedStyle(() => ({ opacity: op.value }));
  return <Animated.View style={[style, anim]} />;
};

/* ─── Month navigator ─── */
const MonthNav = ({
  month,
  year,
  onPrev,
  onNext,
  isDark,
  onToggleSettings,
  settingsOpen,
  showSettings,
}: {
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
  isDark: boolean;
  onToggleSettings?: () => void;
  settingsOpen?: boolean;
  showSettings?: boolean;
}) => {
  const surface = isDark ? Surfaces.dark.raised : Surfaces.light.raised;
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
  const ink = isDark ? '#E2E8F0' : '#0F172A';
  const muted = isDark ? '#64748B' : '#64748B';
  const chipBg = isDark ? Surfaces.dark.overlay : CLAY.slateTint;

  return (
    <Animated.View entering={FadeInDown.duration(280)} style={[navSt.wrap, { backgroundColor: surface, borderColor: border }, Shadows.sm]}>
      <PressScale onPress={onPrev} style={[navSt.arrow, { backgroundColor: chipBg }]}>
        <Ionicons name="chevron-back" size={18} color={muted} />
      </PressScale>

      <View style={navSt.center}>
        <Text style={[navSt.monthTxt, { color: ink }]}>{MONTHS[month - 1]}</Text>
        <View style={[navSt.yearPill, { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : CLAY.indigoTint }]}>
          <Text style={[navSt.yearTxt, { color: isDark ? '#A5B4FC' : CLAY.indigoInk }]}>{year}</Text>
        </View>
      </View>

      <View style={navSt.right}>
        {showSettings && (
          <PressScale
            onPress={onToggleSettings}
            style={[
              navSt.arrow,
              {
                backgroundColor: settingsOpen
                  ? isDark
                    ? 'rgba(99,102,241,0.22)'
                    : CLAY.indigoTint
                  : chipBg,
              },
            ]}
          >
            <Ionicons
              name={settingsOpen ? 'options' : 'options-outline'}
              size={18}
              color={settingsOpen ? (isDark ? '#A5B4FC' : CLAY.indigoInk) : muted}
            />
          </PressScale>
        )}
        <PressScale onPress={onNext} style={[navSt.arrow, { backgroundColor: chipBg }]}>
          <Ionicons name="chevron-forward" size={18} color={muted} />
        </PressScale>
      </View>
    </Animated.View>
  );
};

const navSt = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radii.xl,
    padding: Spacing.xs,
    borderWidth: 1,
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1, justifyContent: 'center' },
  monthTxt: { fontSize: 17, fontWeight: '700', letterSpacing: -0.4 },
  yearPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.pill },
  yearTxt: { fontSize: 12, fontWeight: '700' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

/* ─── Soft summary + progress ─── */
const SummaryHero = ({
  summary,
  count,
  isDark,
}: {
  summary: { total_paid: number; total_pending: number };
  count: { paid: number; total: number };
  isDark: boolean;
}) => {
  const total = summary.total_paid + summary.total_pending;
  const pct = total > 0 ? summary.total_paid / total : 0;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(pct, { duration: 700 });
  }, [pct, progress]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(progress.value, 0.02) }],
  }));

  const surface = isDark ? Surfaces.dark.raised : Surfaces.light.raised;
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
  const ink = isDark ? '#F1F5F9' : '#0F172A';
  const muted = isDark ? '#94A3B8' : '#64748B';

  const cards = [
    {
      label: 'Total',
      value: fmtINR(total),
      tint: isDark ? 'rgba(99,102,241,0.16)' : CLAY.indigoTint,
      ink: isDark ? '#A5B4FC' : CLAY.indigoInk,
      icon: 'wallet-outline' as const,
    },
    {
      label: 'Disbursed',
      value: fmtINR(summary.total_paid),
      tint: isDark ? 'rgba(16,185,129,0.14)' : CLAY.emeraldTint,
      ink: isDark ? '#34D399' : CLAY.emeraldInk,
      icon: 'checkmark-circle-outline' as const,
    },
    {
      label: 'Pending',
      value: fmtINR(summary.total_pending),
      tint: isDark ? 'rgba(245,158,11,0.14)' : CLAY.amberTint,
      ink: isDark ? '#FBBF24' : CLAY.amberInk,
      icon: 'time-outline' as const,
    },
  ];

  return (
    <Animated.View
      entering={FadeInDown.delay(60).duration(300)}
      style={[sumSt.hero, { backgroundColor: surface, borderColor: border }, Shadows.sm]}
    >
      <View style={sumSt.row}>
        {cards.map((c) => (
          <View key={c.label} style={[sumSt.stat, { backgroundColor: c.tint }]}>
            <View style={[sumSt.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)' }]}>
              <Ionicons name={c.icon} size={14} color={c.ink} />
            </View>
            <Text style={[sumSt.val, { color: c.ink }]} numberOfLines={1} adjustsFontSizeToFit>
              {c.value}
            </Text>
            <Text style={[sumSt.lbl, { color: muted }]}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={sumSt.progressBlock}>
        <View style={sumSt.progressTop}>
          <Text style={[sumSt.progressTitle, { color: ink }]}>
            {count.paid} of {count.total} paid
          </Text>
          <Text style={[sumSt.pct, { color: isDark ? '#A5B4FC' : CLAY.indigoInk }]}>
            {Math.round(pct * 100)}%
          </Text>
        </View>
        <View style={[sumSt.track, { backgroundColor: isDark ? Surfaces.dark.overlay : CLAY.slateTint }]}>
          <Animated.View
            style={[
              sumSt.fill,
              barStyle,
              Platform.OS === 'web' ? ({ transformOrigin: 'left center' } as object) : null,
            ]}
          >
            <LinearGradient
              colors={['#6366F1', '#818CF8']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
};

const sumSt = StyleSheet.create({
  hero: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radii.xxl,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  row: { flexDirection: 'row', gap: Spacing.xs },
  stat: {
    flex: 1,
    borderRadius: Radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  val: { fontSize: 15, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 },
  lbl: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  progressBlock: { gap: 8 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { fontSize: 13, fontWeight: '600' },
  pct: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, width: '100%', borderRadius: 4 },
});

/* ─── Compact settings (collapsed by default) ─── */
const SettingsPanel = ({
  isAdmin,
  distributionBlocked,
  staffPayslipsEnabled,
  isDark,
  onToggleDistribution,
  onTogglePayslips,
  togglingDist,
  togglingPayslips,
}: {
  isAdmin: boolean;
  distributionBlocked: boolean;
  staffPayslipsEnabled: boolean;
  isDark: boolean;
  onToggleDistribution?: (blocked: boolean) => void;
  onTogglePayslips?: (enabled: boolean) => void;
  togglingDist?: boolean;
  togglingPayslips?: boolean;
}) => {
  const surface = isDark ? Surfaces.dark.raised : Surfaces.light.raised;
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
  const ink = isDark ? '#F1F5F9' : '#0F172A';
  const muted = isDark ? '#94A3B8' : '#64748B';

  if (!isAdmin) {
    if (!distributionBlocked) return null;
    return (
      <Animated.View
        entering={FadeInDown.duration(240)}
        style={[setSt.wrap, { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : CLAY.roseTint, borderColor: isDark ? 'rgba(248,113,113,0.35)' : '#FECACA' }]}
      >
        <Ionicons name="lock-closed" size={18} color={isDark ? '#F87171' : CLAY.roseInk} />
        <View style={{ flex: 1 }}>
          <Text style={[setSt.title, { color: isDark ? '#FECACA' : CLAY.roseInk }]}>Distribution paused</Text>
          <Text style={[setSt.sub, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
            You can review payroll but cannot release salaries.
          </Text>
        </View>
      </Animated.View>
    );
  }

  const rows = [
    {
      key: 'dist',
      icon: distributionBlocked ? ('lock-closed' as const) : ('lock-open-outline' as const),
      title: 'Accounts can release pay',
      sub: distributionBlocked ? 'Blocked — accounts cannot process' : 'Open — accounts can process',
      value: !distributionBlocked,
      onChange: (v: boolean) => onToggleDistribution?.(!v),
      toggling: togglingDist,
      onColor: '#10B981',
      offColor: '#EF4444',
    },
    {
      key: 'slips',
      icon: staffPayslipsEnabled ? ('document-text-outline' as const) : ('eye-off-outline' as const),
      title: 'Staff portal payslips',
      sub: staffPayslipsEnabled ? 'Visible to staff' : 'Hidden from staff',
      value: staffPayslipsEnabled,
      onChange: (v: boolean) => onTogglePayslips?.(v),
      toggling: togglingPayslips,
      onColor: '#10B981',
      offColor: '#EF4444',
    },
  ];

  return (
    <Animated.View entering={FadeInDown.duration(240)} style={[setSt.panel, { backgroundColor: surface, borderColor: border }, Shadows.sm]}>
      <Text style={[setSt.panelLabel, { color: muted }]}>PAYROLL CONTROLS</Text>
      {rows.map((r, i) => (
        <View
          key={r.key}
          style={[
            setSt.row,
            i < rows.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: border,
            },
          ]}
        >
          <View style={[setSt.iconBox, { backgroundColor: isDark ? Surfaces.dark.overlay : CLAY.slateTint }]}>
            <Ionicons name={r.icon} size={16} color={r.value ? CLAY.emeraldInk : CLAY.roseInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[setSt.title, { color: ink }]}>{r.title}</Text>
            <Text style={[setSt.sub, { color: muted }]}>{r.sub}</Text>
          </View>
          <Switch
            value={r.value}
            onValueChange={r.onChange}
            disabled={r.toggling}
            trackColor={{ false: '#FCA5A5', true: '#6EE7B7' }}
            thumbColor={r.value ? r.onColor : r.offColor}
          />
        </View>
      ))}
    </Animated.View>
  );
};

const setSt = StyleSheet.create({
  wrap: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  panel: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radii.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderWidth: 1,
  },
  panelLabel: {
    ...Typography.label,
    marginBottom: Spacing.xs,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  sub: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
});

/* ─── Filter chips + search ─── */
const ListToolbar = ({
  filter,
  onFilter,
  counts,
  query,
  onQuery,
  isDark,
}: {
  filter: StatusFilter;
  onFilter: (f: StatusFilter) => void;
  counts: { all: number; pending: number; paid: number };
  query: string;
  onQuery: (q: string) => void;
  isDark: boolean;
}) => {
  const chips: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'paid', label: 'Paid', count: counts.paid },
  ];
  const ink = isDark ? '#E2E8F0' : '#0F172A';
  const muted = isDark ? '#64748B' : '#64748B';
  const surface = isDark ? Surfaces.dark.raised : Surfaces.light.raised;
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(280)} style={toolSt.wrap}>
      <View style={toolSt.chips}>
        {chips.map((c) => {
          const active = filter === c.key;
          return (
            <PressScale key={c.key} onPress={() => onFilter(c.key)}>
              <View
                style={[
                  toolSt.chip,
                  {
                    backgroundColor: active
                      ? isDark
                        ? 'rgba(99,102,241,0.22)'
                        : CLAY.indigoTint
                      : isDark
                        ? Surfaces.dark.raised
                        : Surfaces.light.raised,
                    borderColor: active
                      ? isDark
                        ? 'rgba(165,180,252,0.45)'
                        : 'rgba(99,102,241,0.35)'
                      : border,
                  },
                ]}
              >
                <Text style={[toolSt.chipTxt, { color: active ? (isDark ? '#C7D2FE' : CLAY.indigoInk) : muted }]}>
                  {c.label}
                </Text>
                <View
                  style={[
                    toolSt.count,
                    {
                      backgroundColor: active
                        ? isDark
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(67,56,202,0.12)'
                        : isDark
                          ? Surfaces.dark.overlay
                          : CLAY.slateTint,
                    },
                  ]}
                >
                  <Text style={[toolSt.countTxt, { color: active ? (isDark ? '#E0E7FF' : CLAY.indigoInk) : muted }]}>
                    {c.count}
                  </Text>
                </View>
              </View>
            </PressScale>
          );
        })}
      </View>

      <View style={[toolSt.search, { backgroundColor: surface, borderColor: border }]}>
        <Ionicons name="search" size={16} color={muted} />
        <AppTextInput
          style={[themeStyles.inputInChrome, toolSt.searchInput, { color: ink }]}
          value={query}
          onChangeText={onQuery}
          placeholder="Search staff…"
          placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <PressScale onPress={() => onQuery('')}>
            <Ionicons name="close-circle" size={16} color={muted} />
          </PressScale>
        )}
      </View>
    </Animated.View>
  );
};

const toolSt = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.md, marginTop: Spacing.md, gap: Spacing.sm },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: 1,
    minHeight: 36,
  },
  chipTxt: { fontSize: 13, fontWeight: '700' },
  count: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countTxt: { fontSize: 11, fontWeight: '800' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radii.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 0 },
});

/* ─── Avatar ─── */
const StaffAvatar = React.memo(function StaffAvatar({
  url,
  name,
  color,
  tint,
  size = 44,
}: {
  url?: string | null;
  name: string;
  color: string;
  tint: string;
  size?: number;
}) {
  const [imgErr, setImgErr] = useState(false);
  const initials =
    name
      ?.split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  const r = size / 2;

  if (!url || imgErr) {
    return (
      <View style={[avSt.circle, { width: size, height: size, borderRadius: r, backgroundColor: tint }]}>
        <Text style={[avSt.initials, { fontSize: size * 0.32, color }]}>{initials}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      style={[avSt.img, { width: size, height: size, borderRadius: r }]}
      onError={() => setImgErr(true)}
    />
  );
});

const avSt = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center' },
  initials: { fontWeight: '800', letterSpacing: -0.4 },
  img: { resizeMode: 'cover' },
});

/* ─── Staff row ─── */
type PayrollCardProps = {
  item: PayrollEntry;
  onPay: () => void;
  onAdjust: () => void;
  isDark: boolean;
  canProcess: boolean;
  compact: boolean;
};

const PayrollCard = React.memo(function PayrollCard({
  item,
  onPay,
  onAdjust,
  isDark,
  canProcess,
  compact,
}: PayrollCardProps) {
  const person = item.staff?.person;
  const designation = item.staff?.designation?.name || 'Staff';
  const desig = getDesig(designation);
  const isPaid = item.status === 'paid';
  const fullName =
    person?.display_name ||
    `${person?.first_name || ''} ${person?.last_name || ''}`.trim() ||
    'Staff Member';
  const adjustment = Number(item.salary_adjustment ?? 0);

  const surface = isDark ? Surfaces.dark.raised : Surfaces.light.raised;
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)';
  const ink = isDark ? '#F1F5F9' : '#0F172A';
  const muted = isDark ? '#94A3B8' : '#64748B';
  const soft = isDark ? Surfaces.dark.overlay : Surfaces.light.overlay;

  return (
    <View style={[crdSt.card, { backgroundColor: surface, borderColor: border }, Shadows.sm]}>
      <View style={crdSt.topRow}>
        <StaffAvatar url={person?.photo_url} name={fullName} color={desig.color} tint={desig.tint} size={compact ? 40 : 44} />
        <View style={crdSt.infoArea}>
          <Text style={[crdSt.name, { color: ink }]} numberOfLines={1}>
            {fullName}
          </Text>
          <Text style={[crdSt.role, { color: desig.color }]} numberOfLines={1}>
            {designation}
          </Text>
        </View>

        <View style={crdSt.netCol}>
          <Text style={[crdSt.netLabel, { color: muted }]}>NET</Text>
          <Text style={[crdSt.netVal, { color: ink }]}>{fmtINR(item.net_salary)}</Text>
        </View>
      </View>

      <View style={[crdSt.breakRow, { backgroundColor: soft }]}>
        <View style={crdSt.breakItem}>
          <Text style={[crdSt.breakLabel, { color: muted }]}>Base</Text>
          <Text style={[crdSt.breakVal, { color: ink }]}>{fmtINR(item.base_salary ?? item.net_salary)}</Text>
        </View>
        <View style={[crdSt.breakDiv, { backgroundColor: border }]} />
        <View style={crdSt.breakItem}>
          <Text style={[crdSt.breakLabel, { color: muted }]}>Deduct</Text>
          <Text style={[crdSt.breakVal, { color: '#EF4444' }]}>−{fmtINR(item.deductions ?? 0)}</Text>
        </View>
        <View style={[crdSt.breakDiv, { backgroundColor: border }]} />
        <View style={crdSt.breakItem}>
          <Text style={[crdSt.breakLabel, { color: muted }]}>Adjust</Text>
          <Text style={[crdSt.breakVal, { color: adjustment >= 0 ? '#059669' : '#EF4444' }]}>
            {adjustment >= 0 ? '+' : '−'}
            {fmtINR(Math.abs(adjustment))}
          </Text>
        </View>
      </View>

      <View style={crdSt.footer}>
        {isPaid ? (
          <>
            <View style={[crdSt.badge, { backgroundColor: isDark ? 'rgba(16,185,129,0.16)' : CLAY.emeraldTint }]}>
              <Ionicons name="checkmark-circle" size={13} color={isDark ? '#34D399' : '#059669'} />
              <Text style={[crdSt.badgeTxt, { color: isDark ? '#6EE7B7' : '#065F46' }]}>Paid</Text>
            </View>
            <Text style={[crdSt.dateText, { color: muted }]}>{fmtDate(item.payment_date ?? undefined)}</Text>
          </>
        ) : (
          <>
            <View style={[crdSt.badge, { backgroundColor: isDark ? 'rgba(245,158,11,0.16)' : CLAY.amberTint }]}>
              <Ionicons name="time-outline" size={12} color={isDark ? '#FBBF24' : '#D97706'} />
              <Text style={[crdSt.badgeTxt, { color: isDark ? '#FCD34D' : '#92400E' }]}>Pending</Text>
            </View>
            <View style={crdSt.actionRow}>
              <PressScale onPress={onAdjust} style={[crdSt.ghostBtn, { borderColor: border }]}>
                <Ionicons name="create-outline" size={14} color={muted} />
                <Text style={[crdSt.ghostTxt, { color: muted }]}>Adjust</Text>
              </PressScale>
              {canProcess && (
                <PressScale onPress={onPay} style={crdSt.payWrap}>
                  <LinearGradient
                    colors={['#4F46E5', '#6366F1']}
                    style={crdSt.payBtn}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <LinearGradient
                      colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                    />
                    <Ionicons name="card-outline" size={14} color="#fff" />
                    <Text style={crdSt.payTxt}>Process</Text>
                  </LinearGradient>
                </PressScale>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
});

const crdSt = StyleSheet.create({
  card: {
    borderRadius: Radii.xl,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 12,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoArea: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 2 },
  role: { fontSize: 12, fontWeight: '600' },
  netCol: { alignItems: 'flex-end' },
  netLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 2 },
  netVal: { fontSize: 16, fontWeight: '800', letterSpacing: -0.4 },
  breakRow: {
    flexDirection: 'row',
    borderRadius: Radii.md,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  breakItem: { flex: 1, alignItems: 'center', gap: 3 },
  breakLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  breakVal: { fontSize: 12, fontWeight: '700', letterSpacing: -0.2 },
  breakDiv: { width: StyleSheet.hairlineWidth, marginVertical: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.pill,
  },
  badgeTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  dateText: { fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  ghostTxt: { fontSize: 13, fontWeight: '700' },
  payWrap: {
    borderRadius: Radii.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  payTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },
});

const CardSkeleton = ({ isDark }: { isDark: boolean }) => (
  <View
    style={[
      crdSt.card,
      {
        backgroundColor: isDark ? Surfaces.dark.raised : Surfaces.light.raised,
        borderColor: 'transparent',
        gap: 12,
      },
    ]}
  >
    <Skeleton style={{ height: 44, borderRadius: 12, backgroundColor: isDark ? Surfaces.dark.overlay : '#E2E8F0' }} />
    <Skeleton style={{ height: 36, borderRadius: 10, backgroundColor: isDark ? Surfaces.dark.overlay : '#E2E8F0' }} />
    <Skeleton style={{ height: 28, width: '55%', borderRadius: 10, backgroundColor: isDark ? Surfaces.dark.overlay : '#E2E8F0' }} />
  </View>
);

/* ─── Adjust modal ─── */
type AdjustModalProps = {
  visible: boolean;
  item: PayrollEntry | null;
  isDark: boolean;
  onClose: () => void;
  onSave: (direction: 'increase' | 'decrease', amount: number, remarks: string) => Promise<void>;
  saving: boolean;
};

const AdjustSalaryModal = ({ visible, item, isDark, onClose, onSave, saving }: AdjustModalProps) => {
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!item) return;
    const adj = Number(item.salary_adjustment ?? 0);
    if (adj < 0) {
      setDirection('decrease');
      setAmount(String(Math.abs(adj)));
    } else if (adj > 0) {
      setDirection('increase');
      setAmount(String(adj));
    } else {
      setDirection('increase');
      setAmount('');
    }
    setRemarks(item.remarks || '');
  }, [item, visible]);

  const person = item?.staff?.person;
  const name = person?.display_name || person?.first_name || 'Staff';
  const surface = isDark ? Surfaces.dark.raised : Surfaces.light.raised;
  const ink = isDark ? '#F8FAFC' : '#0F172A';
  const muted = isDark ? '#94A3B8' : '#64748B';
  const border = isDark ? '#334155' : '#E2E8F0';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={modalSt.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View entering={FadeIn.duration(200)} style={[modalSt.card, { backgroundColor: surface }, Shadows.lg]}>
          <View style={modalSt.header}>
            <View>
              <Text style={[modalSt.title, { color: ink }]}>Adjust salary</Text>
              <Text style={[modalSt.sub, { color: muted }]}>{name}</Text>
            </View>
            <PressScale onPress={onClose} style={[modalSt.close, { backgroundColor: isDark ? Surfaces.dark.overlay : CLAY.slateTint }]}>
              <Ionicons name="close" size={18} color={muted} />
            </PressScale>
          </View>

          <View style={modalSt.dirRow}>
            {(['increase', 'decrease'] as const).map((d) => {
              const active = direction === d;
              const up = d === 'increase';
              return (
                <PressScale key={d} onPress={() => setDirection(d)} style={{ flex: 1 }}>
                  <View
                    style={[
                      modalSt.dirBtn,
                      {
                        backgroundColor: active
                          ? up
                            ? isDark
                              ? 'rgba(16,185,129,0.16)'
                              : CLAY.emeraldTint
                            : isDark
                              ? 'rgba(239,68,68,0.14)'
                              : CLAY.roseTint
                          : isDark
                            ? Surfaces.dark.overlay
                            : Surfaces.light.overlay,
                        borderColor: active ? (up ? '#22C55E' : '#EF4444') : border,
                      },
                    ]}
                  >
                    <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={14} color={up ? '#16A34A' : '#DC2626'} />
                    <Text style={{ fontWeight: '700', color: up ? '#16A34A' : '#DC2626', textTransform: 'capitalize' }}>
                      {d}
                    </Text>
                  </View>
                </PressScale>
              );
            })}
          </View>

          <AppTextInput
            style={[modalSt.input, { color: ink, borderColor: border, backgroundColor: isDark ? Surfaces.dark.muted : Surfaces.light.overlay }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="Amount in ₹"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          />
          <AppTextInput
            style={[
              modalSt.input,
              {
                color: ink,
                borderColor: border,
                backgroundColor: isDark ? Surfaces.dark.muted : Surfaces.light.overlay,
                minHeight: 72,
                textAlignVertical: 'top',
              },
            ]}
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Reason (optional)"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            multiline
          />

          <View style={modalSt.actions}>
            <PressScale onPress={onClose} disabled={saving} style={modalSt.cancelBtn}>
              <Text style={{ fontWeight: '700', color: muted }}>Cancel</Text>
            </PressScale>
            <PressScale
              onPress={() => onSave(direction, Number(amount) || 0, remarks)}
              disabled={saving}
              style={modalSt.saveWrap}
            >
              <LinearGradient colors={['#4F46E5', '#6366F1']} style={modalSt.saveBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={{ fontWeight: '800', color: '#fff' }}>{saving ? 'Saving…' : 'Save adjustment'}</Text>
              </LinearGradient>
            </PressScale>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const modalSt = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.52)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: { borderRadius: Radii.xxl, padding: Spacing.lg, gap: Spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  close: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dirRow: { flexDirection: 'row', gap: 10 },
  dirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    minHeight: 44,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 4 },
  cancelBtn: { paddingHorizontal: 16, height: 44, justifyContent: 'center' },
  saveWrap: { borderRadius: Radii.md, overflow: 'hidden' },
  saveBtn: { paddingHorizontal: 18, height: 44, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
});

/* ─── Screen ─── */
export interface PayrollScreenProps {
  isAdmin?: boolean;
  title?: string;
  showHeader?: boolean;
}

export default function PayrollScreen({ isAdmin = false, title = 'Payroll', showHeader = true }: PayrollScreenProps) {
  const { theme, isDark } = useTheme();
  const { shellActive } = useAccountsWebChrome();
  const { width } = useWindowDimensions();
  const compact = width < 420;
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const {
    payrollData,
    loading,
    summary,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    fetchPayroll,
    markAsPaid,
    adjustSalary,
    distributionBlocked,
    accountsDistributionBlocked,
    distributionLoading,
    setDistributionBlockedForAccounts,
  } = usePayroll({ isAdmin });

  const [adjustTarget, setAdjustTarget] = useState<PayrollEntry | null>(null);
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [toggleSaving, setToggleSaving] = useState(false);
  const [staffPayslipsEnabled, setStaffPayslipsEnabled] = useState(true);
  const [payslipsToggleLoading, setPayslipsToggleLoading] = useState(false);
  const [payslipsToggleSaving, setPayslipsToggleSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchPayroll();
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    setPayslipsToggleLoading(true);
    AdminService.getStaffPayslipsSetting()
      .then((res) => {
        if (alive) setStaffPayslipsEnabled(res?.enabled !== false);
      })
      .catch(() => {
        if (alive) setStaffPayslipsEnabled(true);
      })
      .finally(() => {
        if (alive) setPayslipsToggleLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  // Auto-open settings briefly if accounts are blocked (so they notice)
  useEffect(() => {
    if (!isAdmin && distributionBlocked) setSettingsOpen(true);
  }, [isAdmin, distributionBlocked]);

  const canProcess = isAdmin || !accountsDistributionBlocked;

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y: number) => y - 1);
    } else setSelectedMonth((m: number) => m - 1);
  };
  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y: number) => y + 1);
    } else setSelectedMonth((m: number) => m + 1);
  };

  const handleProcessPay = useCallback(
    (item: PayrollEntry) => {
      const name = item.staff?.person?.first_name || 'this staff member';
      alertCompat('Confirm Payment', `Release ${fmtINR(item.net_salary)} to ${name}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          onPress: async () => {
            const res = await markAsPaid(item.id);
            if (!res.ok) alertCompat('Error', res.message || 'Failed to update payment status.');
          },
        },
      ]);
    },
    [markAsPaid],
  );

  const handleSaveAdjustment = async (direction: 'increase' | 'decrease', amount: number, remarks: string) => {
    if (!adjustTarget) return;
    if (amount < 0) {
      alertCompat('Invalid amount', 'Enter a valid amount.');
      return;
    }
    const signed = direction === 'increase' ? amount : -amount;
    setAdjustSaving(true);
    const res = await adjustSalary(adjustTarget.id, signed, remarks.trim() || undefined);
    setAdjustSaving(false);
    if (res.ok) {
      setAdjustTarget(null);
    } else {
      alertCompat('Error', res.message || 'Failed to save adjustment.');
    }
  };

  const handleToggleDistribution = async (blocked: boolean) => {
    setToggleSaving(true);
    const res = await setDistributionBlockedForAccounts(blocked);
    setToggleSaving(false);
    if (!res.ok) {
      alertCompat('Error', res.message || 'Failed to update setting.');
    }
  };

  const handleToggleStaffPayslips = async (enabled: boolean) => {
    setPayslipsToggleSaving(true);
    try {
      const res = await AdminService.setStaffPayslipsEnabled(enabled);
      setStaffPayslipsEnabled(res?.enabled !== false);
    } catch (err: unknown) {
      alertCompat('Error', err instanceof Error ? err.message : 'Failed to update payslips setting.');
    } finally {
      setPayslipsToggleSaving(false);
    }
  };

  const paidCount = payrollData.filter((e) => e.status === 'paid').length;
  const pendingCount = payrollData.filter((e) => e.status === 'pending').length;
  const count = { paid: paidCount, total: payrollData.length };
  const filterCounts = { all: payrollData.length, pending: pendingCount, paid: paidCount };

  const filteredData = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payrollData.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!q) return true;
      const person = item.staff?.person;
      const name =
        person?.display_name ||
        `${person?.first_name || ''} ${person?.last_name || ''}`.trim() ||
        '';
      const role = item.staff?.designation?.name || '';
      return name.toLowerCase().includes(q) || role.toLowerCase().includes(q);
    });
  }, [payrollData, statusFilter, query]);

  const renderItem = useCallback(
    ({ item }: { item: PayrollEntry }) => (
      <PayrollCard
        item={item}
        onPay={() => handleProcessPay(item)}
        onAdjust={() => setAdjustTarget(item)}
        isDark={isDark}
        canProcess={canProcess}
        compact={compact}
      />
    ),
    [handleProcessPay, isDark, canProcess, compact],
  );

  const listHeader = (
    <>
      <MonthNav
        month={selectedMonth}
        year={selectedYear}
        onPrev={handlePrevMonth}
        onNext={handleNextMonth}
        isDark={isDark}
        showSettings={isAdmin || distributionBlocked}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
      />

      {(settingsOpen || (!isAdmin && distributionBlocked)) && (
        <SettingsPanel
          isAdmin={isAdmin}
          distributionBlocked={distributionBlocked}
          staffPayslipsEnabled={staffPayslipsEnabled}
          isDark={isDark}
          onToggleDistribution={handleToggleDistribution}
          onTogglePayslips={handleToggleStaffPayslips}
          togglingDist={toggleSaving || distributionLoading}
          togglingPayslips={payslipsToggleLoading || payslipsToggleSaving}
        />
      )}

      <SummaryHero summary={summary} count={count} isDark={isDark} />

      <ListToolbar
        filter={statusFilter}
        onFilter={setStatusFilter}
        counts={filterCounts}
        query={query}
        onQuery={setQuery}
        isDark={isDark}
      />
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? Surfaces.dark.base : Surfaces.light.base}
      />
      {showHeader && !shellActive && <AdminHeader title={title} showBackButton />}

      {loading ? (
        <FlatList
          data={[1, 2, 3, 4]}
          keyExtractor={(i) => String(i)}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={() => <CardSkeleton isDark={isDark} />}
        />
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchPayroll}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListEmptyComponent={
            <Animated.View entering={FadeIn.duration(320)} style={styles.emptyWrap}>
              <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? Surfaces.dark.overlay : CLAY.indigoTint }]}>
                <Ionicons name="people-outline" size={30} color={isDark ? '#64748B' : '#818CF8'} />
              </View>
              <Text style={[styles.emptyTitle, { color: isDark ? '#94A3B8' : '#475569' }]}>
                {query || statusFilter !== 'all' ? 'No matches' : 'No payroll records'}
              </Text>
              <Text style={[styles.emptySub, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                {query || statusFilter !== 'all'
                  ? 'Try another filter or search term'
                  : 'Records will appear once generated for this month'}
              </Text>
              {(query || statusFilter !== 'all') && (
                <PressScale
                  onPress={() => {
                    setQuery('');
                    setStatusFilter('all');
                  }}
                  style={[styles.clearBtn, { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : CLAY.indigoTint }]}
                >
                  <Text style={{ fontWeight: '700', color: isDark ? '#C7D2FE' : CLAY.indigoInk }}>Clear filters</Text>
                </PressScale>
              )}
            </Animated.View>
          }
        />
      )}

      <AdjustSalaryModal
        visible={!!adjustTarget}
        item={adjustTarget}
        isDark={isDark}
        onClose={() => setAdjustTarget(null)}
        onSave={handleSaveAdjustment}
        saving={adjustSaving}
      />
    </View>
  );
}

const getStyles = (_theme: Theme, _isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    listContent: { paddingHorizontal: Spacing.md, paddingTop: 4, paddingBottom: 48 },
    emptyWrap: { alignItems: 'center', paddingTop: 56, gap: 8, paddingHorizontal: 24 },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    emptyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
    emptySub: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 18 },
    clearBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      height: 40,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
