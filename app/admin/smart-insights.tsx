import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl as RNRefreshControl,
  Platform,
  Share,
  Pressable,
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
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AdminService, StudentRiskProfile, HeatmapData } from '../../src/services/adminService';
import { StudentService } from '../../src/services/studentService';
import type { Student } from '../../src/types/models';
import { useTheme } from '../../src/hooks/useTheme';
import LogoLoader from '../../src/components/LogoLoader';

type RiskLevel = 'SAFE' | 'WARNING' | 'CRITICAL';
type TabType = 'RISK' | 'TALKING_POINTS' | 'HEATMAP';
type RiskFilter = 'ATTENTION' | 'CRITICAL' | 'WARNING' | 'SAFE' | 'ALL';

// ─── Tokens (Mode A — clay world, glass accents; extend ADMIN_THEME) ─────────

const ACCENT = ADMIN_THEME.colors.primary?.substring(0, 7) || '#665990';

const COLORS = {
  critical: { bg: '#FFF0F3', border: '#FECDD8', text: '#BE123C', dot: '#F43F5E', soft: '#FFE4E9' },
  warning: { bg: '#FFF8EB', border: '#FDE68A', text: '#B45309', dot: '#F59E0B', soft: '#FEF3C7' },
  safe: { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857', dot: '#10B981', soft: '#D1FAE5' },
  surface: '#F7F9FD',
  surfaceRaised: '#FFFFFF',
  bg: '#E9EDF6',
  border: 'rgba(102, 89, 144, 0.12)',
  textPrimary: '#1E2433',
  textSecondary: '#5B657A',
  textMuted: '#8B95A8',
  primary: ACCENT,
  clayEdge: 'rgba(76, 90, 120, 0.10)',
};

const shadowClay = Platform.select({
  ios: {
    shadowColor: '#6B7A99',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },
  android: { elevation: 4 },
  default: {},
}) as object;

const shadowFlat = Platform.select({
  ios: {
    shadowColor: '#6B7A99',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  android: { elevation: 1 },
  default: {},
}) as object;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRiskConfig = (level: RiskLevel) =>
  COLORS[level.toLowerCase() as 'safe' | 'warning' | 'critical'] ?? COLORS.safe;

const getInitials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ─── PressScale ───────────────────────────────────────────────────────────────

function PressScale({
  children,
  onPress,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      disabled={disabled || !onPress}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 16, stiffness: 280 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      style={style}
    >
      <Animated.View style={[anim, style?.flex != null ? { flex: style.flex } : null]}>{children}</Animated.View>
    </Pressable>
  );
}

// ─── Clay surface ─────────────────────────────────────────────────────────────

function ClaySurface({
  children,
  color = COLORS.surfaceRaised,
  radius = 22,
  flat,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  radius?: number;
  flat?: boolean;
  style?: any;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: color,
          borderRadius: radius,
          overflow: 'hidden',
          borderBottomWidth: 1.5,
          borderBottomColor: COLORS.clayEdge,
        },
        !flat && shadowClay,
        style,
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.55, y: 0.95 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

// ─── Animated Progress Bar ────────────────────────────────────────────────────

function AnimatedBar({ value, color }: { value: number; color: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(100, value)), { duration: 700 });
  }, [value]);
  const style = useAnimatedStyle(() => ({ width: `${w.value}%` as any }));
  return (
    <View style={barStyles.track}>
      <Animated.View style={[barStyles.fill, { backgroundColor: color }, style]} />
    </View>
  );
}
const barStyles = StyleSheet.create({
  track: { height: 5, backgroundColor: 'rgba(15,23,42,0.06)', borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99 },
});

