import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { clayCard, clayInset } from '@/src/theme/clayStyles';

import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  Modal, Pressable, Dimensions, useWindowDimensions,
} from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, FadeIn, FadeInUp, useSharedValue, useAnimatedStyle,
  withSpring, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import StaffHeader from '../../src/components/StaffHeader';
import ViewAsBanner from '../../src/components/ViewAsBanner';
import { useEffectiveStaffId } from '../../src/hooks/useEffectiveStaffId';
import { ComplaintService, Complaint, TeacherService, TeacherClassAssignment } from '../../src/services/commonServices';
import { StudentService } from '../../src/services/studentService';
import { AttendanceService } from '../../src/services/attendanceService';
import { StudentWithDetails } from '../../src/types/schema';
import { useTheme } from '../../src/hooks/useTheme';
import LogoLoader from '../../src/components/LogoLoader';

const { width: WIN_W } = Dimensions.get('window');
const FONT = Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif';
const AnimatedTouch = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Emerald staff accent — Mode A clay world
const EM = '#059669';
const EM_SOFT = '#10B981';
const EM_GLOW = 'rgba(16,185,129,0.18)';

// ─── Types ─────────────────────────────────────────────────────────
interface UIComplaint extends Complaint {
  color?: string;
  target?: string;
  date?: string;
}
interface Student {
  id: string;
  display_name: string;
  admission_no: string;
}
interface ClassSectionOption {
  class_section_id: string;
  class_id: string;
  section_id: string;
  label: string;
}

function getUniqueClassSections(assignments: TeacherClassAssignment[]): ClassSectionOption[] {
  const seen = new Set<string>();
  const result: ClassSectionOption[] = [];
  for (const assignment of assignments) {
    if (!seen.has(assignment.class_section_id)) {
      seen.add(assignment.class_section_id);
      result.push({
        class_section_id: assignment.class_section_id,
        class_id: assignment.class_id,
        section_id: assignment.section_id,
        label: `${assignment.class_name}-${assignment.section_name}`,
      });
    }
  }
  return result;
}

function mapStudentRows(
  rows: Array<{ student_id?: string; id?: string; student_name?: string; display_name?: string; admission_no: string }>
): Student[] {
  return rows.map((row) => ({
    id: row.student_id || row.id || '',
    display_name: row.student_name || row.display_name || 'Unknown',
    admission_no: row.admission_no,
  }));
}

function normalizeStatus(status?: string) {
  return (status || 'open').toLowerCase().trim().replace(/_/g, ' ');
}

