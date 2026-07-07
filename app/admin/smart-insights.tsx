import React, { useState, useMemo, useEffect, useRef } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated as RNAnimated,
  RefreshControl as RNRefreshControl,
  Platform,
  Share,
} from 'react-native';
import * as Print from 'expo-print';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { copyToClipboard } from '../../src/utils/copyToClipboard';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AdminHeader from '../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../src/constants/adminTheme';
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeInUp,
  SlideInLeft,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { AdminService, StudentRiskProfile, HeatmapData } from '../../src/services/adminService';
import { StudentService } from '../../src/services/studentService';
import type { Student } from '../../src/types/models';
import { useTheme } from '../../src/hooks/useTheme';
import LogoLoader from '../../src/components/LogoLoader';

const { width } = Dimensions.get('window');

type RiskLevel = 'SAFE' | 'WARNING' | 'CRITICAL';
type TabType = 'RISK' | 'TALKING_POINTS' | 'HEATMAP';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const COLORS = {
  critical: { bg: '#FFF1F2', border: '#FECDD3', text: '#BE123C', dot: '#F43F5E', glow: '#F43F5E22' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', dot: '#F59E0B', glow: '#F59E0B22' },
  safe: { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', dot: '#22C55E', glow: '#22C55E22' },
  surface: '#FFFFFF',
  bg: '#F6F8FB',
  border: '#E8EDF5',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  primary: ADMIN_THEME.colors.primary?.substring(0, 7) || '#6366F1',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRiskConfig = (level: RiskLevel) => COLORS[level.toLowerCase() as 'safe' | 'warning' | 'critical'] ?? { dot: '#94A3B8', text: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', glow: '#00000011' };

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ─── Animated Progress Bar ────────────────────────────────────────────────────

function AnimatedBar({ value, color, delay = 0 }: { value: number; color: string; delay?: number }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(value, { duration: 900 });
  }, [value]);
  const style = useAnimatedStyle(() => ({ width: `${width.value}%` as any }));
  return (
    <View style={barStyles.track}>
      <Animated.View style={[barStyles.fill, { backgroundColor: color }, style]} />
    </View>
  );
}
const barStyles = StyleSheet.create({
  track: { flex: 1, height: 6, backgroundColor: '#F1F5F9', borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99 },
});

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'RISK', label: 'Risk', icon: 'shield' },
  { id: 'TALKING_POINTS', label: 'Talk', icon: 'message-circle' },
  { id: 'HEATMAP', label: 'Heatmap', icon: 'grid' },
];

function TabBar({ active, onChange }: { active: TabType; onChange: (t: TabType) => void }) {
  return (
    <View style={tabStyles.container}>
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[tabStyles.tab, isActive && tabStyles.tabActive]}
            onPress={() => onChange(tab.id)}
            activeOpacity={0.7}
          >
            {isActive && (
              <LinearGradient
                colors={[COLORS.primary || '#6366F1', '#6366F1']}
                style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
              />
            )}
            <Feather
              name={tab.icon as any}
              size={15}
              color={isActive ? '#FFF' : COLORS.textMuted}
              style={{ marginBottom: 2 }}
            />
            <Text style={[tabStyles.label, isActive && tabStyles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tabActive: {
    borderColor: 'transparent',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  label: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  labelActive: { color: '#FFF', fontWeight: '700' },
});

// ─── Risk Stat Card ───────────────────────────────────────────────────────────

function RiskStatCard({ count, label, config, total, delay }: {
  count: number; label: string; config: typeof COLORS.critical; total: number; delay: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(500)} style={[statStyles.card, { backgroundColor: config.bg, borderColor: config.border }]}>
      <View style={[statStyles.iconWrap, { backgroundColor: config.glow }]}>
        <View style={[statStyles.dot, { backgroundColor: config.dot }]} />
      </View>
      <Text style={[statStyles.count, { color: config.text }]}>{count}</Text>
      <Text style={statStyles.label}>{label}</Text>
      <View style={{ marginTop: 8, width: '100%' }}>
        <AnimatedBar value={pct} color={config.dot} />
        <Text style={[statStyles.pct, { color: config.text }]}>{pct}%</Text>
      </View>
    </Animated.View>
  );
}
const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  count: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  label: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', marginTop: 2 },
  pct: { fontSize: 10, fontWeight: '600', marginTop: 4, textAlign: 'right' },
});