// ─── Mini sparkline ───────────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const pts = (values?.length ? values : [0, 0, 0, 0, 0]).slice(-5);
  const max = Math.max(...pts, 1);
  return (
    <View style={spark.row}>
      {pts.map((v, i) => {
        const h = Math.max(3, Math.round((v / max) * 18));
        return (
          <View key={i} style={spark.col}>
            <View style={[spark.bar, { height: h, backgroundColor: color, opacity: 0.35 + (i / pts.length) * 0.65 }]} />
          </View>
        );
      })}
    </View>
  );
}
const spark = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 18 },
  col: { width: 4, height: 18, justifyContent: 'flex-end' },
  bar: { width: 4, borderRadius: 2 },
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
          <PressScale key={tab.id} onPress={() => onChange(tab.id)} style={{ flex: 1 }}>
            <View style={[tabStyles.tab, isActive && tabStyles.tabActive]}>
              {isActive && (
                <LinearGradient
                  colors={[ACCENT, '#7B6BA8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                />
              )}
              {isActive && (
                <LinearGradient
                  colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                  pointerEvents="none"
                />
              )}
              <Feather
                name={tab.icon as any}
                size={15}
                color={isActive ? '#FFF' : COLORS.textMuted}
                style={{ marginBottom: 3 }}
              />
              <Text style={[tabStyles.label, isActive && tabStyles.labelActive]}>{tab.label}</Text>
            </View>
          </PressScale>
        );
      })}
    </View>
  );
}
const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  tab: {
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.clayEdge,
    ...shadowFlat,
  },
  tabActive: {
    borderColor: 'transparent',
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  label: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.2 },
  labelActive: { color: '#FFF', fontWeight: '700' },
});

// ─── Risk Stat Card (also acts as filter) ─────────────────────────────────────

function RiskStatCard({
  count,
  label,
  config,
  total,
  delay,
  selected,
  onPress,
}: {
  count: number;
  label: string;
  config: typeof COLORS.critical;
  total: number;
  delay: number;
  selected: boolean;
  onPress: () => void;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(320)} style={{ flex: 1 }}>
      <PressScale onPress={onPress} style={{ flex: 1 }}>
        <View
          style={[
            statStyles.card,
            {
              backgroundColor: config.bg,
              borderColor: selected ? config.dot : config.border,
              borderWidth: selected ? 2 : 1.5,
              flex: 1,
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={statStyles.topRow}>
            <View style={[statStyles.dotWrap, { backgroundColor: config.soft }]}>
              <View style={[statStyles.dot, { backgroundColor: config.dot }]} />
            </View>
            {selected && (
              <Feather name="check" size={12} color={config.text} />
            )}
          </View>
          <Text style={[statStyles.count, { color: config.text }]}>{count}</Text>
          <Text style={[statStyles.label, { color: config.text }]}>{label}</Text>
          <View style={{ marginTop: 10, width: '100%' }}>
            <AnimatedBar value={pct} color={config.dot} />
            <Text style={[statStyles.pct, { color: config.text }]}>{pct}%</Text>
          </View>
        </View>
      </PressScale>
    </Animated.View>
  );
}
const statStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 12,
    minHeight: 118,
    overflow: 'hidden',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.clayEdge,
    ...shadowFlat,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  dotWrap: { width: 26, height: 26, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  count: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8, lineHeight: 32 },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2, opacity: 0.85 },
  pct: { fontSize: 10, fontWeight: '700', marginTop: 5, textAlign: 'right', opacity: 0.8 },
});

// ─── Student Card ─────────────────────────────────────────────────────────────

