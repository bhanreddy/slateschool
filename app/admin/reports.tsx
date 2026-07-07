/**
 * AdminReports.tsx
 * Analytics Cockpit — command-centre aesthetic.
 * Fully driven by useAnalytics → analyticsService → REST API.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, StatusBar, Platform, Linking,
} from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { useAnalytics, TimeRange, Section } from '../../src/hooks/useAnalytics';
import { useTheme } from '../../src/hooks/useTheme';
import { Insight } from '../../src/services/analyticsService';
import LogoLoader from '../../src/components/LogoLoader';

const { width } = Dimensions.get('window');

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const getC = (isDark: boolean) => ({
  bg: isDark ? '#0B1120' : '#F8FAFC',
  surface: isDark ? '#111827' : '#FFFFFF',
  surfaceHigh: isDark ? '#1A2540' : '#F1F5F9',
  border: isDark ? '#1F2E47' : '#E2E8F0',

  green: '#22D3A5', greenDim: 'rgba(34,211,165,0.12)',
  red: '#F43F5E', redDim: 'rgba(244,63,94,0.10)',
  amber: '#FBBF24', amberDim: 'rgba(251,191,36,0.10)',
  blue: '#60A5FA', blueDim: 'rgba(96,165,250,0.10)',
  violet: '#A78BFA', violetDim: 'rgba(167,139,250,0.10)',
  cyan: '#22D3EE', cyanDim: 'rgba(34,211,238,0.10)',

  text: isDark ? '#F1F5F9' : '#1E293B',
  textSub: isDark ? '#94A3B8' : '#64748B',
  textMute: isDark ? '#3D5070' : '#94A3B8',

  r8: 8, r12: 12, r16: 16, r20: 20,
});

// ─── Nav Config ───────────────────────────────────────────────────────────────
const getSections = (C: any): { key: Section; label: string; icon: string; color: string }[] => [
  { key: 'overview', label: 'Overview', icon: 'grid-outline', color: C.cyan },
  { key: 'finance', label: 'Finance', icon: 'wallet-outline', color: C.green },
  { key: 'attendance', label: 'Attendance', icon: 'people-outline', color: C.blue },
  { key: 'academic', label: 'Academic', icon: 'school-outline', color: C.violet },
  { key: 'staff', label: 'Staff', icon: 'id-card-outline', color: C.amber },
];

const RANGES: { key: TimeRange; label: string }[] = [
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'YTD' },
];

// ─── Micro Components ─────────────────────────────────────────────────────────

function Div({ style }: any) {
  const { isDark } = useTheme();
  const C = getC(isDark);
  return <View style={[{ height: 1, backgroundColor: C.border }, style]} />;
}

function CapLabel({ children, color }: { children: string; color?: string }) {
  const { isDark } = useTheme();
  const C = getC(isDark);
  return <Text style={{
    fontSize: 10, fontWeight: '800', letterSpacing: 1.1,
    textTransform: 'uppercase', color: color || C.textSub
  }}>{children}</Text>;
}

function Delta({ value, positive }: { value: string; positive: boolean }) {
  const { isDark } = useTheme();
  const C = getC(isDark);
  const col = positive ? C.green : C.red;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: positive ? C.greenDim : C.redDim,
      paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99
    }}>
      <Ionicons name={positive ? 'arrow-up' : 'arrow-down'} size={9} color={col} />
      <Text style={{ fontSize: 10, fontWeight: '800', color: col }}>{value}</Text>
    </View>
  );
}

function SHeader({ label, accent, icon, delay = 0 }:
  { label: string; accent: string; icon: string; delay?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, marginBottom: 14 }}>
      <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: accent }} />
      <View style={{
        width: 26, height: 26, borderRadius: 7,
        backgroundColor: accent + '20', alignItems: 'center', justifyContent: 'center'
      }}>
        <Ionicons name={icon as any} size={13} color={accent} />
      </View>
      <CapLabel color={accent}>{label}</CapLabel>
    </Animated.View>
  );
}

function ProgressBar({ value, color, max = 100 }:
  { value: number; color: string; max?: number }) {
  const { isDark } = useTheme();
  const C = getC(isDark);
  const pct = Math.min((value / max) * 100, 100);
  return (
    <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%` as any, height: '100%', backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

// ─── Hero KPI Card ────────────────────────────────────────────────────────────
function HeroKPI({ label, value, sub, color, delay }:
  { label: string; value: string; sub?: string; color: string; delay: number }) {
  const { isDark } = useTheme();
  const C = getC(isDark);
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(450)}
      style={[hS.card, { backgroundColor: C.surface, borderColor: isDark ? color + '30' : C.border }]}>
      <View style={[hS.stripe, { backgroundColor: color }]} />
      <Text style={[hS.value, { color: C.text }]}>{value}</Text>
      <Text style={[hS.label, { color: C.textSub }]}>{label}</Text>
      {sub && <Text style={[hS.sub, { color }]}>{sub}</Text>}
    </Animated.View>
  );
}
const hS = StyleSheet.create({
  card: {
    flex: 1, borderRadius: 16,
    padding: 14, borderWidth: 1, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  value: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginTop: 6 },
  label: { fontSize: 10, fontWeight: '600', marginTop: 4 },
  sub: { fontSize: 9, fontWeight: '700', marginTop: 5 },
});

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, color, label, value, sub, delta, deltaPos, delay }:
  {
    icon: string; color: string; label: string; value: string; sub?: string;
    delta?: string; deltaPos?: boolean; delay: number
  }) {
  const { isDark } = useTheme();
  const C = getC(isDark);
  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(400)}
      style={[scS.card, { backgroundColor: C.surface, borderLeftColor: color, borderColor: C.border }]}>
      <View style={[scS.iconBox, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <CapLabel color={C.textSub}>{label}</CapLabel>
        <Text style={[scS.value, { color: C.text }]}>{value}</Text>
        {sub && <Text style={[scS.sub, { color: C.textSub }]}>{sub}</Text>}
      </View>
      {delta !== undefined && <Delta value={delta} positive={!!deltaPos} />}
    </Animated.View>
  );
}
const scS = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderLeftWidth: 3,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  sub: { fontSize: 10, marginTop: 2 },
});

// ─── Chart Card ───────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, accentColor, delay, loading: ld, children }:
  {
    title: string; subtitle?: string; accentColor: string; delay: number;
    loading?: boolean; children: React.ReactNode
  }) {
  const { isDark } = useTheme();
  const C = getC(isDark);
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)}
      style={[ccS.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      <View style={ccS.header}>
        <View style={{ flex: 1 }}>
          <Text style={[ccS.title, { color: C.text }]}>{title}</Text>
          {subtitle && <Text style={[ccS.subtitle, { color: C.textMute }]}>{subtitle}</Text>}
        </View>
        <View style={[ccS.dot, { backgroundColor: accentColor }]} />
      </View>
      <Div style={{ marginHorizontal: 16 }} />
      <View style={ccS.body}>
        {ld
          ? <View style={{ paddingVertical: 30 }}><LogoLoader size={28} color={accentColor} /></View>
          : children}
      </View>
    </Animated.View>
  );
}
const ccS = StyleSheet.create({
  card: {
    borderRadius: 20, marginBottom: 12,
    borderWidth: 1, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 5 },
    }),
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 12 },
  title: { fontSize: 14, fontWeight: '800' },
  subtitle: { fontSize: 10, marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  body: { paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' },
});

// ─── Table ────────────────────────────────────────────────────────────────────
function THead({ cols }: { cols: string[] }) {
  const { isDark } = useTheme();
  const C = getC(isDark);
  return (
    <View style={{
      flexDirection: 'row', paddingVertical: 7,
      borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surfaceHigh
    }}>
      {cols.map((c, i) => (
        <Text key={i} style={{
          flex: i === 0 ? 2 : 1,
          fontSize: 9, fontWeight: '800', color: C.textMute,
          textTransform: 'uppercase', letterSpacing: 0.8,
          textAlign: i > 0 ? 'right' : 'left', paddingHorizontal: 4
        }}>
          {c}
        </Text>
      ))}
    </View>
  );
}
function TRow({ cols, last }: { cols: string[]; last?: boolean }) {
  const { isDark } = useTheme();
  const C = getC(isDark);
  return (
    <View style={{
      flexDirection: 'row', paddingVertical: 9,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: C.border
    }}>
      {cols.map((c, i) => (
        <Text key={i} style={{
          flex: i === 0 ? 2 : 1,
          fontSize: 11, color: i === 0 ? C.text : C.textSub,
          fontWeight: i === 0 ? '600' : '400',
          textAlign: i > 0 ? 'right' : 'left', paddingHorizontal: 4
        }}>
          {c}
        </Text>
      ))}
    </View>
  );
}

// ─── Table Card ───────────────────────────────────────────────────────────────
function TableCard({ title, delay, children }:
  { title: string; delay: number; children: React.ReactNode }) {
  const { isDark } = useTheme();
  const C = getC(isDark);
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}
      style={[tcS.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      <Text style={[tcS.title, { color: C.text }]}>{title}</Text>
      <Div style={{ marginVertical: 10 }} />
      {children}
    </Animated.View>
  );
}
const tcS = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14, marginBottom: 12,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  title: { fontSize: 13, fontWeight: '800' },
});

// ─── Insight Card ─────────────────────────────────────────────────────────────
function InsightCard({ insight, index, onDismiss }:
  { insight: Insight; index: number; onDismiss: (id: string) => void }) {
  const { isDark } = useTheme();
  const C = getC(isDark);
  const isHigh = insight.severity === 'high';
  const isMed = insight.severity === 'medium';
  const catColors: Record<string, string> = {
    finance: C.green, attendance: C.blue, academic: C.violet, staff: C.amber,
  };
  const col = isHigh ? C.red : isMed ? C.amber : catColors[insight.category] ?? C.blue;

  return (
    <Animated.View entering={FadeInDown.delay(300 + index * 70).duration(350)}
      style={[inS.card, { borderColor: col + '30', backgroundColor: col + '08' }]}>
      <View style={[inS.stripe, { backgroundColor: col }]} />
      <View style={[inS.icon, { backgroundColor: col + '20' }]}>
        <MaterialIcons
          name={isHigh ? 'error' : isMed ? 'warning' : 'info'}
          size={16} color={col} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <View style={[inS.sevBadge, { backgroundColor: col + '20' }]}>
            <Text style={[inS.sevTxt, { color: col }]}>{insight.severity.toUpperCase()}</Text>
          </View>
          <View style={[inS.catBadge, { backgroundColor: C.border }]}>
            <Text style={[inS.catTxt, { color: C.textSub }]}>{insight.category}</Text>
          </View>
        </View>
        <Text style={[inS.msg, { color: C.text }]}>{insight.message}</Text>
        {insight.action_label && (
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}
            onPress={() => insight.action_route && Linking.openURL(insight.action_route)}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: col }}>{insight.action_label}</Text>
            <Ionicons name="arrow-forward" size={11} color={col} />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity style={inS.dismissBtn} onPress={() => onDismiss(insight.id)}>
        <Ionicons name="close" size={14} color={C.textMute} />
      </TouchableOpacity>
    </Animated.View>
  );
}
const inS = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 12, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, overflow: 'hidden'
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  icon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sevBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sevTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  catBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  catTxt: { fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  msg: { fontSize: 12, lineHeight: 17 },
  dismissBtn: { padding: 4 },
});

// ─── Error Banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  const { isDark } = useTheme();
  const C = getC(isDark);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.redDim, borderRadius: 8, padding: 12, marginBottom: 16,
      borderWidth: 1, borderColor: C.red + '40'
    }}>
      <Ionicons name="alert-circle-outline" size={18} color={C.red} />
      <Text style={{ flex: 1, fontSize: 12, color: C.red }}>{msg}</Text>
      <TouchableOpacity onPress={onRetry}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: C.red }}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyChart() {
  const { isDark } = useTheme();
  const C = getC(isDark);
  return <Text style={{ color: C.textMute, fontSize: 12, paddingVertical: 20 }}>
    No data available for this period.
  </Text>;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AdminReports() {
  const { isDark, toggleTheme } = useTheme();
  const C = getC(isDark);
  const SECTIONS = getSections(C);

  const {
    financials, attendance, academics, staff, insights,
    generatedAt, loading, refreshing, error,
    range, setRange,
    activeSection, setActiveSection,
    refreshData, dismissInsight, exportReport,
  } = useAnalytics();

  const [exporting, setExporting] = useState(false);

  const lineData = financials?.trend?.map((t: any) => ({ value: t.value, label: t.label })) ?? [];
  const attendData = attendance?.trend?.map((t: any) => ({ value: t.value, label: t.label })) ?? [];
  const acadData = academics?.trend?.map((t: any) => ({ value: t.value, label: t.label })) ?? [];
  const highCount = insights.filter((i: any) => i.severity === 'high').length;

  const chartBase = {
    yAxisTextStyle: { color: C.textMute, fontSize: 9 },
    xAxisLabelTextStyle: { color: C.textMute, fontSize: 9 },
    yAxisColor: C.border,
    xAxisColor: C.border,
    rulesColor: C.border,
    width: width - 96,
    isAnimated: true,
    height: 170,
  };

  const handleExport = async () => {
    setExporting(true);
    const url = await exportReport();
    setExporting(false);
    if (url) {
      alertCompat('Report Ready', 'Your PDF is ready.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open', onPress: () => Linking.openURL(url) },
      ]);
    } else {
      alertCompat('Export Failed', 'Please try again.');
    }
  };

  return (
    <View style={[S.container, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={C.bg} />
      <AdminHeader title="Analytics Cockpit" showBackButton rightAction={{
        icon: isDark ? 'sunny-outline' : 'moon-outline',
        onPress: toggleTheme
      }} />

      {/* ── Hero Stats + Controls ───────────────────────────────── */}
      <View style={[S.hero, { backgroundColor: C.surface, borderBottomColor: C.border, borderBottomWidth: 1 }]}>
        <View style={S.heroRow}>
          <HeroKPI label="Fee Collected"
            value={financials ? `₹${(financials.total_collected / 1000).toFixed(1)}k` : '--'}
            sub={financials ? `${financials.collection_efficiency}% efficiency` : undefined}
            color={C.green} delay={60} />
          <HeroKPI label="Avg Attendance"
            value={attendance?.avg_attendance != null ? `${attendance.avg_attendance}%` : '—'}
            sub={attendance ? `${attendance.chronic_absentees} at-risk` : undefined}
            color={C.blue} delay={110} />
          <HeroKPI label="Avg Score"
            value={academics ? `${academics.avg_score}%` : '--'}
            sub={academics ? `${academics.pass_rate}% pass` : undefined}
            color={C.violet} delay={160} />
        </View>

        <View style={S.controlRow}>
          <View style={S.rangeGroup}>
            {RANGES.map(r => (
              <TouchableOpacity key={r.key} activeOpacity={0.7}
                style={[S.rangeBtn, { backgroundColor: C.bg, borderColor: C.border }, range === r.key && { backgroundColor: C.cyanDim, borderColor: C.cyan + '60' }]}
                onPress={() => setRange(r.key)}>
                {range === r.key && <View style={[S.rangeDot, { backgroundColor: C.cyan }]} />}
                <Text style={[S.rangeTxt, { color: range === r.key ? C.cyan : C.textMute }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[S.exportBtn, { backgroundColor: C.amberDim, borderColor: C.amber + '50' }]} onPress={handleExport} activeOpacity={0.7}>
            <Ionicons name={exporting ? 'hourglass-outline' : 'share-outline'} size={13} color={C.amber} />
            <Text style={[S.exportTxt, { color: C.amber }]}>{exporting ? 'Exporting…' : 'Export'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Section Nav ────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={[S.navBar, { borderBottomColor: C.border }]} contentContainerStyle={{ paddingHorizontal: 8 }}>
        {SECTIONS.map((sec: any) => {
          const active = activeSection === sec.key;
          return (
            <TouchableOpacity key={sec.key} activeOpacity={0.7}
              style={[S.navTab, active && { borderBottomColor: sec.color, borderBottomWidth: 2 }]}
              onPress={() => setActiveSection(sec.key)}>
              <Ionicons name={sec.icon as any} size={13}
                color={active ? sec.color : C.textMute} />
              <Text style={[S.navTxt, { color: active ? sec.color : C.textMute }]}>{sec.label}</Text>
              {sec.key === 'finance' && highCount > 0 && (
                <View style={[S.badge, { backgroundColor: C.red }]}>
                  <Text style={S.badgeTxt}>{highCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Scroll Body ────────────────────────────────────────── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={S.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshData}
            tintColor={C.cyan} colors={[C.cyan]} />
        }>

        {loading && !refreshing && (
          <View style={[S.loadRow, { backgroundColor: C.surfaceHigh, borderColor: C.border, borderWidth: 1 }]}>
            <LogoLoader size={22} color={C.cyan} />
            <Text style={[S.loadTxt, { color: C.textSub }]}>Loading analytics…</Text>
          </View>
        )}

        {error && <ErrorBanner msg={error} onRetry={refreshData} />}

        {generatedAt && (
          <Text style={[S.updatedTxt, { color: C.textMute }]}>
            Updated {new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}

        {/* ══════════════ OVERVIEW ══════════════ */}
        {activeSection === 'overview' && (
          <>
            <SHeader label="Financial Health" accent={C.green} icon="wallet-outline" delay={0} />
            <View style={S.row2}>
              <StatCard icon="wallet-outline" color={C.green} delay={60}
                label="Collected" value={financials ? `₹${(financials.total_collected / 1000).toFixed(1)}k` : '--'}
                delta="+8.2%" deltaPos />
              <StatCard icon="alert-circle-outline" color={C.red} delay={90}
                label="Outstanding" value={financials ? `₹${(financials.outstanding_dues / 1000).toFixed(1)}k` : '--'}
                delta="-3.1%" deltaPos />
            </View>

            <SHeader label="Attendance" accent={C.blue} icon="people-outline" delay={120} />
            <View style={S.row2}>
              <StatCard icon="people-outline" color={C.blue} delay={150}
                label="Avg Attendance" value={attendance?.avg_attendance != null ? `${attendance.avg_attendance}%` : '—'} />
              <StatCard icon="warning-outline" color={C.amber} delay={180}
                label="At Risk" value={attendance ? String(attendance.chronic_absentees) : '--'} />
            </View>

            <SHeader label="Academic" accent={C.violet} icon="school-outline" delay={210} />
            <View style={S.row2}>
              <StatCard icon="ribbon-outline" color={C.violet} delay={240}
                label="Avg Score" value={academics ? `${academics.avg_score}%` : '--'} />
              <StatCard icon="checkmark-circle-outline" color={C.green} delay={270}
                label="Pass Rate" value={academics ? `${academics.pass_rate}%` : '--'} />
            </View>

            {insights.length > 0 && (
              <>
                <SHeader label="Active Alerts" accent={C.red} icon="notifications-outline" delay={300} />
                <Animated.View entering={FadeInDown.delay(320).duration(400)}
                  style={[S.alertBox, {
                    borderColor: highCount > 0 ? C.red + '40' : C.border,
                    backgroundColor: highCount > 0 ? C.redDim : C.surfaceHigh,
                  }]}>
                  <Ionicons name="alert-circle" size={20} color={highCount > 0 ? C.red : C.textSub} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>
                      {highCount} High · {insights.length - highCount} Others
                    </Text>
                    <Text style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>
                      Switch to Finance tab to manage
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.textMute} />
                </Animated.View>

                {insights.slice(0, 3).map((ins, i) => (
                  <InsightCard key={ins.id} insight={ins} index={i} onDismiss={dismissInsight} />
                ))}
              </>
            )}
          </>
        )}

        {/* ══════════════ FINANCE ══════════════ */}
        {activeSection === 'finance' && (
          <>
            <SHeader label="Fee Collection" accent={C.green} icon="wallet-outline" delay={0} />
            <StatCard icon="wallet-outline" color={C.green} delay={40}
              label="Total Collected" value={financials ? `₹${(financials.total_collected / 1000).toFixed(1)}k` : '--'}
              sub="Net received" delta="+8.2%" deltaPos />
            <StatCard icon="alert-circle-outline" color={C.red} delay={70}
              label="Outstanding Dues" value={financials ? `₹${(financials.outstanding_dues / 1000).toFixed(1)}k` : '--'}
              sub="Awaiting payment" delta="-3.1%" deltaPos />
            <StatCard icon="trending-up-outline" color={C.cyan} delay={100}
              label="Collection Efficiency" value={financials ? `${financials.collection_efficiency}%` : '--'} />
            <StatCard icon="receipt-outline" color={C.textSub} delay={130}
              label="Total Invoiced" value={financials ? `₹${(financials.total_invoiced / 1000).toFixed(1)}k` : '--'} />
            <StatCard icon="pricetag-outline" color={C.amber} delay={160}
              label="Discounts Given" value={financials ? `₹${(financials.discount_given / 1000).toFixed(1)}k` : '--'} />
            <StatCard icon="return-up-back-outline" color={C.violet} delay={190}
              label="Refunds Issued" value={financials ? `₹${(financials.refunds_issued / 1000).toFixed(1)}k` : '--'} />

            <ChartCard title="Revenue Trend" subtitle={`Rolling ${range}`}
              accentColor={C.green} delay={220} loading={loading}>
              {lineData.length === 0 ? <EmptyChart /> : (
                <LineChart data={lineData} color={C.green} thickness={2.5}
                  startFillColor="rgba(34,211,165,0.25)" endFillColor="rgba(34,211,165,0.01)"
                  startOpacity={1} endOpacity={0} initialSpacing={12} noOfSections={4}
                  dataPointsColor={C.green} dataPointsRadius={4}
                  curved animationDuration={700} {...chartBase} />
              )}
            </ChartCard>

            {financials?.by_class && financials.by_class.length > 0 && (
              <TableCard title="Class-wise Breakdown" delay={280}>
                <THead cols={['Class', 'Collected', 'Pending', '%']} />
                {financials.by_class.map((r, i) => (
                  <TRow key={i}
                    cols={[`${r.class_name} ${r.section_name}`,
                    `₹${(r.collected / 1000).toFixed(1)}k`,
                    `₹${(r.outstanding / 1000).toFixed(1)}k`,
                    `${r.efficiency}%`]}
                    last={i === financials.by_class.length - 1} />
                ))}
              </TableCard>
            )}

            {financials?.top_pending && financials.top_pending.length > 0 && (
              <TableCard title="Top Defaulters" delay={320}>
                <THead cols={['Student', 'Due', 'Days']} />
                {financials.top_pending.map((s: any, i: number) => (
                  <View key={i} style={{
                    paddingVertical: 8,
                    borderBottomWidth: i === financials.top_pending!.length - 1 ? 0 : 1,
                    borderBottomColor: C.border
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: C.text, fontWeight: '600' }}>{s.student_name}</Text>
                      <Text style={{ color: C.red, fontWeight: '700', fontSize: 12 }}>
                        ₹{(s.amount_due / 1000).toFixed(1)}k
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={{ fontSize: 10, color: C.textSub }}>{s.class_section}</Text>
                      <Text style={{ fontSize: 10, color: C.textMute }}>{s.overdue_days}d overdue</Text>
                    </View>
                  </View>
                ))}
              </TableCard>
            )}

            {insights.filter((i: any) => i.category === 'finance').length > 0 && (
              <>
                <SHeader label="Finance Alerts" accent={C.red} icon="notifications-outline" delay={360} />
                {insights.filter((i: any) => i.category === 'finance').map((ins: any, i: number) => (
                  <InsightCard key={ins.id} insight={ins} index={i} onDismiss={dismissInsight} />
                ))}
              </>
            )}
          </>
        )}

        {/* ══════════════ ATTENDANCE ══════════════ */}
        {activeSection === 'attendance' && (
          <>
            <SHeader label="Attendance Summary" accent={C.blue} icon="people-outline" delay={0} />
            <StatCard icon="people-outline" color={C.blue} delay={40}
              label="Avg Student Attendance" value={attendance?.avg_attendance != null ? `${attendance.avg_attendance}%` : '—'}
              delta="+1.4%" deltaPos />
            <StatCard icon="warning-outline" color={C.amber} delay={70}
              label="Chronic Absentees" value={attendance ? String(attendance.chronic_absentees) : '--'}
              sub="Below 75%" />
            <StatCard icon="calendar-outline" color={C.cyan} delay={100}
              label="Working Days" value={attendance?.total_working_days != null ? String(attendance.total_working_days) : '—'}
              sub={attendance ? `${attendance.total_present_days} student-days present` : undefined} />
            <StatCard icon="id-card-outline" color={C.violet} delay={130}
              label="Staff Attendance" value={attendance?.staff_attendance != null ? `${attendance.staff_attendance}%` : '—'} />

            <ChartCard title="Attendance Trend" subtitle="Day-by-day presence %"
              accentColor={C.blue} delay={160} loading={loading}>
              {attendData.length === 0 ? <EmptyChart /> : (
                <BarChart data={attendData} barWidth={16} barBorderRadius={4}
                  frontColor={C.blue} gradientColor="rgba(96,165,250,0.2)" showGradient
                  noOfSections={4} maxValue={100} animationDuration={600} {...chartBase} />
              )}
            </ChartCard>

            {attendance?.by_class && attendance.by_class.length > 0 && (
              <TableCard title="Class-wise Attendance" delay={240}>
                <THead cols={['Class', 'Avg%', 'Risk']} />
                {attendance.by_class.map((r: any, i: number) => (
                  <View key={i} style={{
                    paddingVertical: 9,
                    borderBottomWidth: i === attendance.by_class.length - 1 ? 0 : 1,
                    borderBottomColor: C.border
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ fontSize: 12, color: C.text, fontWeight: '600', flex: 2 }}>
                        {r.class_name} {r.section_name}
                      </Text>
                      <Text style={{
                        fontSize: 12, fontWeight: '800',
                        color: r.avg_pct < 75 ? C.red : C.green
                      }}>{r.avg_pct}%</Text>
                      <Text style={{ fontSize: 11, color: C.textMute, textAlign: 'right', flex: 1 }}>
                        {r.below_threshold}
                      </Text>
                    </View>
                    <ProgressBar value={r.avg_pct} color={r.avg_pct < 75 ? C.red : C.blue} />
                  </View>
                ))}
              </TableCard>
            )}

            {attendance?.low_attendance_students && attendance.low_attendance_students.length > 0 && (
              <TableCard title="Students Needing Attention" delay={290}>
                {attendance.low_attendance_students.map((s: any, i: number) => (
                  <View key={i} style={{
                    paddingVertical: 9,
                    borderBottomWidth: i === attendance.low_attendance_students!.length - 1 ? 0 : 1,
                    borderBottomColor: C.border
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={{ fontSize: 12, color: C.text, fontWeight: '600' }}>{s.student_name}</Text>
                      <Text style={{ fontSize: 12, color: C.red, fontWeight: '800' }}>{s.attendance_pct}%</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ fontSize: 10, color: C.textSub }}>{s.class_section}</Text>
                      <Text style={{ fontSize: 10, color: C.textMute }}>{s.absent_days} absent days</Text>
                    </View>
                    <ProgressBar value={s.attendance_pct} color={C.red} />
                  </View>
                ))}
              </TableCard>
            )}

            {insights.filter((i: any) => i.category === 'attendance').map((ins: any, i: number) => (
              <InsightCard key={ins.id} insight={ins} index={i} onDismiss={dismissInsight} />
            ))}
          </>
        )}

        {/* ══════════════ ACADEMIC ══════════════ */}
        {activeSection === 'academic' && (
          <>
            <SHeader label="Academic Performance" accent={C.violet} icon="school-outline" delay={0} />
            <StatCard icon="ribbon-outline" color={C.violet} delay={40}
              label="Average Score" value={academics ? `${academics.avg_score}%` : '--'} />
            <StatCard icon="checkmark-circle-outline" color={C.green} delay={70}
              label="Pass Rate" value={academics ? `${academics.pass_rate}%` : '--'} />
            <StatCard icon="document-text-outline" color={C.cyan} delay={100}
              label="Exams Conducted" value={academics ? String(academics.exams_conducted) : '--'} />
            <StatCard icon="trending-up-outline" color={C.green} delay={130}
              label="Top Subject" value={academics?.top_subject ?? '--'} />
            <StatCard icon="trending-down-outline" color={C.red} delay={160}
              label="Needs Focus" value={academics?.weakest_subject ?? '--'} />

            <ChartCard title="Score Trend" subtitle="Exam averages over time"
              accentColor={C.violet} delay={190} loading={loading}>
              {acadData.length === 0 ? <EmptyChart /> : (
                <LineChart data={acadData} color={C.violet} thickness={2.5}
                  startFillColor="rgba(167,139,250,0.25)" endFillColor="rgba(167,139,250,0.01)"
                  startOpacity={1} endOpacity={0} initialSpacing={12} noOfSections={4}
                  dataPointsColor={C.violet} dataPointsRadius={4}
                  curved animationDuration={700} {...chartBase} />
              )}
            </ChartCard>

            {academics?.by_subject && academics.by_subject.length > 0 && (
              <TableCard title="Subject Performance" delay={260}>
                <THead cols={['Subject', 'Avg', 'Pass%', 'High']} />
                {academics.by_subject.map((r, i) => (
                  <TRow key={i}
                    cols={[r.subject_name, `${r.avg_score}`, `${r.pass_rate}%`, `${r.highest}`]}
                    last={i === academics.by_subject.length - 1} />
                ))}
              </TableCard>
            )}

            {insights.filter((i: any) => i.category === 'academic').map((ins: any, i: number) => (
              <InsightCard key={ins.id} insight={ins} index={i} onDismiss={dismissInsight} />
            ))}
          </>
        )}

        {/* ══════════════ STAFF ══════════════ */}
        {activeSection === 'staff' && (
          <>
            <SHeader label="Staff Overview" accent={C.amber} icon="id-card-outline" delay={0} />
            <StatCard icon="people-circle-outline" color={C.amber} delay={40}
              label="Total Staff" value={staff ? String(staff.total_staff) : '--'} />
            <StatCard icon="checkmark-done-outline" color={C.green} delay={70}
              label="Active Staff" value={staff ? String(staff.active_staff) : '--'} />
            <StatCard icon="moon-outline" color={C.red} delay={100}
              label="On Leave Today" value={staff ? String(staff.on_leave_today) : '--'} />
            <StatCard icon="calendar-outline" color={C.blue} delay={130}
              label="Staff Attendance" value={staff ? `${staff.avg_staff_attendance}%` : '--'} />
            <StatCard icon="person-add-outline" color={C.cyan} delay={160}
              label="New Joinings" value={staff ? String(staff.new_joinings) : '--'}
              sub={`This ${range}`} />
            <StatCard icon="person-remove-outline" color={C.violet} delay={190}
              label="Resignations" value={staff ? String(staff.resignations) : '--'}
              sub={`This ${range}`} />

            {insights.filter(i => i.category === 'staff').map((ins, i) => (
              <InsightCard key={ins.id} insight={ins} index={i} onDismiss={dismissInsight} />
            ))}
          </>
        )}

        <View style={{ height: 70 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container: { flex: 1 },

  hero: {
    paddingBottom: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },
  heroRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  controlRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  rangeGroup: { flex: 1, flexDirection: 'row', gap: 6 },
  rangeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 7, borderRadius: 8, borderWidth: 1
  },
  rangeDot: { width: 5, height: 5, borderRadius: 3 },
  rangeTxt: { fontSize: 11, fontWeight: '700' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1
  },
  exportTxt: { fontSize: 11, fontWeight: '700' },

  navBar: { borderBottomWidth: 1, maxHeight: 44 },
  navTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 2, borderBottomColor: 'transparent'
  },
  navTxt: { fontSize: 12, fontWeight: '700' },
  badge: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#F43F5E',
    alignItems: 'center', justifyContent: 'center'
  },
  badgeTxt: { fontSize: 9, fontWeight: '900', color: '#fff' },

  body: { padding: 14 },
  loadRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 10, borderRadius: 8, marginBottom: 12,
    borderWidth: 1
  },
  loadTxt: { fontSize: 12, fontWeight: '500' },
  updatedTxt: { fontSize: 10, textAlign: 'right', marginBottom: 4 },
  row2: { flexDirection: 'row', gap: 8 },
  alertBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1
  },
});