function formatTimeAgo(dateString?: string) {
  if (!dateString) return '—';
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (Number.isNaN(seconds)) return '—';
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Config ────────────────────────────────────────────────────────
const CATEGORY_CFG: Record<string, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  disciplinary: { color: '#EF4444', bg: 'rgba(239,68,68,0.10)', icon: 'warning-outline', label: 'Disciplinary' },
  academic: { color: '#6366F1', bg: 'rgba(99,102,241,0.10)', icon: 'school-outline', label: 'Academic' },
  facility: { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', icon: 'business-outline', label: 'Facility' },
  default: { color: '#64748B', bg: 'rgba(100,116,139,0.10)', icon: 'chatbubble-ellipses-outline', label: 'Other' },
};

const PRIORITY_CFG: Record<string, { color: string; bg: string; border: string }> = {
  high: { color: '#EF4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.22)' },
  urgent: { color: '#DC2626', bg: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.28)' },
  medium: { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.22)' },
  low: { color: '#3B82F6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.22)' },
};

const STATUS_CFG: Record<string, { color: string; bg: string; border: string; icon: keyof typeof MaterialIcons.glyphMap; label: string }> = {
  open: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', icon: 'lock-open', label: 'Open' },
  pending: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', icon: 'hourglass-empty', label: 'Pending' },
  'in progress': { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)', icon: 'autorenew', label: 'In Progress' },
  resolved: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', icon: 'check-circle', label: 'Resolved' },
  closed: { color: '#64748B', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.22)', icon: 'lock', label: 'Closed' },
  escalated: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', icon: 'arrow-upward', label: 'Escalated' },
};

const SEVERITY_CFG = [
  { key: 'Low' as const, color: '#3B82F6', bg: 'rgba(59,130,246,0.10)', activeBg: 'rgba(59,130,246,0.15)' },
  { key: 'Medium' as const, color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', activeBg: 'rgba(245,158,11,0.15)' },
  { key: 'High' as const, color: '#EF4444', bg: 'rgba(239,68,68,0.10)', activeBg: 'rgba(239,68,68,0.15)' },
];

const FILTER_TABS = [
  { key: 'ALL' as const, label: 'All', icon: 'grid-outline' as const },
  { key: 'DISCIPLINARY' as const, label: 'Disciplinary', icon: 'warning-outline' as const },
  { key: 'FACILITY' as const, label: 'Facility', icon: 'business-outline' as const },
];

// ─── PressScale ────────────────────────────────────────────────────
function PressScale({
  onPress, children, disabled, style,
}: {
  onPress?: () => void; children: React.ReactNode; disabled?: boolean; style?: any;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => { if (!disabled) scale.value = withSpring(0.96, { damping: 18, stiffness: 320 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 220 }); }}
    >
      <Animated.View style={[style, aStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Single-depth field — avoids ClayInput’s double clay frame (bubbly / tall). */
function FormField({
  label, hint, value, onChangeText, placeholder, isDark, multiline, icon, suffix, error, required,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  isDark: boolean;
  multiline?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  suffix?: React.ReactNode;
  error?: string;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const showError = !!error && error.trim().length > 0;

  return (
    <View style={ff.wrap}>
      <View style={ff.labelRow}>
        <Text style={[ff.label, { color: isDark ? '#CBD5E1' : '#334155', fontFamily: FONT }]}>
          {label}{required ? <Text style={{ color: '#EF4444' }}> *</Text> : null}
        </Text>
        {hint ? (
          <Text style={[ff.hint, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>{hint}</Text>
        ) : null}
      </View>
      <View
        style={[
          ff.field,
          clayInset(isDark, focused) as any,
          focused && !showError && { borderWidth: 1.5, borderColor: isDark ? 'rgba(52,211,153,0.45)' : 'rgba(5,150,105,0.40)' },
          showError && { borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.45)' },
        ]}
      >
        {icon ? (
          <MaterialIcons
            name={icon}
            size={18}
            color={showError ? '#EF4444' : focused ? (isDark ? '#34D399' : EM) : (isDark ? '#64748B' : '#94A3B8')}
            style={{ marginTop: multiline ? 2 : 0 }}
          />
        ) : null}
        <AppTextInput
          style={[
            ff.input,
            multiline && ff.multi,
            {
              color: isDark ? '#EEF2FF' : '#0F172A',
              fontFamily: FONT,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
            } as any,
          ]}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          numberOfLines={multiline ? 4 : 1}
        />
        {suffix}
      </View>
      {showError ? (
        <Text style={[ff.error, { fontFamily: FONT }]}>{error}</Text>
      ) : null}
    </View>
  );
}

function StepHeader({
  step, title, subtitle, isDark, done,
}: {
  step: number; title: string; subtitle?: string; isDark: boolean; done?: boolean;
}) {
  return (
    <View style={ff.stepRow}>
      <View style={[
        ff.stepBadge,
        done
          ? { backgroundColor: isDark ? 'rgba(16,185,129,0.22)' : 'rgba(5,150,105,0.14)' }
          : { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' },
      ]}>
        {done ? (
          <Ionicons name="checkmark" size={14} color={isDark ? '#34D399' : EM} />
        ) : (
          <Text style={[ff.stepNum, { color: isDark ? '#94A3B8' : '#475569', fontFamily: FONT }]}>{step}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ff.stepTitle, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>{title}</Text>
        {subtitle ? (
          <Text style={[ff.stepSub, { color: isDark ? '#64748B' : '#64748B', fontFamily: FONT }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

const ff = StyleSheet.create({
  wrap: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7, gap: 8 },
  label: { fontSize: 13, fontWeight: '700', letterSpacing: -0.15 },
  hint: { fontSize: 11, fontWeight: '500' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 11 : 12,
    borderRadius: 14,
    minHeight: 48,
    borderWidth: 0,
  },
  input: { flex: 1, fontSize: 14, fontWeight: '600', letterSpacing: -0.2, minHeight: 22, padding: 0, backgroundColor: 'transparent', borderWidth: 0 },
  multi: { minHeight: 88, lineHeight: 21, paddingTop: 2 },
  error: { marginTop: 6, fontSize: 12, fontWeight: '600', color: '#EF4444' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepBadge: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 13, fontWeight: '800' },
  stepTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  stepSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
});

// ─── Skeleton ──────────────────────────────────────────────────────
function SkeletonCard({ isDark, delay = 0 }: { isDark: boolean; delay?: number }) {
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);
  const aStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const bone = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(148,163,184,0.18)';

  return (
    <Animated.View entering={FadeIn.delay(delay).duration(200)} style={[sk.card, clayCard(isDark, 'sm') as any, aStyle]}>
      <View style={[sk.stripe, { backgroundColor: bone }]} />
      <View style={sk.row}>
        <View style={[sk.icon, { backgroundColor: bone }]} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={[sk.line, { width: '38%', backgroundColor: bone }]} />
          <View style={[sk.line, { width: '72%', height: 14, backgroundColor: bone }]} />
        </View>
        <View style={[sk.pill, { backgroundColor: bone }]} />
      </View>
      <View style={[sk.line, { width: '90%', marginTop: 12, backgroundColor: bone }]} />
      <View style={[sk.line, { width: '55%', marginTop: 8, backgroundColor: bone }]} />
    </Animated.View>
  );
}

const sk = StyleSheet.create({
  card: { padding: 16, paddingLeft: 20, marginBottom: 12, overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 3.5, borderRadius: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 13 },
  line: { height: 10, borderRadius: 6 },
  pill: { width: 48, height: 24, borderRadius: 8 },
});

// ─── Complaint Card ────────────────────────────────────────────────
const ComplaintCard = React.memo(function ComplaintCard({
  item, index, isDark, onPress,
}: {
  item: UIComplaint; index: number; isDark: boolean; onPress: (c: UIComplaint) => void;
}) {
  const catKey = item.category?.toLowerCase() || 'default';
  const cat = CATEGORY_CFG[catKey] || CATEGORY_CFG.default;
  const pri = PRIORITY_CFG[(item.priority || 'low').toLowerCase()] || PRIORITY_CFG.low;
  const stat = STATUS_CFG[normalizeStatus(item.status)] || STATUS_CFG.open;
  const isHigh = ['high', 'urgent'].includes((item.priority || '').toLowerCase());
  const s = useSharedValue(1);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 55).duration(320).easing(Easing.out(Easing.cubic))}>
      <AnimatedTouch
        activeOpacity={1}
        onPressIn={() => { s.value = withSpring(0.975, { damping: 18, stiffness: 240 }); }}
        onPressOut={() => { s.value = withSpring(1, { damping: 16, stiffness: 220 }); }}
        onPress={() => onPress(item)}
        style={[useAnimatedStyle(() => ({ transform: [{ scale: s.value }] })), { marginBottom: 12 }]}
      >
        <View style={[cc.card, clayCard(isDark, 'sm') as any, isHigh && cc.cardUrgent]}>
          <LinearGradient
            colors={isDark
              ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']
              : ['rgba(255,255,255,0.70)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
            pointerEvents="none"
          />
          <View style={[cc.stripe, { backgroundColor: cat.color }]} />

          <View style={cc.inner}>
            <View style={cc.top}>
              <View style={[cc.iconWrap, { backgroundColor: cat.bg }]}>
                <Ionicons name={cat.icon} size={17} color={cat.color} />
              </View>

              <View style={cc.headerText}>
                <Text style={[cc.ticket, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                  #{item.ticket_no || item.id?.slice(0, 8)}
                </Text>
                <Text style={[cc.title, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]} numberOfLines={2}>
                  {item.title || 'Untitled report'}
                </Text>
              </View>

              <View style={[cc.priorityBadge, { backgroundColor: pri.bg, borderColor: pri.border }]}>
                <Text style={[cc.priorityText, { color: pri.color, fontFamily: FONT }]}>
                  {(item.priority || 'Low').toUpperCase()}
                </Text>
              </View>
            </View>

            {!!item.description && (
              <Text style={[cc.desc, { color: isDark ? '#94A3B8' : '#64748B', fontFamily: FONT }]} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            <View style={[cc.footer, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
              <View style={cc.footerLeft}>
                <View style={[cc.catPill, { backgroundColor: cat.bg }]}>
                  <Text style={[cc.catText, { color: cat.color, fontFamily: FONT }]}>{cat.label}</Text>
                </View>
                <View style={cc.timeMeta}>
                  <Ionicons name="time-outline" size={12} color={isDark ? '#475569' : '#94A3B8'} />
                  <Text style={[cc.timeText, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                    {formatTimeAgo(item.created_at)}
                  </Text>
                </View>
              </View>

              <View style={cc.footerRight}>
                <View style={[cc.statusBadge, { backgroundColor: stat.bg, borderColor: stat.border }]}>
                  <MaterialIcons name={stat.icon} size={11} color={stat.color} />
                  <Text style={[cc.statusText, { color: stat.color, fontFamily: FONT }]}>
                    {stat.label.toUpperCase()}
                  </Text>
                </View>
                <View style={[cc.chevron, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)' }]}>
                  <Ionicons name="chevron-forward" size={14} color={isDark ? '#64748B' : '#94A3B8'} />
                </View>
              </View>
            </View>
          </View>
        </View>
      </AnimatedTouch>
    </Animated.View>
  );
});

const cc = StyleSheet.create({
  card: { borderRadius: 24, overflow: 'hidden', position: 'relative' },
  cardUrgent: {
    borderColor: 'rgba(239,68,68,0.28)',
    ...Platform.select({
      ios: { shadowColor: '#EF4444', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 4 },
      default: {},
    }),
  },
  stripe: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 3.5, borderRadius: 3, zIndex: 2 },
  inner: { padding: 0 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, paddingLeft: 18, paddingBottom: 8 },
  iconWrap: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  headerText: { flex: 1, minWidth: 0 },
  ticket: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 },
  title: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3, lineHeight: 20 },
  priorityBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, borderWidth: 1, marginTop: 2 },
  priorityText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  desc: { fontSize: 13, lineHeight: 19, paddingHorizontal: 18, paddingBottom: 12, letterSpacing: -0.1 },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingLeft: 18, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, flexWrap: 'wrap' },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  catText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.45 },
  timeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 11, fontWeight: '500' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, borderWidth: 1 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  chevron: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});

// ─── Detail Sheet ──────────────────────────────────────────────────
function DetailSheet({
  item, visible, onClose, isDark,
}: {
  item: UIComplaint | null; visible: boolean; onClose: () => void; isDark: boolean;
}) {
  if (!item) return null;
  const cat = CATEGORY_CFG[item.category?.toLowerCase() || 'default'] || CATEGORY_CFG.default;
  const pri = PRIORITY_CFG[(item.priority || 'low').toLowerCase()] || PRIORITY_CFG.low;
  const stat = STATUS_CFG[normalizeStatus(item.status)] || STATUS_CFG.open;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={ds.backdrop} onPress={onClose}>
        <Pressable style={[ds.sheet, clayCard(isDark, 'lg') as any]} onPress={(e) => e.stopPropagation?.()}>
          <View style={ds.handle} />
          <View style={ds.sheetHeader}>
            <View style={[ds.sheetIcon, { backgroundColor: cat.bg }]}>
              <Ionicons name={cat.icon} size={20} color={cat.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ds.sheetTicket, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                #{item.ticket_no || item.id?.slice(0, 8)}
              </Text>
              <Text style={[ds.sheetTitle, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>
                {item.title || 'Untitled report'}
              </Text>
            </View>
            <PressScale onPress={onClose}>
              <View style={[ds.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}>
                <Ionicons name="close" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
              </View>
            </PressScale>
          </View>

          <View style={ds.badgeRow}>
            <View style={[ds.badge, { backgroundColor: cat.bg }]}>
              <Text style={[ds.badgeText, { color: cat.color, fontFamily: FONT }]}>{cat.label}</Text>
            </View>
            <View style={[ds.badge, { backgroundColor: pri.bg, borderColor: pri.border, borderWidth: 1 }]}>
              <Text style={[ds.badgeText, { color: pri.color, fontFamily: FONT }]}>{(item.priority || 'Low').toUpperCase()}</Text>
            </View>
            <View style={[ds.badge, { backgroundColor: stat.bg, borderColor: stat.border, borderWidth: 1 }]}>
              <MaterialIcons name={stat.icon} size={12} color={stat.color} />
              <Text style={[ds.badgeText, { color: stat.color, fontFamily: FONT }]}>{stat.label}</Text>
            </View>
          </View>

          <Text style={[ds.sectionLabel, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>Description</Text>
          <Text style={[ds.body, { color: isDark ? '#CBD5E1' : '#334155', fontFamily: FONT }]}>
            {item.description || 'No description provided.'}
          </Text>

          <View style={[ds.metaGrid, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
            <View style={ds.metaItem}>
              <Ionicons name="time-outline" size={14} color={EM} />
              <View>
                <Text style={[ds.metaLabel, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>Filed</Text>
                <Text style={[ds.metaValue, { color: isDark ? '#E2E8F0' : '#0F172A', fontFamily: FONT }]}>
                  {formatTimeAgo(item.created_at)}
                </Text>
              </View>
            </View>
            {item.raised_by_name || item.raised_by ? (
              <View style={ds.metaItem}>
                <Ionicons name="person-outline" size={14} color={EM} />
                <View>
                  <Text style={[ds.metaLabel, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>Raised by</Text>
                  <Text style={[ds.metaValue, { color: isDark ? '#E2E8F0' : '#0F172A', fontFamily: FONT }]} numberOfLines={1}>
                    {item.raised_by_name || item.raised_by}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {item.resolution ? (
            <>
              <Text style={[ds.sectionLabel, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT, marginTop: 16 }]}>Resolution</Text>
              <Text style={[ds.body, { color: isDark ? '#CBD5E1' : '#334155', fontFamily: FONT }]}>{item.resolution}</Text>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ds = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end', padding: 16, paddingBottom: 28,
  },
  sheet: {
    borderRadius: 28, padding: 22, maxHeight: '78%',
    width: Math.min(WIN_W - 32, 520), alignSelf: 'center',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.45)',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  sheetIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sheetTicket: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  sheetTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4, lineHeight: 24 },
  closeBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 22, fontWeight: '500' },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 18, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: '40%' },
  metaLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  metaValue: { fontSize: 13, fontWeight: '700' },
});

// ─── Animated Tab Switcher ─────────────────────────────────────────
const TAB_DEFS = [
  { key: 'MY_REPORTS' as const, label: 'History', icon: 'history' as const },
  { key: 'FILE_NEW' as const, label: 'New report', icon: 'edit' as const },
];

const TabSwitcher = ({
  activeTab, onSwitch, isDark,
}: {
  activeTab: 'MY_REPORTS' | 'FILE_NEW';
  onSwitch: (k: 'MY_REPORTS' | 'FILE_NEW') => void;
  isDark: boolean;
}) => {
  const slideX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const tabLayouts = React.useRef<{ x: number; width: number }[]>([]);

  const slideToTab = (index: number) => {
    const layout = tabLayouts.current[index];
    if (layout) {
      slideX.value = withSpring(layout.x, { damping: 20, stiffness: 260 });
      pillWidth.value = withSpring(layout.width, { damping: 20, stiffness: 260 });
    }
  };

  useEffect(() => {
    const idx = TAB_DEFS.findIndex((t) => t.key === activeTab);
    const t = setTimeout(() => slideToTab(idx), 50);
    return () => clearTimeout(t);
  }, [activeTab]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
    width: pillWidth.value,
  }));

  const scales = TAB_DEFS.map(() => useSharedValue(1));

  return (
    <Animated.View entering={FadeInDown.delay(80).duration(340).easing(Easing.out(Easing.cubic))} style={ts.outerWrap}>
      <View style={[ts.blurWrap, clayInset(isDark) as any]}>
        <View style={ts.track}>
          <Animated.View style={[ts.slidePill, pillStyle, clayCard(isDark, 'sm') as any, { borderRadius: 16 }]} />
          {TAB_DEFS.map((tab, idx) => {
            const isActive = activeTab === tab.key;
            const s = scales[idx];
            const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
            return (
              <AnimatedTouch
                key={tab.key}
                activeOpacity={1}
                onPressIn={() => { s.value = withSpring(0.93, { damping: 16, stiffness: 260 }); }}
                onPressOut={() => { s.value = withSpring(1, { damping: 16, stiffness: 260 }); }}
                onPress={() => onSwitch(tab.key)}
                style={[ts.tabBtn, animStyle]}
                onLayout={(e) => {
                  tabLayouts.current[idx] = {
                    x: e.nativeEvent.layout.x,
                    width: e.nativeEvent.layout.width,
                  };
                  if (tab.key === activeTab) {
                    slideX.value = e.nativeEvent.layout.x;
                    pillWidth.value = e.nativeEvent.layout.width;
                  }
                }}
              >
                <View style={[ts.iconWrap, isActive && { backgroundColor: isDark ? 'rgba(52,211,153,0.18)' : 'rgba(16,185,129,0.12)' }]}>
                  <MaterialIcons
                    name={tab.icon}
                    size={15}
                    color={isActive ? (isDark ? '#34D399' : EM) : (isDark ? '#64748B' : '#94A3B8')}
                  />
                </View>
                <Text style={[ts.tabLabel, {
                  color: isActive ? (isDark ? '#34D399' : EM) : (isDark ? '#64748B' : '#64748B'),
                  fontFamily: FONT,
                  fontWeight: isActive ? '700' : '600',
                }]}>
                  {tab.label}
                </Text>
              </AnimatedTouch>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
};

const ts = StyleSheet.create({
  outerWrap: { marginBottom: 18, borderRadius: 20 },
  blurWrap: { borderRadius: 20, overflow: 'hidden' },
  track: { flexDirection: 'row', padding: 4, borderRadius: 20, position: 'relative' },
  slidePill: {
    position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: 16, overflow: 'hidden', zIndex: 0,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 16, zIndex: 1,
  },
  iconWrap: { width: 24, height: 24, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  tabLabel: { fontSize: 13, letterSpacing: -0.2 },
});

// ─── Main Screen ───────────────────────────────────────────────────
export default function StaffComplaints() {
  const { isDark } = useTheme();
  const { isViewingAsAdmin, viewAsName, staffId } = useEffectiveStaffId();

  const [activeTab, setActiveTab] = useState<'MY_REPORTS' | 'FILE_NEW'>('MY_REPORTS');
  const [loading, setLoading] = useState(false);
  const [complaints, setComplaints] = useState<UIComplaint[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'DISCIPLINARY' | 'FACILITY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [detailItem, setDetailItem] = useState<UIComplaint | null>(null);

  // Form
  const [studentMode, setStudentMode] = useState<'single' | 'multiple'>('single');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string | null>(null);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [loadingClass, setLoadingClass] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High'>('Low');
  const [isSearching, setIsSearching] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const { width: winW } = useWindowDimensions();
  const formMaxW = Math.min(winW - 36, 560);

  const submitScale = useSharedValue(1);
  const submitAnim = useAnimatedStyle(() => ({ transform: [{ scale: submitScale.value }] }));

  useEffect(() => {
    if (activeTab === 'MY_REPORTS') fetchComplaints();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'FILE_NEW' && studentMode === 'single' && studentSearch.length > 2) {
      const t = setTimeout(searchStudents, 500);
      return () => clearTimeout(t);
    } else if (studentMode === 'single') setStudentsList([]);
  }, [studentSearch, activeTab, studentMode]);

  useEffect(() => {
    if (activeTab !== 'FILE_NEW' || studentMode !== 'multiple') return;
    loadTeacherClasses();
  }, [activeTab, studentMode, staffId]);

  useEffect(() => {
    if (activeTab !== 'FILE_NEW' || studentMode !== 'multiple' || !selectedClassSectionId) return;
    loadClassStudents(selectedClassSectionId);
  }, [activeTab, studentMode, selectedClassSectionId, classSections]);

  const loadTeacherClasses = async () => {
    setLoadingClass(true);
    let loadedSections: ClassSectionOption[] = [];
    try {
      const assignments = await TeacherService.getMyClasses();
      let sections = getUniqueClassSections(assignments);

      const homeroom = await AttendanceService.getMyClass(undefined, staffId);
      if (
        homeroom?.class_section_id &&
        !sections.some((section) => section.class_section_id === homeroom.class_section_id)
      ) {
        sections = [
          ...sections,
          {
            class_section_id: homeroom.class_section_id,
            class_id: '',
            section_id: '',
            label: `${homeroom.class_name || 'Class'} ${homeroom.section_name || ''}`.trim(),
          },
        ];
      }

      loadedSections = sections;
      setClassSections(sections);
      setSelectedClassSectionId((prev) =>
        prev && sections.some((section) => section.class_section_id === prev)
          ? prev
          : sections[0]?.class_section_id ?? null
      );

      if (sections.length === 0) setClassStudents([]);
    } catch {
      loadedSections = [];
      setClassSections([]);
      setSelectedClassSectionId(null);
      setClassStudents([]);
    } finally {
      if (loadedSections.length === 0) setLoadingClass(false);
    }
  };

  const loadClassStudents = async (classSectionId: string) => {
    setLoadingClass(true);
    setSelectedStudentIds([]);
    try {
      const section = classSections.find((item) => item.class_section_id === classSectionId);
      if (section?.class_id && section?.section_id) {
        const response = await StudentService.getAll<StudentWithDetails>({
          class_id: section.class_id,
          section_id: section.section_id,
          limit: 200,
        });
        setClassStudents(response.data.map((student) => ({
          id: student.id,
          display_name: student.person.display_name || `${student.person.first_name} ${student.person.last_name}`,
          admission_no: student.admission_no,
        })));
        return;
      }

      const homeroom = await AttendanceService.getMyClass(undefined, staffId);
      if (homeroom?.class_section_id === classSectionId && homeroom.students?.length) {
        setClassStudents(mapStudentRows(homeroom.students));
        return;
      }

      setClassStudents([]);
    } catch {
      setClassStudents([]);
    } finally {
      setLoadingClass(false);
    }
  };

  const toggleStudentSelection = (student: Student) => {
    setSelectedStudentIds((prev) =>
      prev.includes(student.id) ? prev.filter((id) => id !== student.id) : [...prev, student.id]
    );
  };

  const selectAllClassStudents = () => setSelectedStudentIds(classStudents.map((s) => s.id));
  const clearClassSelection = () => setSelectedStudentIds([]);

  const switchStudentMode = (mode: 'single' | 'multiple') => {
    setStudentMode(mode);
    setSelectedStudent(null);
    setSelectedStudentIds([]);
    setStudentSearch('');
    setStudentsList([]);
    setClassSections([]);
    setSelectedClassSectionId(null);
    setClassStudents([]);
  };

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const data = await ComplaintService.getAll();
      setComplaints(data.map((item) => ({
        ...item,
        color: CATEGORY_CFG[item.category?.toLowerCase() || 'default']?.color || '#6B7280',
        date: new Date(item.created_at).toLocaleDateString(),
      })));
    } catch {
      alertCompat('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const searchStudents = async () => {
    try {
      setIsSearching(true);
      const res = await StudentService.getAll<StudentWithDetails>({ search: studentSearch, limit: 5 });
      setStudentsList(res.data.map((s: StudentWithDetails) => ({
        id: s.id,
        display_name: s.person.display_name || `${s.person.first_name} ${s.person.last_name}`,
        admission_no: s.admission_no,
      })));
    } catch { /* noop */ } finally {
      setIsSearching(false);
    }
  };

  const studentReady = studentMode === 'single' ? !!selectedStudent : selectedStudentIds.length > 0;
  const titleReady = title.trim().length > 0;
  const descReady = desc.trim().length > 0;

  const handleSubmit = async () => {
    setAttemptedSubmit(true);
    if (!studentReady) {
      alertCompat('Pick a student', studentMode === 'single'
        ? 'Search and select who this report is about.'
        : 'Select at least one student from your class.');
      return;
    }
    if (!titleReady || !descReady) {
      alertCompat('Almost there', 'Add a title and description before submitting.');
      return;
    }
    try {
      setLoading(true);
      if (studentMode === 'single') {
        await ComplaintService.create({
          title: title.trim(), description: desc.trim(), category: 'disciplinary',
          priority: severity.toLowerCase(),
          raised_for_student_id: selectedStudent!.id,
        });
        alertCompat('Submitted', 'Report submitted successfully.');
      } else {
        const result = await ComplaintService.createBulk({
          title: title.trim(), description: desc.trim(), category: 'disciplinary',
          priority: severity.toLowerCase(),
          raised_for_student_ids: selectedStudentIds,
        });
        alertCompat('Submitted', `Report sent to ${result.count} student(s).`);
      }
      setTitle(''); setDesc(''); setStudentSearch('');
      setSelectedStudent(null); setSelectedStudentIds([]);
      setSeverity('Low'); setStudentMode('single');
      setAttemptedSubmit(false);
      setActiveTab('MY_REPORTS');
    } catch {
      alertCompat('Error', 'Failed to submit report.');
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const open = complaints.filter((c) => {
      const s = normalizeStatus(c.status);
      return s === 'open' || s === 'pending';
    }).length;
    const high = complaints.filter((c) => ['high', 'urgent'].includes((c.priority || '').toLowerCase())).length;
    const resolved = complaints.filter((c) => {
      const s = normalizeStatus(c.status);
      return s === 'resolved' || s === 'closed';
    }).length;
    const disciplinary = complaints.filter((c) => c.category?.toUpperCase() === 'DISCIPLINARY').length;
    const facility = complaints.filter((c) => c.category?.toUpperCase() === 'FACILITY').length;
    return { open, high, resolved, disciplinary, facility, total: complaints.length };
  }, [complaints]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return complaints.filter((c) => {
      if (filterType !== 'ALL' && c.category?.toUpperCase() !== filterType) return false;
      if (!q) return true;
      const hay = `${c.title || ''} ${c.description || ''} ${c.ticket_no || ''} ${c.raised_by_name || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [complaints, filterType, searchQuery]);

  const openDetail = useCallback((c: UIComplaint) => setDetailItem(c), []);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={isDark ? ['#06040F', '#0C0820', '#080614'] : ['#EEF2FF', '#E8EEFF', '#F5F0FF']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.55, y: 1 }}
      />

      <StaffHeader title="Complaints & Remarks" showBackButton />
      {isViewingAsAdmin && <ViewAsBanner name={viewAsName} />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={ms.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero — compact on File New so the form stays above the fold */}
        <Animated.View entering={FadeInDown.delay(40).duration(320)} style={[ms.pageHeader, activeTab === 'FILE_NEW' && { marginBottom: 8 }]}>
          <View style={ms.heroLeft}>
            <View style={[ms.heroBadge, { backgroundColor: isDark ? 'rgba(16,185,129,0.16)' : 'rgba(5,150,105,0.12)' }]}>
              <Ionicons name="shield-checkmark" size={16} color={isDark ? '#34D399' : EM} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ms.pageTitle, activeTab === 'FILE_NEW' && { fontSize: 18 }, { color: isDark ? '#EEF2FF' : '#06101E', fontFamily: FONT }]}>
                Student Disciplinary
              </Text>
              {activeTab === 'MY_REPORTS' ? (
                <Text style={[ms.pageSub, { color: isDark ? '#64748B' : '#64748B', fontFamily: FONT }]}>
                  Track behaviour, file reports, follow through
                </Text>
              ) : null}
            </View>
          </View>
        </Animated.View>

        {/* Stats */}
        {!loading && complaints.length > 0 && activeTab === 'MY_REPORTS' && (
          <Animated.View entering={FadeInDown.delay(60).duration(320)} style={[ms.statsStrip, clayCard(isDark, 'sm') as any]}>
            <View style={ms.statChip}>
              <Text style={[ms.statNumber, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>{counts.total}</Text>
              <Text style={[ms.statLabel, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>Total</Text>
            </View>
            <View style={[ms.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]} />
            <View style={ms.statChip}>
              <Text style={[ms.statNumber, { color: '#F59E0B', fontFamily: FONT }]}>{counts.open}</Text>
              <Text style={[ms.statLabel, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>Open</Text>
            </View>
            <View style={[ms.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]} />
            <View style={ms.statChip}>
              <Text style={[ms.statNumber, { color: '#EF4444', fontFamily: FONT }]}>{counts.high}</Text>
              <Text style={[ms.statLabel, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>Urgent</Text>
            </View>
            <View style={[ms.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]} />
            <View style={ms.statChip}>
              <Text style={[ms.statNumber, { color: EM_SOFT, fontFamily: FONT }]}>{counts.resolved}</Text>
              <Text style={[ms.statLabel, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>Done</Text>
            </View>
          </Animated.View>
        )}

        <TabSwitcher activeTab={activeTab} onSwitch={setActiveTab} isDark={isDark} />

        {/* History */}
        {activeTab === 'MY_REPORTS' && (
          <Animated.View entering={FadeIn.duration(280)}>
            {/* Search */}
            <View style={[
              ms.searchWrap,
              clayInset(isDark, searchFocused) as any,
              searchFocused && { borderColor: EM_GLOW },
            ]}>
              <Ionicons name="search-outline" size={17} color={searchFocused ? EM : (isDark ? '#64748B' : '#94A3B8')} />
              <AppTextInput
                style={[ms.searchInput, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}
                placeholder="Search tickets, titles…"
                placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {searchQuery.length > 0 && (
                <PressScale onPress={() => setSearchQuery('')}>
                  <View style={[ms.searchClear, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)' }]}>
                    <Ionicons name="close" size={12} color="#fff" />
                  </View>
                </PressScale>
              )}
            </View>

            {/* Filters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 14 }}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
            >
              {FILTER_TABS.map((f) => {
                const isActive = filterType === f.key;
                const count = f.key === 'ALL' ? counts.total
                  : f.key === 'DISCIPLINARY' ? counts.disciplinary
                    : counts.facility;
                return (
                  <PressScale key={f.key} onPress={() => setFilterType(f.key)}>
                    <View style={[
                      ms.filterChip,
                      isActive
                        ? { backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(5,150,105,0.12)', borderColor: isDark ? 'rgba(52,211,153,0.35)' : 'rgba(5,150,105,0.35)' }
                        : { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                    ]}>
                      <Ionicons
                        name={f.icon}
                        size={13}
                        color={isActive ? (isDark ? '#34D399' : EM) : (isDark ? '#64748B' : '#94A3B8')}
                      />
                      <Text style={[
                        ms.filterText,
                        {
                          color: isActive ? (isDark ? '#34D399' : EM) : (isDark ? '#94A3B8' : '#64748B'),
                          fontFamily: FONT,
                          fontWeight: isActive ? '700' : '600',
                        },
                      ]}>
                        {f.label}
                      </Text>
                      {count > 0 && (
                        <View style={[
                          ms.filterCount,
                          { backgroundColor: isActive ? (isDark ? 'rgba(52,211,153,0.25)' : 'rgba(5,150,105,0.18)') : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)') },
                        ]}>
                          <Text style={[
                            ms.filterCountText,
                            { color: isActive ? (isDark ? '#34D399' : EM) : (isDark ? '#94A3B8' : '#64748B'), fontFamily: FONT },
                          ]}>
                            {count}
                          </Text>
                        </View>
                      )}
                    </View>
                  </PressScale>
                );
              })}
            </ScrollView>

            {loading ? (
              <View>
                <SkeletonCard isDark={isDark} delay={0} />
                <SkeletonCard isDark={isDark} delay={60} />
                <SkeletonCard isDark={isDark} delay={120} />
              </View>
            ) : filtered.length === 0 ? (
              <Animated.View entering={FadeInUp.duration(320)} style={[ms.emptyState, clayCard(isDark, 'md') as any]}>
                <View style={[ms.emptyIcon, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(5,150,105,0.10)' }]}>
                  <Ionicons
                    name={searchQuery ? 'search-outline' : 'document-text-outline'}
                    size={28}
                    color={isDark ? '#34D399' : EM}
                  />
                </View>
                <Text style={[ms.emptyTitle, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>
                  {searchQuery ? 'No matches' : 'No reports yet'}
                </Text>
                <Text style={[ms.emptyText, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                  {searchQuery
                    ? 'Try a different ticket, title, or keyword.'
                    : 'File your first behaviour report — it only takes a minute.'}
                </Text>
                {!searchQuery && (
                  <PressScale onPress={() => setActiveTab('FILE_NEW')}>
                    <LinearGradient colors={[EM, EM_SOFT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ms.emptyCta}>
                      <Ionicons name="add-circle-outline" size={16} color="#fff" />
                      <Text style={[ms.emptyCtaText, { fontFamily: FONT }]}>File New Report</Text>
                    </LinearGradient>
                  </PressScale>
                )}
              </Animated.View>
            ) : (
              filtered.map((item, i) => (
                <ComplaintCard key={item.id} item={item} index={i} isDark={isDark} onPress={openDetail} />
              ))
            )}
          </Animated.View>
        )}

        {/* File New */}
        {activeTab === 'FILE_NEW' && (
          <Animated.View
            entering={FadeInDown.delay(60).duration(300).easing(Easing.out(Easing.cubic))}
            style={{ width: '100%', maxWidth: formMaxW, alignSelf: 'center' }}
          >
            <View style={[ms.formCard, clayCard(isDark, 'md') as any]}>
              <View style={ms.formInner}>
                {/* Progress pills */}
                <View style={ms.progressRow}>
                  {[
                    { n: 1, label: 'Who', done: studentReady },
                    { n: 2, label: 'What', done: titleReady && descReady },
                    { n: 3, label: 'Severity', done: true },
                  ].map((p, i) => (
                    <React.Fragment key={p.n}>
                      {i > 0 ? <View style={[ms.progressLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]} /> : null}
                      <View style={ms.progressItem}>
                        <View style={[
                          ms.progressDot,
                          p.done
                            ? { backgroundColor: isDark ? 'rgba(16,185,129,0.22)' : 'rgba(5,150,105,0.14)' }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)' },
                        ]}>
                          {p.done
                            ? <Ionicons name="checkmark" size={11} color={isDark ? '#34D399' : EM} />
                            : <Text style={[ms.progressNum, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>{p.n}</Text>}
                        </View>
                        <Text style={[ms.progressLabel, {
                          color: p.done ? (isDark ? '#34D399' : EM) : (isDark ? '#64748B' : '#94A3B8'),
                          fontFamily: FONT,
                        }]}>{p.label}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>

                {/* Step 1 — Who */}
                <View style={[ms.stepBlock, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                  <StepHeader
                    step={1}
                    title="Who is this about?"
                    subtitle={studentMode === 'single' ? 'Search one student' : 'Pick from your class'}
                    isDark={isDark}
                    done={studentReady}
                  />

                  <View style={ms.modeGrid}>
                    {([
                      { key: 'single' as const, label: 'One student', desc: 'Search by name or roll', icon: 'person-outline' as const },
                      { key: 'multiple' as const, label: 'Class pick', desc: 'Select several at once', icon: 'people-outline' as const },
                    ]).map((mode) => {
                      const active = studentMode === mode.key;
                      return (
                        <PressScale key={mode.key} onPress={() => switchStudentMode(mode.key)} style={{ flex: 1 }}>
                          <View style={[
                            ms.modeCard,
                            active
                              ? {
                                  backgroundColor: isDark ? 'rgba(16,185,129,0.14)' : 'rgba(5,150,105,0.08)',
                                  borderColor: isDark ? 'rgba(52,211,153,0.40)' : 'rgba(5,150,105,0.35)',
                                }
                              : {
                                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
                                },
                          ]}>
                            <View style={[
                              ms.modeIcon,
                              { backgroundColor: active
                                ? (isDark ? 'rgba(16,185,129,0.22)' : 'rgba(5,150,105,0.14)')
                                : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)') },
                            ]}>
                              <Ionicons
                                name={mode.icon}
                                size={16}
                                color={active ? (isDark ? '#34D399' : EM) : (isDark ? '#64748B' : '#94A3B8')}
                              />
                            </View>
                            <Text style={[ms.modeTitle, {
                              color: active ? (isDark ? '#34D399' : EM) : (isDark ? '#E2E8F0' : '#0F172A'),
                              fontFamily: FONT,
                            }]}>{mode.label}</Text>
                            <Text style={[ms.modeDesc, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>{mode.desc}</Text>
                          </View>
                        </PressScale>
                      );
                    })}
                  </View>

                  {attemptedSubmit && !studentReady ? (
                    <Text style={[ms.inlineError, { fontFamily: FONT }]}>
                      {studentMode === 'single' ? 'Select a student to continue.' : 'Select at least one student.'}
                    </Text>
                  ) : null}

                  {studentMode === 'single' ? (
                    selectedStudent ? (
                      <View style={[ms.selectedChip, {
                        backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(5,150,105,0.08)',
                        borderColor: isDark ? 'rgba(52,211,153,0.30)' : 'rgba(5,150,105,0.28)',
                      }]}>
                        <View style={[ms.selectedAvatar, { backgroundColor: isDark ? 'rgba(16,185,129,0.22)' : 'rgba(5,150,105,0.16)' }]}>
                          <Text style={[ms.selectedInitial, { color: isDark ? '#34D399' : EM, fontFamily: FONT }]}>
                            {(selectedStudent.display_name?.[0] ?? '?').toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[ms.selectedName, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>
                            {selectedStudent.display_name}
                          </Text>
                          <Text style={[ms.selectedAdm, { color: isDark ? '#64748B' : '#64748B', fontFamily: FONT }]}>
                            Roll #{selectedStudent.admission_no}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => { setSelectedStudent(null); setStudentSearch(''); }}
                          style={[ms.clearBtn, { backgroundColor: 'rgba(239,68,68,0.12)' }]}
                          hitSlop={8}
                        >
                          <Ionicons name="close" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View>
                        <FormField
                          label="Search student"
                          required
                          isDark={isDark}
                          icon="search"
                          placeholder="Name or admission number…"
                          value={studentSearch}
                          onChangeText={setStudentSearch}
                          suffix={isSearching ? <LogoLoader size={26} color={isDark ? '#34D399' : EM} /> : null}
                        />
                        {studentSearch.length > 2 && studentsList.length > 0 && (
                          <View style={[ms.suggestBox, clayCard(isDark, 'sm') as any]}>
                            {studentsList.map((s, i) => (
                              <TouchableOpacity
                                key={s.id}
                                style={[ms.suggestItem, i < studentsList.length - 1 && {
                                  borderBottomWidth: StyleSheet.hairlineWidth,
                                  borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                }]}
                                onPress={() => { setSelectedStudent(s); setStudentsList([]); setStudentSearch(''); }}
                              >
                                <View style={[ms.suggestAvatar, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(5,150,105,0.08)' }]}>
                                  <Text style={{ color: isDark ? '#34D399' : EM, fontWeight: '800', fontSize: 12 }}>
                                    {(s.display_name?.[0] ?? '?').toUpperCase()}
                                  </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[ms.suggestName, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>{s.display_name}</Text>
                                  <Text style={[ms.suggestAdm, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>#{s.admission_no}</Text>
                                </View>
                                <Ionicons name="add-circle-outline" size={18} color={isDark ? '#34D399' : EM} />
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                        {studentSearch.length > 2 && !isSearching && studentsList.length === 0 ? (
                          <Text style={[ms.helperMuted, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                            No students match “{studentSearch}”
                          </Text>
                        ) : null}
                      </View>
                    )
                  ) : (
                    <View>
                      {classSections.length > 0 ? (
                        <>
                          <Text style={[ms.fieldLabel, { color: isDark ? '#CBD5E1' : '#334155', fontFamily: FONT }]}>Class</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ms.classChipRow}>
                            {classSections.map((section) => {
                              const active = selectedClassSectionId === section.class_section_id;
                              return (
                                <PressScale key={section.class_section_id} onPress={() => setSelectedClassSectionId(section.class_section_id)}>
                                  <View style={[
                                    ms.classChip,
                                    active
                                      ? { backgroundColor: isDark ? 'rgba(16,185,129,0.16)' : 'rgba(5,150,105,0.12)', borderColor: isDark ? 'rgba(52,211,153,0.40)' : 'rgba(5,150,105,0.35)' }
                                      : { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                                  ]}>
                                    <Text style={[ms.classChipText, {
                                      color: active ? (isDark ? '#34D399' : EM) : (isDark ? '#94A3B8' : '#64748B'),
                                      fontFamily: FONT,
                                      fontWeight: active ? '800' : '600',
                                    }]}>
                                      {section.label.replace('-', ' ')}
                                    </Text>
                                  </View>
                                </PressScale>
                              );
                            })}
                          </ScrollView>
                          <View style={ms.classHeaderRow}>
                            <Text style={[ms.classLabel, { color: isDark ? '#CBD5E1' : '#475569', fontFamily: FONT }]}>
                              {classStudents.length} student{classStudents.length === 1 ? '' : 's'}
                              {selectedStudentIds.length > 0 ? ` · ${selectedStudentIds.length} selected` : ''}
                            </Text>
                            <View style={ms.classActions}>
                              <TouchableOpacity onPress={selectAllClassStudents} style={ms.classActionBtn}>
                                <Text style={[ms.classActionText, { color: isDark ? '#34D399' : EM, fontFamily: FONT }]}>All</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={clearClassSelection} style={ms.classActionBtn}>
                                <Text style={[ms.classActionText, { color: isDark ? '#94A3B8' : '#64748B', fontFamily: FONT }]}>Clear</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </>
                      ) : null}

                      {loadingClass ? (
                        <View style={ms.classLoading}>
                          <LogoLoader size={32} color={isDark ? '#34D399' : EM} />
                          <Text style={[ms.classLoadingText, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                            {classSections.length === 0 ? 'Loading classes…' : 'Loading students…'}
                          </Text>
                        </View>
                      ) : classSections.length === 0 ? (
                        <View style={ms.classEmpty}>
                          <Ionicons name="school-outline" size={24} color={isDark ? '#334155' : '#CBD5E1'} />
                          <Text style={[ms.classEmptyText, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                            No classes assigned. Switch to One student and search instead.
                          </Text>
                        </View>
                      ) : classStudents.length === 0 ? (
                        <View style={ms.classEmpty}>
                          <Ionicons name="people-outline" size={24} color={isDark ? '#334155' : '#CBD5E1'} />
                          <Text style={[ms.classEmptyText, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                            No students found in this class.
                          </Text>
                        </View>
                      ) : (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          nestedScrollEnabled
                          contentContainerStyle={ms.studentCardRow}
                          style={ms.studentCardScroll}
                        >
                          {classStudents.map((s) => {
                            const checked = selectedStudentIds.includes(s.id);
                            const initial = (s.display_name?.[0] ?? '?').toUpperCase();
                            return (
                              <PressScale key={s.id} onPress={() => toggleStudentSelection(s)}>
                                <View style={[
                                  ms.studentCard,
                                  checked
                                    ? { backgroundColor: isDark ? 'rgba(16,185,129,0.14)' : 'rgba(5,150,105,0.08)', borderColor: isDark ? 'rgba(52,211,153,0.40)' : 'rgba(5,150,105,0.35)' }
                                    : { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                                ]}>
                                  {checked ? (
                                    <View style={[ms.studentCardBadge, { backgroundColor: isDark ? '#34D399' : EM }]}>
                                      <Ionicons name="checkmark" size={11} color="#fff" />
                                    </View>
                                  ) : null}
                                  <View style={[ms.studentCardAvatar, {
                                    backgroundColor: checked
                                      ? (isDark ? 'rgba(16,185,129,0.24)' : 'rgba(5,150,105,0.14)')
                                      : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.10)'),
                                  }]}>
                                    <Text style={[ms.studentCardInitial, {
                                      color: checked ? (isDark ? '#34D399' : EM) : (isDark ? '#CBD5E1' : '#6366F1'),
                                    }]}>
                                      {initial}
                                    </Text>
                                  </View>
                                  <Text style={[ms.studentCardName, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]} numberOfLines={2}>
                                    {s.display_name}
                                  </Text>
                                  <Text style={[ms.studentCardAdm, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                                    #{s.admission_no}
                                  </Text>
                                </View>
                              </PressScale>
                            );
                          })}
                        </ScrollView>
                      )}
                    </View>
                  )}
                </View>

                {/* Step 2 — What */}
                <View style={[ms.stepBlock, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                  <StepHeader
                    step={2}
                    title="What happened?"
                    subtitle="Keep it factual and specific"
                    isDark={isDark}
                    done={titleReady && descReady}
                  />
                  <FormField
                    label="Incident title"
                    required
                    isDark={isDark}
                    icon="title"
                    placeholder="e.g. Disruptive behaviour in Class 10A"
                    value={title}
                    onChangeText={setTitle}
                    error={attemptedSubmit && !titleReady ? 'Title is required' : undefined}
                  />
                  <FormField
                    label="Description"
                    required
                    hint="Time, place, and context help admins act"
                    isDark={isDark}
                    icon="notes"
                    multiline
                    placeholder="What happened, when, and any context…"
                    value={desc}
                    onChangeText={setDesc}
                    error={attemptedSubmit && !descReady ? 'Description is required' : undefined}
                  />
                </View>

                {/* Step 3 — Severity */}
                <View style={[ms.stepBlock, ms.stepBlockLast, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                  <StepHeader
                    step={3}
                    title="How serious?"
                    subtitle="Sets priority for follow-up"
                    isDark={isDark}
                    done
                  />
                  <View style={ms.severityRow}>
                    {SEVERITY_CFG.map((lvl) => {
                      const isActive = severity === lvl.key;
                      return (
                        <PressScale key={lvl.key} onPress={() => setSeverity(lvl.key)} style={{ flex: 1 }}>
                          <View style={[ms.severityChip, {
                            backgroundColor: isActive ? lvl.activeBg : (isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC'),
                            borderColor: isActive ? lvl.color + '55' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'),
                          }]}>
                            <View style={[ms.sevDot, { backgroundColor: lvl.color, opacity: isActive ? 1 : 0.35 }]} />
                            <Text style={[ms.sevText, {
                              color: isActive ? lvl.color : (isDark ? '#94A3B8' : '#64748B'),
                              fontFamily: FONT, fontWeight: isActive ? '700' : '600',
                            }]}>
                              {lvl.key}
                            </Text>
                          </View>
                        </PressScale>
                      );
                    })}
                  </View>
                </View>

                <AnimatedPressable
                  disabled={loading}
                  onPressIn={() => { submitScale.value = withSpring(0.97, { damping: 16, stiffness: 280 }); }}
                  onPressOut={() => { submitScale.value = withSpring(1, { damping: 14, stiffness: 220 }); }}
                  onPress={handleSubmit}
                  style={[submitAnim, { opacity: loading ? 0.7 : 1 }]}
                >
                  <LinearGradient colors={[EM, EM_SOFT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ms.submitGrad}>
                    <View style={ms.submitShine} />
                    {loading ? (
                      <LogoLoader color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="send" size={15} color="#fff" />
                        <Text style={[ms.submitText, { fontFamily: FONT }]}>
                          {studentMode === 'multiple' && selectedStudentIds.length > 1
                            ? `Submit to ${selectedStudentIds.length} students`
                            : 'Submit report'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </AnimatedPressable>
              </View>
            </View>
          </Animated.View>
        )}

        <View style={{ height: activeTab === 'MY_REPORTS' ? 100 : 80 }} />
      </ScrollView>

      {/* Thumb-zone FAB — History only */}
      {activeTab === 'MY_REPORTS' && !loading && (
        <Animated.View entering={FadeInUp.delay(200).duration(320)} style={ms.fabWrap} pointerEvents="box-none">
          <PressScale onPress={() => setActiveTab('FILE_NEW')}>
            <LinearGradient colors={[EM, EM_SOFT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={ms.fab}>
              <Ionicons name="add" size={22} color="#fff" />
              <Text style={[ms.fabText, { fontFamily: FONT }]}>New Report</Text>
            </LinearGradient>
          </PressScale>
        </Animated.View>
      )}

      <DetailSheet
        item={detailItem}
        visible={!!detailItem}
        onClose={() => setDetailItem(null)}
        isDark={isDark}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30 },

  pageHeader: { marginBottom: 14 },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroBadge: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  pageSub: { fontSize: 13, fontWeight: '500', marginTop: 2, lineHeight: 18 },

  statsStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 8, marginBottom: 16, borderRadius: 20,
  },
  statChip: { flex: 1, alignItems: 'center', gap: 2 },
  statNumber: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: '600' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 10 : 12,
    borderRadius: 16, marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', outlineStyle: 'none' as any, padding: 0 },
  searchClear: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, borderWidth: 1,
  },
  filterText: { fontSize: 12, letterSpacing: -0.1 },
  filterCount: { minWidth: 20, height: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  filterCountText: { fontSize: 10, fontWeight: '800' },

  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 10, borderRadius: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  emptyText: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19, maxWidth: 260 },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, marginTop: 8,
  },
  emptyCtaText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  formCard: { borderRadius: 22, overflow: 'hidden' },
  formInner: { padding: 16 },

  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 2 },
  progressItem: { alignItems: 'center', gap: 4, minWidth: 56 },
  progressDot: { width: 22, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  progressNum: { fontSize: 11, fontWeight: '800' },
  progressLabel: { fontSize: 11, fontWeight: '700' },
  progressLine: { flex: 1, height: 2, borderRadius: 1, marginHorizontal: 4, marginBottom: 14 },

  stepBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  stepBlockLast: { marginBottom: 16 },

  modeGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  modeCard: {
    borderRadius: 14, borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: 10,
    alignItems: 'flex-start', minHeight: 88,
  },
  modeIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  modeTitle: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2, marginBottom: 2 },
  modeDesc: { fontSize: 11, fontWeight: '500', lineHeight: 15 },

  inlineError: { color: '#EF4444', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  helperMuted: { fontSize: 12, fontWeight: '500', marginTop: -6, marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '700', letterSpacing: -0.15, marginBottom: 7 },

  classHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 },
  classChipRow: { flexDirection: 'row', gap: 8, paddingRight: 4, paddingBottom: 8 },
  classChip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  classChipText: { fontSize: 13 },
  classLabel: { fontSize: 12, fontWeight: '700' },
  classActions: { flexDirection: 'row', gap: 10 },
  classActionBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  classActionText: { fontSize: 12, fontWeight: '700' },
  classLoading: { alignItems: 'center', paddingVertical: 18, gap: 8 },
  classLoadingText: { fontSize: 13, fontWeight: '500' },
  classEmpty: { alignItems: 'center', paddingVertical: 18, gap: 8 },
  classEmptyText: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19 },
  studentCardScroll: { marginTop: 2, marginHorizontal: -2 },
  studentCardRow: { gap: 10, paddingHorizontal: 2, paddingVertical: 6, paddingRight: 8 },
  studentCard: {
    width: 108, minHeight: 126, paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: 14, alignItems: 'center', position: 'relative', borderWidth: 1.5,
  },
  studentCardBadge: {
    position: 'absolute', top: 6, right: 6, width: 18, height: 18,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  studentCardAvatar: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  studentCardInitial: { fontSize: 16, fontWeight: '800' },
  studentCardName: { fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 15, minHeight: 30 },
  studentCardAdm: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5 },
  selectedAvatar: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  selectedInitial: { fontSize: 14, fontWeight: '800' },
  selectedName: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  selectedAdm: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  clearBtn: { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },

  suggestBox: { marginTop: -6, marginBottom: 8, borderRadius: 14, overflow: 'hidden' },
  suggestItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  suggestAvatar: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  suggestName: { fontSize: 13, fontWeight: '600', letterSpacing: -0.2 },
  suggestAdm: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  severityRow: { flexDirection: 'row', gap: 8 },
  severityChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, minHeight: 44,
  },
  sevDot: { width: 7, height: 7, borderRadius: 4 },
  sevText: { fontSize: 13, letterSpacing: -0.1 },

  submitGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 14, overflow: 'hidden', position: 'relative',
  },
  submitShine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.28)' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },

  fabWrap: {
    position: 'absolute', right: 18, bottom: 24,
    ...Platform.select({
      ios: { shadowColor: EM, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 6 },
      default: {},
    }),
  },
  fab: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 18, borderRadius: 16, overflow: 'hidden',
  },
  fabText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
});