const StudentCard = memo(function StudentCard({
  student,
  onPress,
  animate,
}: {
  student: StudentRiskProfile;
  onPress: () => void;
  animate: boolean;
}) {
  const config = getRiskConfig(student.riskLevel);
  const score = student.riskScore ?? (student.riskLevel === 'CRITICAL' ? 70 : student.riskLevel === 'WARNING' ? 30 : 5);
  const att = student.attendancePct;

  const body = (
    <PressScale onPress={onPress}>
      <View style={[cardStyles.card, { borderLeftColor: config.dot }]}>
        <View style={cardStyles.mainRow}>
          <View style={[cardStyles.avatar, { backgroundColor: config.soft, borderColor: config.border }]}>
            <Text style={[cardStyles.avatarText, { color: config.text }]}>{getInitials(student.name)}</Text>
          </View>

          <View style={cardStyles.info}>
            <View style={cardStyles.nameRow}>
              <Text style={cardStyles.name} numberOfLines={1}>
                {student.name}
              </Text>
              <View style={[cardStyles.scorePill, { backgroundColor: config.bg, borderColor: config.border }]}>
                <Text style={[cardStyles.scoreText, { color: config.text }]}>{score}</Text>
              </View>
            </View>

            <View style={cardStyles.metaRow}>
              <View style={[cardStyles.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
                <View style={[cardStyles.badgeDot, { backgroundColor: config.dot }]} />
                <Text style={[cardStyles.badgeText, { color: config.text }]}>{student.riskLevel}</Text>
              </View>
              <Text style={cardStyles.classText} numberOfLines={1}>
                {student.class}
              </Text>
            </View>

            <View style={cardStyles.metricsRow}>
              {typeof att === 'number' && (
                <View style={cardStyles.metricChip}>
                  <Feather name="calendar" size={10} color={COLORS.textSecondary} />
                  <Text style={cardStyles.metricText}>{att}%</Text>
                </View>
              )}
              <Sparkline values={student.trend} color={config.dot} />
            </View>

            {(student.primaryFactor || student.factors?.[0]) && (
              <Text style={cardStyles.reason} numberOfLines={1}>
                {student.primaryFactor || student.factors[0]}
                {student.factors?.length > 1 ? ` · +${student.factors.length - 1}` : ''}
              </Text>
            )}
          </View>
        </View>

        <View style={cardStyles.footer}>
          <Text style={cardStyles.reco} numberOfLines={1}>
            {student.recommendation || 'Open for talking points'}
          </Text>
          <View style={[cardStyles.talkBtn, { backgroundColor: `${ACCENT}14` }]}>
            <MaterialCommunityIcons name="magic-staff" size={13} color={ACCENT} />
            <Text style={[cardStyles.talkText, { color: ACCENT }]}>Talk</Text>
            <Feather name="chevron-right" size={12} color={ACCENT} />
          </View>
        </View>
      </View>
    </PressScale>
  );

  if (!animate) return <View style={{ marginBottom: 10 }}>{body}</View>;
  return (
    <Animated.View entering={FadeInDown.duration(280)} style={{ marginBottom: 10 }}>
      {body}
    </Animated.View>
  );
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.clayEdge,
    ...shadowFlat,
  },
  mainRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  avatarText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  name: { flex: 1, fontWeight: '800', fontSize: 15, color: COLORS.textPrimary, letterSpacing: -0.2 },
  scorePill: {
    minWidth: 28,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  scoreText: { fontSize: 11, fontWeight: '800', letterSpacing: -0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  classText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  metricsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F4F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  metricText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  reason: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  footer: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reco: { flex: 1, fontSize: 11, color: COLORS.textSecondary, fontWeight: '500', lineHeight: 15 },
  talkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    minHeight: 32,
  },
  talkText: { fontSize: 12, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SmartInsights() {
  useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('RISK');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ATTENTION');
  const [riskSearch, setRiskSearch] = useState('');
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

  useEffect(() => {
    loadData();
  }, []);

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

  const criticalStudents = useMemo(() => riskData.filter((s) => s.riskLevel === 'CRITICAL'), [riskData]);
  const warningStudents = useMemo(() => riskData.filter((s) => s.riskLevel === 'WARNING'), [riskData]);
  const safeStudents = useMemo(() => riskData.filter((s) => s.riskLevel === 'SAFE'), [riskData]);
  const attentionCount = criticalStudents.length + warningStudents.length;
  const total = riskData.length;

  const filteredStudents = useMemo(() => {
    let list: StudentRiskProfile[];
    switch (riskFilter) {
      case 'CRITICAL':
        list = criticalStudents;
        break;
      case 'WARNING':
        list = warningStudents;
        break;
      case 'SAFE':
        list = safeStudents;
        break;
      case 'ALL':
        list = riskData;
        break;
      default:
        list = [...criticalStudents, ...warningStudents];
    }
    const q = riskSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.class.toLowerCase().includes(q) ||
        (s.primaryFactor || '').toLowerCase().includes(q) ||
        s.factors.some((f) => f.toLowerCase().includes(q)),
    );
  }, [riskFilter, riskSearch, criticalStudents, warningStudents, safeStudents, riskData]);

  const topPriority = filteredStudents[0];

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

  const handleStudentPress = useCallback(async (studentId: string, name?: string) => {
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
  }, []);

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

  const getInsightsTitle = () => (insightSource === 'fallback' ? 'Basic Summary' : 'AI Performance Insights');

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
    const points = generatedPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('');
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
    void copyToClipboard(text)
      .then((copied) => {
        if (copied) {
          alertCompat('Copied', 'Insights copied to clipboard');
          return;
        }
        alertCompat('Error', 'Could not copy insights to clipboard.');
      })
      .catch(() => {
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
        // Fall through
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

  const toggleStatFilter = (key: RiskFilter) => {
    setRiskFilter((prev) => (prev === key ? 'ATTENTION' : key));
  };

  const listTitle =
    riskFilter === 'CRITICAL'
      ? 'Critical'
      : riskFilter === 'WARNING'
        ? 'Warning'
        : riskFilter === 'SAFE'
          ? 'On Track'
          : riskFilter === 'ALL'
            ? 'All Students'
            : 'Priority Queue';

  const listCountTone =
    riskFilter === 'SAFE'
      ? COLORS.safe
      : riskFilter === 'WARNING'
        ? COLORS.warning
        : riskFilter === 'ALL'
          ? { bg: `${ACCENT}12`, border: `${ACCENT}30`, text: ACCENT }
          : COLORS.critical;

  // ── Risk Dashboard ──────────────────────────────────────────────────────────

  const renderRiskDashboard = () => (
    <View>
      <Animated.View entering={FadeInDown.duration(320)}>
        <ClaySurface color="#2A3148" radius={24} style={dashStyles.banner}>
          <LinearGradient
            colors={['#3D4563', '#252B3D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={dashStyles.bannerDeco} />
          <View style={dashStyles.bannerDeco2} />

          <View style={dashStyles.bannerTop}>
            <View style={dashStyles.livePill}>
              <View style={dashStyles.liveDot} />
              <Text style={dashStyles.liveText}>Live risk score</Text>
            </View>
            <PressScale
              onPress={() => setRiskFilter('ALL')}
              style={dashStyles.totalBadge}
            >
              <Text style={dashStyles.totalText}>{total} students</Text>
            </PressScale>
          </View>

          <Text style={dashStyles.bannerTitle}>
            {attentionCount === 0 ? 'Everyone looks healthy' : `${attentionCount} need your attention`}
          </Text>
          <Text style={dashStyles.bannerSub}>
            Ranked by attendance, academics, behaviour & mark trends — highest urgency first.
          </Text>

          {topPriority && attentionCount > 0 && riskFilter === 'ATTENTION' && !riskSearch && (
            <PressScale onPress={() => handleStudentPress(topPriority.id, topPriority.name)}>
              <View style={dashStyles.nextUp}>
                <View style={{ flex: 1 }}>
                  <Text style={dashStyles.nextLabel}>Start here</Text>
                  <Text style={dashStyles.nextName} numberOfLines={1}>
                    {topPriority.name}
                  </Text>
                  <Text style={dashStyles.nextReason} numberOfLines={1}>
                    {topPriority.primaryFactor || topPriority.factors[0]}
                  </Text>
                </View>
                <View style={dashStyles.nextCta}>
                  <Text style={dashStyles.nextCtaText}>Open</Text>
                  <Feather name="arrow-right" size={14} color="#FFF" />
                </View>
              </View>
            </PressScale>
          )}
        </ClaySurface>
      </Animated.View>

      <View style={dashStyles.statsRow}>
        <RiskStatCard
          count={criticalStudents.length}
          label="Critical"
          config={COLORS.critical}
          total={total}
          delay={40}
          selected={riskFilter === 'CRITICAL'}
          onPress={() => toggleStatFilter('CRITICAL')}
        />
        <RiskStatCard
          count={warningStudents.length}
          label="Warning"
          config={COLORS.warning}
          total={total}
          delay={90}
          selected={riskFilter === 'WARNING'}
          onPress={() => toggleStatFilter('WARNING')}
        />
        <RiskStatCard
          count={safeStudents.length}
          label="On Track"
          config={COLORS.safe}
          total={total}
          delay={140}
          selected={riskFilter === 'SAFE'}
          onPress={() => toggleStatFilter('SAFE')}
        />
      </View>

      <View style={dashStyles.filterRow}>
        {(
          [
            { id: 'ATTENTION' as RiskFilter, label: 'Needs help' },
            { id: 'ALL' as RiskFilter, label: 'Everyone' },
          ] as const
        ).map((chip) => {
          const on = riskFilter === chip.id;
          return (
            <PressScale key={chip.id} onPress={() => setRiskFilter(chip.id)}>
              <View style={[dashStyles.chip, on && dashStyles.chipOn]}>
                {on && (
                  <LinearGradient
                    colors={[ACCENT, '#7B6BA8']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 99 }]}
                  />
                )}
                <Text style={[dashStyles.chipText, on && dashStyles.chipTextOn]}>{chip.label}</Text>
              </View>
            </PressScale>
          );
        })}
      </View>

      <ClaySurface flat radius={18} style={dashStyles.searchWrap} color={COLORS.surfaceRaised}>
        <Feather name="search" size={16} color={COLORS.textMuted} />
        <AppTextInput
          style={dashStyles.searchInput}
          placeholder="Search name, class, or reason…"
          placeholderTextColor={COLORS.textMuted}
          value={riskSearch}
          onChangeText={setRiskSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {riskSearch.length > 0 && (
          <PressScale onPress={() => setRiskSearch('')}>
            <View style={dashStyles.clearBtn}>
              <Feather name="x" size={14} color={COLORS.textSecondary} />
            </View>
          </PressScale>
        )}
      </ClaySurface>

      <View style={dashStyles.listHeader}>
        <Text style={dashStyles.listTitle}>{listTitle}</Text>
        <View style={[dashStyles.countPill, { backgroundColor: listCountTone.bg, borderColor: listCountTone.border }]}>
          <Text style={[dashStyles.countPillText, { color: listCountTone.text }]}>{filteredStudents.length}</Text>
        </View>
      </View>

      {filteredStudents.length === 0 ? (
        <Animated.View entering={FadeInDown.delay(120).duration(320)} style={dashStyles.emptyState}>
          <LinearGradient colors={['#F0FDF4', '#ECFDF5']} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
          <View style={dashStyles.emptyIcon}>
            <Feather name={riskSearch ? 'search' : 'shield'} size={26} color="#10B981" />
          </View>
          <Text style={dashStyles.emptyTitle}>{riskSearch ? 'No matches' : 'All clear'}</Text>
          <Text style={dashStyles.emptySub}>
            {riskSearch
              ? 'Try another name, class, or risk factor.'
              : 'No students in this view right now. Pull to refresh anytime.'}
          </Text>
          {riskSearch.length > 0 && (
            <PressScale onPress={() => setRiskSearch('')}>
              <View style={dashStyles.emptyBtn}>
                <Text style={dashStyles.emptyBtnText}>Clear search</Text>
              </View>
            </PressScale>
          )}
        </Animated.View>
      ) : (
        filteredStudents.map((item, index) => (
          <StudentCard
            key={item.id}
            student={item}
            animate={index < 8}
            onPress={() => handleStudentPress(item.id, item.name)}
          />
        ))
      )}
    </View>
  );

  // ── Talking Points ──────────────────────────────────────────────────────────

  const renderTalkingPoints = () => (
    <Animated.View entering={FadeInRight.duration(320)}>
      <ClaySurface color={`${ACCENT}10`} radius={18} flat style={tpStyles.tipCard}>
        <View style={[tpStyles.tipIcon, { backgroundColor: `${ACCENT}18` }]}>
          <Feather name="info" size={15} color={ACCENT} />
        </View>
        <Text style={tpStyles.tipText}>
          Generate parent-meeting talking points in seconds. Results appear in Telugu.
        </Text>
      </ClaySurface>

      <ClaySurface radius={20} style={tpStyles.searchWrap}>
        <View style={[tpStyles.searchBox, ds.searchBarWrapper]}>
          <View style={[tpStyles.searchIconWrap, { backgroundColor: `${ACCENT}14` }]}>
            <Ionicons name="person-outline" size={18} color={ACCENT} />
          </View>
          <AppTextInput
            ref={inputRef}
            style={[ds.inputInChrome, tpStyles.searchInput]}
            placeholder="Name, ID, or admission no."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleGeneratePoints}
            returnKeyType="search"
            autoCapitalize="words"
            autoCorrect={false}
          />
          <PressScale onPress={handleGeneratePoints} disabled={generating}>
            <View style={[tpStyles.generateBtn, generating && { opacity: 0.7 }]}>
              <LinearGradient colors={[ACCENT, '#7B6BA8']} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']}
                style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                pointerEvents="none"
              />
              {generating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <MaterialCommunityIcons name="magic-staff" size={19} color="#FFF" />
              )}
            </View>
          </PressScale>
        </View>

        {isSearching && <ActivityIndicator size="small" color={ACCENT} style={{ marginTop: 10 }} />}

        {searchResults.length > 0 && !generating && (
          <View style={tpStyles.suggestList}>
            {searchResults.map((student, index) => (
              <PressScale key={student.id} onPress={() => selectStudentAndGenerate(student)}>
                <View
                  style={[tpStyles.suggestItem, index < searchResults.length - 1 && tpStyles.suggestItemBorder]}
                >
                  <View style={[tpStyles.suggestAvatar, { backgroundColor: `${ACCENT}12` }]}>
                    <Ionicons name="person-outline" size={14} color={ACCENT} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={tpStyles.suggestName}>{formatStudentName(student)}</Text>
                    <Text style={tpStyles.suggestMeta}>#{student.admission_no}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
                </View>
              </PressScale>
            ))}
          </View>
        )}
      </ClaySurface>

      {generatedPoints && (
        <Animated.View entering={FadeInDown.duration(360)}>
          <ClaySurface radius={22} style={tpStyles.resultCard}>
            <View style={tpStyles.resultHeader}>
              <View style={[tpStyles.resultIconWrap, { backgroundColor: `${ACCENT}15` }]}>
                <MaterialCommunityIcons name="magic-staff" size={18} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={tpStyles.resultTitle}>
                  {insightSource === 'fallback' ? 'Basic Summary' : 'AI Performance Insights'}
                </Text>
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

            {generatedPoints.map((point, i) => (
              <Animated.View key={i} entering={FadeInDown.delay(Math.min(i, 6) * 50).duration(280)} style={tpStyles.pointRow}>
                <View style={[tpStyles.pointNum, { backgroundColor: `${ACCENT}15` }]}>
                  <Text style={[tpStyles.pointNumText, { color: ACCENT }]}>{i + 1}</Text>
                </View>
                <Text style={tpStyles.pointText}>{point}</Text>
              </Animated.View>
            ))}

            <View style={tpStyles.actionRow}>
              <TouchableOpacity style={tpStyles.actionBtn} activeOpacity={0.7} onPress={handleCopyAll}>
                <Feather name="copy" size={14} color={ACCENT} />
                <Text style={[tpStyles.actionText, { color: ACCENT }]}>Copy All</Text>
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
          </ClaySurface>
        </Animated.View>
      )}

      {!generatedPoints && !generating && (
        <Animated.View entering={FadeInDown.delay(120).duration(320)} style={tpStyles.emptyPrompt}>
          <View style={[tpStyles.emptyGlyph, { backgroundColor: `${ACCENT}12` }]}>
            <MaterialCommunityIcons name="magic-staff" size={28} color={`${ACCENT}99`} />
          </View>
          <Text style={tpStyles.emptyPromptText}>
            Enter a student and tap the wand — or open someone from the Risk tab.
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );

  // ── Heatmap ─────────────────────────────────────────────────────────────────

  const renderHeatmap = () => {
    if (!heatmapData) {
      return (
        <Text style={{ color: COLORS.textMuted, textAlign: 'center', marginTop: 40, fontWeight: '500' }}>
          No data available.
        </Text>
      );
    }

    const getCellConfig = (val: number) => {
      if (val < 70) return { bg: '#FFF1F2', text: '#BE123C', bar: '#F43F5E' };
      if (val < 80) return { bg: '#FFFBEB', text: '#B45309', bar: '#F59E0B' };
      return { bg: '#F0FDF4', text: '#15803D', bar: '#22C55E' };
    };

    return (
      <Animated.View entering={FadeInRight.duration(320)}>
        <View style={hmStyles.header}>
          <Text style={hmStyles.headerTitle}>Academic Performance Map</Text>
          <Text style={hmStyles.headerSub}>Compare class averages across subjects</Text>
        </View>

        <ClaySurface radius={20} style={{ padding: 0 }}>
          <View style={hmStyles.gridWrap}>
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

            {heatmapData.classes.map((cls, i) => (
              <Animated.View key={i} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(280)} style={hmStyles.row}>
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
        </ClaySurface>

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg }}>
        <LogoLoader size={60} color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <LinearGradient colors={['#E4E9F5', COLORS.bg, '#EEF1F8']} style={StyleSheet.absoluteFill} />

      <AdminHeader title="Smart Insights" showBackButton />
      <TabBar active={activeTab} onChange={setActiveTab} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 72 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RNRefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData(true);
            }}
            colors={[ACCENT]}
            tintColor={ACCENT}
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
  banner: { padding: 20, marginBottom: 14 },
  bannerDeco: {
    position: 'absolute',
    top: -36,
    right: -28,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  bannerDeco2: {
    position: 'absolute',
    bottom: -40,
    left: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(102,89,144,0.25)',
  },
  bannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' },
  liveText: { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
  totalBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  totalText: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  bannerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.5, lineHeight: 28 },
  bannerSub: { fontSize: 13, color: '#94A3B8', marginTop: 6, fontWeight: '500', lineHeight: 18 },
  nextUp: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  nextLabel: { fontSize: 10, fontWeight: '700', color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 0.6 },
  nextName: { fontSize: 15, fontWeight: '800', color: '#FFF', marginTop: 2 },
  nextReason: { fontSize: 12, color: '#94A3B8', marginTop: 2, fontWeight: '500' },
  nextCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  nextCtaText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    minHeight: 36,
    justifyContent: 'center',
  },
  chipOn: { borderColor: 'transparent' },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  chipTextOn: { color: '#FFF' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '600',
    paddingVertical: 10,
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#EEF1F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  listTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  countPill: {
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 99,
  },
  countPillText: { fontSize: 12, fontWeight: '800' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 28, lineHeight: 19 },
  emptyBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#D1FAE5',
  },
  emptyBtnText: { fontSize: 13, fontWeight: '700', color: '#047857' },
});

const tpStyles = StyleSheet.create({
  tipCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 14,
    marginBottom: 16,
  },
  tipIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, fontWeight: '500' },
  searchWrap: { marginBottom: 20, padding: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchIconWrap: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.textPrimary, fontWeight: '600' },
  generateBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  suggestList: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  suggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 52,
  },
  suggestItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  suggestAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  suggestMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  resultCard: { padding: 18 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  resultIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  resultTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  resultSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  aiBadge: { backgroundColor: ACCENT, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  aiBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 16 },
  pointRow: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  pointNum: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  pointNumText: { fontSize: 11, fontWeight: '800' },
  pointText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
    fontWeight: '500',
    fontFamily: Platform.OS === 'web' ? 'Noto Sans Telugu, sans-serif' : undefined,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionDivider: { width: 1, height: 18, backgroundColor: COLORS.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, minHeight: 40 },
  actionText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  emptyPrompt: { alignItems: 'center', paddingVertical: 52, gap: 14 },
  emptyGlyph: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyPromptText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 28,
    fontWeight: '500',
  },
});

const hmStyles = StyleSheet.create({
  header: { marginBottom: 14 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  gridWrap: { overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cornerCell: { width: 60, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F6FB' },
  headerCell: { flex: 1, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F6FB' },
  headerCellText: { fontWeight: '800', fontSize: 11, color: COLORS.textSecondary, letterSpacing: 0.5 },
  labelCell: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F6FB',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  labelText: { fontWeight: '800', fontSize: 11, color: COLORS.textSecondary },
  cell: { flex: 1, height: 52, justifyContent: 'center', alignItems: 'center', gap: 4 },
  cellValue: { fontWeight: '800', fontSize: 14, letterSpacing: -0.3 },
  cellBar: { width: '65%', height: 3, backgroundColor: '#E2E8F0', borderRadius: 99, overflow: 'hidden' },
  cellBarFill: { height: '100%', borderRadius: 99 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap' },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
});