// ─── Student Card ─────────────────────────────────────────────────────────────

function StudentCard({ student, onPress, delay }: { student: StudentRiskProfile; onPress: () => void; delay: number }) {
  const config = getRiskConfig(student.riskLevel);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={SlideInLeft.delay(delay).duration(400)} style={animStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        activeOpacity={1}
      >
        <View style={[cardStyles.card, { borderLeftColor: config.dot, borderLeftWidth: 4 }]}>
          {/* Avatar */}
          <View style={[cardStyles.avatar, { backgroundColor: config.glow, borderColor: config.border }]}>
            <Text style={[cardStyles.avatarText, { color: config.text }]}>{getInitials(student.name)}</Text>
          </View>

          {/* Info */}
          <View style={cardStyles.info}>
            <Text style={cardStyles.name} numberOfLines={1}>{student.name}</Text>
            <View style={cardStyles.metaRow}>
              <View style={[cardStyles.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
                <View style={[cardStyles.badgeDot, { backgroundColor: config.dot }]} />
                <Text style={[cardStyles.badgeText, { color: config.text }]}>{student.riskLevel}</Text>
              </View>
              <Text style={cardStyles.classText}>{student.class}</Text>
            </View>
            <View style={cardStyles.factors}>
              {student.factors.map((f, i) => (
                <View key={i} style={cardStyles.factorChip}>
                  <Text style={cardStyles.factorChipText}>{f}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Arrow */}
          <View style={cardStyles.arrow}>
            <Feather name="chevron-right" size={18} color={COLORS.textMuted} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
  },
  avatarText: { fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  info: { flex: 1 },
  name: { fontWeight: '800', fontSize: 15, color: COLORS.textPrimary, marginBottom: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  classText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  factors: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  factorChip: { backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  factorChipText: { fontSize: 10, color: '#475569', fontWeight: '600' },
  arrow: { padding: 4 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SmartInsights() {
  const { theme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('RISK');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; admissionNo: string } | null>(null);
  const [generatedPoints, setGeneratedPoints] = useState<string[] | null>(null);
  const [insightSource, setInsightSource] = useState<'ai' | 'fallback' | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [riskData, setRiskData] = useState<StudentRiskProfile[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<any>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (activeTab !== 'TALKING_POINTS') return;

    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await StudentService.search(q);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, activeTab]);

  const loadData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [risk, heatmap] = await Promise.all([AdminService.getRiskProfiles(), AdminService.getAcademicHeatmap()]);
      setRiskData(risk);
      setHeatmapData(heatmap);
    } catch {
      alertCompat('Error', 'Failed to load smart insights.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const criticalStudents = useMemo(() => riskData.filter(s => s.riskLevel === 'CRITICAL'), [riskData]);
  const warningStudents = useMemo(() => riskData.filter(s => s.riskLevel === 'WARNING'), [riskData]);
  const safeStudents = useMemo(() => riskData.filter(s => s.riskLevel === 'SAFE'), [riskData]);
  const total = riskData.length;

  const formatStudentName = (student: Student) =>
    student.display_name || `${student.first_name} ${student.last_name}`.trim();

  const fetchTalkingPoints = async (
    student: { id: string; name: string; admissionNo: string },
    queryLabel?: string,
  ) => {
    setSelectedStudent(student);
    if (queryLabel !== undefined) setSearchQuery(queryLabel);
    setSearchResults([]);
    setGeneratedPoints(null);
    setInsightSource(null);
    const result = await AdminService.generateTalkingPoints(student.id);
    setGeneratedPoints(result.points);
    setInsightSource(result.source);
  };

  const selectStudentAndGenerate = async (student: Student) => {
    const name = formatStudentName(student);
    setGenerating(true);
    try {
      await fetchTalkingPoints(
        { id: student.id, name, admissionNo: student.admission_no },
        `${name} · #${student.admission_no}`,
      );
    } catch {
      alertCompat('Error', 'Failed to generate talking points.');
      setGeneratedPoints(null);
      setInsightSource(null);
      setSelectedStudent(null);
    } finally {
      setGenerating(false);
    }
  };

  const handleStudentPress = async (studentId: string, name?: string) => {
    setActiveTab('TALKING_POINTS');
    setGenerating(true);
    try {
      await fetchTalkingPoints(
        { id: studentId, name: name || studentId, admissionNo: '' },
        name || studentId,
      );
    } catch {
      // Risk list already validated the student; allow manual retry from search.
    } finally {
      setGenerating(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (generatedPoints || selectedStudent) {
      setGeneratedPoints(null);
      setInsightSource(null);
      setSelectedStudent(null);
    }
  };

  const handleGeneratePoints = async () => {
    const query = searchQuery.trim();
    if (!query) {
      alertCompat('Enter Student', 'Please enter a student name, ID, or admission number.');
      return;
    }
    setGenerating(true);
    try {
      const resolution = await StudentService.resolveSearchQuery(query);
      if (resolution.status === 'found') {
        const student = resolution.student;
        await fetchTalkingPoints(
          {
            id: student.id,
            name: formatStudentName(student),
            admissionNo: student.admission_no,
          },
          `${formatStudentName(student)} · #${student.admission_no}`,
        );
        return;
      }
      if (resolution.status === 'ambiguous') {
        setSearchResults(resolution.students);
        alertCompat(
          'Multiple Matches',
          'Several students match that search. Please select the correct one from the list.',
        );
        return;
      }
      alertCompat('Not Found', 'No student matched that name, ID, or admission number.');
      setGeneratedPoints(null);
      setInsightSource(null);
      setSelectedStudent(null);
      setSearchResults([]);
    } catch {
      alertCompat('Not Found', 'Student not found or analysis failed.');
      setGeneratedPoints(null);
      setInsightSource(null);
      setSelectedStudent(null);
    } finally {
      setGenerating(false);
    }
  };

  const getInsightsTitle = () =>
    insightSource === 'fallback' ? 'Basic Summary' : 'AI Performance Insights';

  const getInsightsStudentLabel = () =>
    selectedStudent
      ? `${selectedStudent.name}${selectedStudent.admissionNo ? ` · #${selectedStudent.admissionNo}` : ''}`
      : searchQuery;

  const getInsightsText = () => {
    if (!generatedPoints) return '';
    const points = generatedPoints.map((point, index) => `${index + 1}. ${point}`).join('\n\n');
    return `${getInsightsTitle()}\n${getInsightsStudentLabel()}\n\n${points}`;
  };

  const buildInsightsPrintHtml = () => {
    if (!generatedPoints) return '';
    const points = generatedPoints
      .map((point, index) => `<li>${escapeHtml(point)}</li>`)
      .join('');
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(getInsightsTitle())}</title>
    <style>
      body { font-family: 'Noto Sans Telugu', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #0f172a; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      .sub { color: #64748b; margin-bottom: 24px; }
      ol { padding-left: 20px; }
      li { margin-bottom: 12px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(getInsightsTitle())}</h1>
    <div class="sub">${escapeHtml(getInsightsStudentLabel())}</div>
    <ol>${points}</ol>
  </body>
</html>`;
  };

  const handleCopyAll = () => {
    if (!generatedPoints) return;
    const text = getInsightsText();
    if (!text) {
      alertCompat('Error', 'No insights to copy.');
      return;
    }
    void copyToClipboard(text).then((copied) => {
      if (copied) {
        alertCompat('Copied', 'Insights copied to clipboard');
        return;
      }
      alertCompat('Error', 'Could not copy insights to clipboard.');
    }).catch(() => {
      alertCompat('Error', 'Could not copy insights to clipboard.');
    });
  };

  const handleShareInsights = async () => {
    if (!generatedPoints) return;
    const text = getInsightsText();
    const title = getInsightsTitle();
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text });
        return;
      }
      await Share.share({ title, message: text });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      try {
        const copied = await copyToClipboard(text);
        if (copied) {
          alertCompat('Copied', 'Share is unavailable here. Insights copied to clipboard instead.');
          return;
        }
      } catch {
        // Fall through to the generic error below.
      }
      alertCompat('Error', 'Could not share insights.');
    }
  };

  const handlePrintInsights = async () => {
    if (!generatedPoints) return;
    try {
      await Print.printAsync({ html: buildInsightsPrintHtml() });
    } catch {
      alertCompat('Error', 'Could not open the print dialog.');
    }
  };

  // ── Risk Dashboard ──────────────────────────────────────────────────────────

  const renderRiskDashboard = () => (
    <Animated.View entering={FadeInDown.duration(400)}>
      {/* Header Banner */}
      <View style={dashStyles.banner}>
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
        />
        <View style={dashStyles.bannerDeco} />
        <Text style={dashStyles.bannerTitle}>Student Risk Overview</Text>
        <Text style={dashStyles.bannerSub}>
          {criticalStudents.length + warningStudents.length} student{criticalStudents.length + warningStudents.length !== 1 ? 's' : ''} need attention
        </Text>
        <View style={dashStyles.totalBadge}>
          <Text style={dashStyles.totalText}>{total} Total</Text>
        </View>
      </View>

      {/* Stat Cards */}
      <View style={dashStyles.statsRow}>
        <RiskStatCard count={criticalStudents.length} label="Critical" config={COLORS.critical} total={total} delay={0} />
        <RiskStatCard count={warningStudents.length} label="Warning" config={COLORS.warning} total={total} delay={80} />
        <RiskStatCard count={safeStudents.length} label="On Track" config={COLORS.safe} total={total} delay={160} />
      </View>

      {/* Student List */}
      <View style={dashStyles.listHeader}>
        <Text style={dashStyles.listTitle}>Needs Attention</Text>
        {(criticalStudents.length + warningStudents.length) > 0 && (
          <View style={dashStyles.countPill}>
            <Text style={dashStyles.countPillText}>{criticalStudents.length + warningStudents.length}</Text>
          </View>
        )}
      </View>

      {criticalStudents.length === 0 && warningStudents.length === 0 ? (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={dashStyles.emptyState}>
          <LinearGradient colors={['#F0FDF4', '#ECFDF5']} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
          <View style={dashStyles.emptyIcon}>
            <Feather name="shield" size={28} color="#22C55E" />
          </View>
          <Text style={dashStyles.emptyTitle}>All Clear!</Text>
          <Text style={dashStyles.emptySub}>No students in critical or warning zones right now.</Text>
        </Animated.View>
      ) : (
        <>
          {criticalStudents.map((s, i) => (
            <StudentCard key={s.id} student={s} onPress={() => handleStudentPress(s.id, s.name)} delay={i * 60} />
          ))}
          {warningStudents.map((s, i) => (
            <StudentCard key={s.id} student={s} onPress={() => handleStudentPress(s.id, s.name)} delay={(criticalStudents.length + i) * 60} />
          ))}
        </>
      )}
    </Animated.View>
  );

  // ── Talking Points ──────────────────────────────────────────────────────────

  const renderTalkingPoints = () => (
    <Animated.View entering={FadeInRight.duration(400)}>
      {/* Tip Card */}
      <View style={tpStyles.tipCard}>
        <LinearGradient
          colors={[`${COLORS.primary || '#6366F1'}15`, `${COLORS.primary || '#6366F1'}05`]}
          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
        />
        <Feather name="info" size={16} color={COLORS.primary} style={{ marginTop: 1 }} />
        <Text style={tpStyles.tipText}>
          Generate AI-powered talking points for parent meetings in seconds. Results are shown in Telugu.
        </Text>
      </View>

      {/* Search Box */}
      <View style={tpStyles.searchWrap}>
        <View style={[tpStyles.searchBox, ds.searchBarWrapper]}>
          <View style={tpStyles.searchIconWrap}>
            <Ionicons name="person-outline" size={18} color={COLORS.primary} />
          </View>
          <AppTextInput
            ref={inputRef}
            style={[ds.inputInChrome, tpStyles.searchInput]}
            placeholder="Name, ID, or admission no. (e.g. Bharath)"
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleGeneratePoints}
            returnKeyType="search"
            autoCapitalize="words"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[tpStyles.generateBtn, generating && { opacity: 0.7 }]}
            onPress={handleGeneratePoints}
            disabled={generating}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[COLORS.primary || '#6366F1', '#6366F1']}
              style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
            />
            {generating
              ? <ActivityIndicator size="small" color="#FFF" />
              : <MaterialCommunityIcons name="magic-staff" size={19} color="#FFF" />
            }
          </TouchableOpacity>
        </View>

        {isSearching && (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 10 }} />
        )}

        {searchResults.length > 0 && !generating && (
          <View style={tpStyles.suggestList}>
            {searchResults.map((student, index) => (
              <TouchableOpacity
                key={student.id}
                style={[
                  tpStyles.suggestItem,
                  index < searchResults.length - 1 && tpStyles.suggestItemBorder,
                ]}
                onPress={() => selectStudentAndGenerate(student)}
                activeOpacity={0.7}
              >
                <View style={tpStyles.suggestAvatar}>
                  <Ionicons name="person-outline" size={14} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={tpStyles.suggestName}>{formatStudentName(student)}</Text>
                  <Text style={tpStyles.suggestMeta}>#{student.admission_no}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Results */}
      {generatedPoints && (
        <Animated.View entering={FadeInDown.duration(500)} style={tpStyles.resultCard}>
          <LinearGradient
            colors={['#FAFBFF', '#F0F4FF']}
            style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
          />
          {/* Result Header */}
          <View style={tpStyles.resultHeader}>
            <View style={tpStyles.resultIconWrap}>
              <MaterialCommunityIcons name="magic-staff" size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={tpStyles.resultTitle}>{insightSource === 'fallback' ? 'Basic Summary' : 'AI Performance Insights'}</Text>
              <Text style={tpStyles.resultSub}>
                {selectedStudent
                  ? `${selectedStudent.name}${selectedStudent.admissionNo ? ` · #${selectedStudent.admissionNo}` : ''}`
                  : searchQuery}
              </Text>
            </View>
            <View style={[tpStyles.aiBadge, insightSource === 'fallback' && { backgroundColor: COLORS.textMuted }]}>
              <Text style={tpStyles.aiBadgeText}>{insightSource === 'fallback' ? 'STATS' : '✦ AI'}</Text>
            </View>
          </View>

          <View style={tpStyles.divider} />

          {/* Points */}
          {generatedPoints.map((point, i) => (
            <Animated.View
              key={i}
              entering={FadeInDown.delay(i * 80).duration(400)}
              style={tpStyles.pointRow}
            >
              <View style={tpStyles.pointNum}>
                <Text style={tpStyles.pointNumText}>{i + 1}</Text>
              </View>
              <Text style={tpStyles.pointText}>{point}</Text>
            </Animated.View>
          ))}

          {/* Actions */}
          <View style={tpStyles.actionRow}>
            <TouchableOpacity style={tpStyles.actionBtn} activeOpacity={0.7} onPress={handleCopyAll}>
              <Feather name="copy" size={14} color={COLORS.primary} />
              <Text style={[tpStyles.actionText, { color: COLORS.primary }]}>Copy All</Text>
            </TouchableOpacity>
            <View style={tpStyles.actionDivider} />
            <TouchableOpacity style={tpStyles.actionBtn} activeOpacity={0.7} onPress={handleShareInsights}>
              <Feather name="share-2" size={14} color={COLORS.textSecondary} />
              <Text style={tpStyles.actionText}>Share</Text>
            </TouchableOpacity>
            <View style={tpStyles.actionDivider} />
            <TouchableOpacity style={tpStyles.actionBtn} activeOpacity={0.7} onPress={handlePrintInsights}>
              <Feather name="printer" size={14} color={COLORS.textSecondary} />
              <Text style={tpStyles.actionText}>Print</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Empty State */}
      {!generatedPoints && !generating && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={tpStyles.emptyPrompt}>
          <MaterialCommunityIcons name="magic-staff" size={40} color={`${COLORS.primary}40`} />
          <Text style={tpStyles.emptyPromptText}>Enter a student ID and tap the wand to generate insights</Text>
        </Animated.View>
      )}
    </Animated.View>
  );

  // ── Heatmap ─────────────────────────────────────────────────────────────────

  const renderHeatmap = () => {
    if (!heatmapData) return <Text style={{ color: COLORS.textMuted, textAlign: 'center', marginTop: 40 }}>No data available.</Text>;

    const getCellConfig = (val: number) => {
      if (val < 70) return { bg: '#FFF1F2', text: '#BE123C', bar: '#F43F5E' };
      if (val < 80) return { bg: '#FFFBEB', text: '#B45309', bar: '#F59E0B' };
      return { bg: '#F0FDF4', text: '#15803D', bar: '#22C55E' };
    };

    return (
      <Animated.View entering={FadeInRight.duration(400)}>
        {/* Section Header */}
        <View style={hmStyles.header}>
          <Text style={hmStyles.headerTitle}>Academic Performance Map</Text>
          <Text style={hmStyles.headerSub}>Compare class performance across subjects</Text>
        </View>

        {/* Grid */}
        <View style={hmStyles.gridWrap}>
          {/* Column Headers */}
          <View style={hmStyles.row}>
            <View style={hmStyles.cornerCell}>
              <Feather name="layers" size={13} color={COLORS.textMuted} />
            </View>
            {heatmapData.subjects.map((sub, i) => (
              <View key={i} style={hmStyles.headerCell}>
                <Text style={hmStyles.headerCellText}>{sub.substring(0, 3).toUpperCase()}</Text>
              </View>
            ))}
          </View>

          {/* Data Rows */}
          {heatmapData.classes.map((cls, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(i * 60).duration(350)} style={hmStyles.row}>
              <View style={hmStyles.labelCell}>
                <Text style={hmStyles.labelText}>{cls}</Text>
              </View>
              {heatmapData.subjects.map((sub, j) => {
                const val = heatmapData.data[cls][sub];
                const cfg = getCellConfig(val);
                return (
                  <View key={j} style={[hmStyles.cell, { backgroundColor: cfg.bg }]}>
                    <Text style={[hmStyles.cellValue, { color: cfg.text }]}>{val}</Text>
                    <View style={hmStyles.cellBar}>
                      <View style={[hmStyles.cellBarFill, { width: `${val}%` as any, backgroundColor: cfg.bar }]} />
                    </View>
                  </View>
                );
              })}
            </Animated.View>
          ))}
        </View>

        {/* Legend */}
        <View style={hmStyles.legend}>
          {[
            { label: '< 70  Weak', bg: '#FFF1F2', border: '#FECDD3', dot: '#F43F5E' },
            { label: '70–80  Avg', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
            { label: '> 80  Strong', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
          ].map((l, i) => (
            <View key={i} style={[hmStyles.legendItem, { backgroundColor: l.bg, borderColor: l.border }]}>
              <View style={[hmStyles.legendDot, { backgroundColor: l.dot }]} />
              <Text style={hmStyles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
        <LogoLoader size={60} color={COLORS.primary || '#6366F1'} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {/* Subtle mesh background */}
      <LinearGradient
        colors={['#EEF2FF', '#F6F8FB', '#F6F8FB']}
        style={StyleSheet.absoluteFill}
      />

      <AdminHeader title="Smart Insights" showBackButton />
      <TabBar active={activeTab} onChange={setActiveTab} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RNRefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData(true);
            }}
            colors={[COLORS.primary || '#6366F1']}
            tintColor={COLORS.primary || '#6366F1'}
          />
        }
      >
        {activeTab === 'RISK' && renderRiskDashboard()}
        {activeTab === 'TALKING_POINTS' && renderTalkingPoints()}
        {activeTab === 'HEATMAP' && renderHeatmap()}
      </ScrollView>
    </View>
  );
}

// ─── Section Styles ──────────────────────────────────────────────────────────

const dashStyles = StyleSheet.create({
  banner: {
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerDeco: {
    position: 'absolute', top: -30, right: -30,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#FFFFFF10',
  },
  bannerTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: -0.3 },
  bannerSub: { fontSize: 13, color: '#94A3B8', marginTop: 4, fontWeight: '500' },
  totalBadge: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: '#FFFFFF15', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: '#FFFFFF25' },
  totalText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  listTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  countPill: { backgroundColor: COLORS.critical.bg, borderWidth: 1, borderColor: COLORS.critical.border, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
  countPillText: { fontSize: 12, fontWeight: '800', color: COLORS.critical.text },
  emptyState: {
    alignItems: 'center', paddingVertical: 48,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#BBF7D0', borderStyle: 'dashed',
  },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 24 },
});

const tpStyles = StyleSheet.create({
  tipCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    padding: 14, borderRadius: 14, marginBottom: 20,
    overflow: 'hidden', borderWidth: 1, borderColor: `${COLORS.primary}25`,
  },
  tipText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  searchWrap: { marginBottom: 24 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 18,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingLeft: 14, paddingRight: 10, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 3,
  },
  searchIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: `${COLORS.primary}12`, justifyContent: 'center', alignItems: 'center' },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.textPrimary, fontWeight: '600' },
  generateBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  suggestList: {
    marginTop: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  suggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  suggestAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  suggestMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  resultCard: { borderRadius: 20, padding: 20, overflow: 'hidden', borderWidth: 1, borderColor: `${COLORS.primary}20`, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 3 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  resultIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: `${COLORS.primary}15`, justifyContent: 'center', alignItems: 'center' },
  resultTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  resultSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  aiBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  aiBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 16 },
  pointRow: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  pointNum: { width: 24, height: 24, borderRadius: 8, backgroundColor: `${COLORS.primary}15`, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  pointNumText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  pointText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 22, fontWeight: '500', fontFamily: Platform.OS === 'web' ? 'Noto Sans Telugu, sans-serif' : undefined },
  actionRow: { flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionDivider: { width: 1, height: 18, backgroundColor: COLORS.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6 },
  actionText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  emptyPrompt: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyPromptText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, paddingHorizontal: 32, fontWeight: '500' },
});

const hmStyles = StyleSheet.create({
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  gridWrap: { backgroundColor: COLORS.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 3 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cornerCell: { width: 60, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  headerCell: { flex: 1, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  headerCellText: { fontWeight: '800', fontSize: 11, color: COLORS.textSecondary, letterSpacing: 0.5 },
  labelCell: { width: 60, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', borderRightWidth: 1, borderRightColor: COLORS.border },
  labelText: { fontWeight: '800', fontSize: 11, color: COLORS.textSecondary },
  cell: { flex: 1, height: 52, justifyContent: 'center', alignItems: 'center', gap: 4 },
  cellValue: { fontWeight: '900', fontSize: 14 },
  cellBar: { width: '65%', height: 3, backgroundColor: '#E2E8F0', borderRadius: 99, overflow: 'hidden' },
  cellBarFill: { height: '100%', borderRadius: 99 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
});