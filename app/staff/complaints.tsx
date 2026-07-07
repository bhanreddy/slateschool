import React, { useState, useEffect } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withSpring,
  Easing,
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

const { width } = Dimensions.get('window');
const FONT = Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif';
const AnimatedTouch = Animated.createAnimatedComponent(TouchableOpacity);

// ─── Types ─────────────────────────────────────────────────────────
interface UIComplaint extends Complaint {
  color?: string; target?: string; date?: string;
}
interface Student {
  id: string; display_name: string; admission_no: string;
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

// ─── Config ────────────────────────────────────────────────────────
const CATEGORY_CFG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  disciplinary: { color: '#EF4444', bg: 'rgba(239,68,68,0.10)', icon: 'warning', label: 'Disciplinary' },
  academic: { color: '#3B82F6', bg: 'rgba(59,130,246,0.10)', icon: 'school', label: 'Academic' },
  facility: { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', icon: 'apartment', label: 'Facility' },
  default: { color: '#6B7280', bg: 'rgba(107,114,128,0.10)', icon: 'report', label: 'Other' },
};

const PRIORITY_CFG: Record<string, { color: string; bg: string }> = {
  high: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  medium: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  low: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
};

const STATUS_CFG: Record<string, { color: string; bg: string; icon: string }> = {
  resolved: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', icon: 'check-circle' },
  escalated: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: 'arrow-upward' },
  pending: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: 'hourglass-empty' },
};

const SEVERITY_CFG = [
  { key: 'Low', color: '#3B82F6', bg: 'rgba(59,130,246,0.10)', activeBg: 'rgba(59,130,246,0.15)' },
  { key: 'Medium', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', activeBg: 'rgba(245,158,11,0.15)' },
  { key: 'High', color: '#EF4444', bg: 'rgba(239,68,68,0.10)', activeBg: 'rgba(239,68,68,0.15)' },
] as const;

const FILTER_TABS = [
  { key: 'ALL', label: 'All', icon: 'list' },
  { key: 'DISCIPLINARY', label: 'Disciplinary', icon: 'warning' },
  { key: 'FACILITY', label: 'Facility', icon: 'apartment' },
] as const;

// ─── Pressable Chip ────────────────────────────────────────────────
const PressChip = ({ onPress, children, style }: any) => {
  const s = useSharedValue(1);
  return (
    <AnimatedTouch
      activeOpacity={1}
      onPressIn={() => { s.value = withSpring(0.94, { damping: 15, stiffness: 260 }); }}
      onPressOut={() => { s.value = withSpring(1, { damping: 15, stiffness: 260 }); }}
      onPress={onPress}
      style={[useAnimatedStyle(() => ({ transform: [{ scale: s.value }] })), style]}
    >
      {children}
    </AnimatedTouch>
  );
};

// ─── Styled Input ──────────────────────────────────────────────────
const GlassInput = ({
  label, value, onChange, placeholder, isDark,
  multiline, icon, suffix,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; isDark: boolean;
  multiline?: boolean; icon?: string; suffix?: React.ReactNode;
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[gi.label, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>{label}</Text>
      <View style={[
        gi.wrap,
        multiline && gi.multiWrap,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderColor: focused
            ? (isDark ? 'rgba(16,185,129,0.55)' : 'rgba(5,150,105,0.45)')
            : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'),
        }
      ]}>
        {icon && (
          <MaterialIcons name={icon as any} size={15}
            color={focused ? (isDark ? '#34D399' : '#059669') : (isDark ? '#334155' : '#CBD5E1')}
            style={{ marginTop: multiline ? 2 : 0 }}
          />
        )}
        <AppTextInput
          style={[ds.inputInChrome, gi.input, multiline && gi.multiInput, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#2A3444' : '#C4CDD9'}
          value={value}
          onChangeText={onChange}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          numberOfLines={multiline ? 4 : 1}
        />
        {suffix}
      </View>
    </View>
  );
};
const gi = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 13, borderRadius: 14, borderWidth: 1 },
  multiWrap: { alignItems: 'flex-start', paddingVertical: 12 },
  input: { flex: 1, fontSize: 13, fontWeight: '600', letterSpacing: -0.2 },
  multiInput: { minHeight: 90, lineHeight: 20 },
});

// ─── Complaint Card ────────────────────────────────────────────────
const ComplaintCard = ({ item, index, isDark }: { item: UIComplaint; index: number; isDark: boolean }) => {
  const catKey = item.category?.toLowerCase() || 'default';
  const cat = CATEGORY_CFG[catKey] || CATEGORY_CFG.default;
  const pri = PRIORITY_CFG[(item.priority || 'low').toLowerCase()] || PRIORITY_CFG.low;
  const stat = STATUS_CFG[(item.status || 'pending').toLowerCase()] || STATUS_CFG.pending;
  const s = useSharedValue(1);

  return (
    <Animated.View entering={FadeInDown.delay(index * 75).duration(300).easing(Easing.out(Easing.cubic))}>
      <AnimatedTouch
        activeOpacity={1}
        onPressIn={() => { s.value = withSpring(0.975, { damping: 18, stiffness: 220 }); }}
        onPressOut={() => { s.value = withSpring(1, { damping: 18, stiffness: 220 }); }}
        style={[useAnimatedStyle(() => ({ transform: [{ scale: s.value }] })), { marginBottom: 10 }]}
      >
        <BlurView
          intensity={isDark ? 28 : 35} tint={isDark ? 'dark' : 'light'}
          style={[cc.blur, { borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.72)' }]}
        >
          <View style={[cc.inner, { backgroundColor: isDark ? 'rgba(8,12,26,0.55)' : 'rgba(255,255,255,0.62)' }]}>

            {/* Accent bar */}
            <View style={[cc.accentBar, { backgroundColor: cat.color }]} />

            {/* Header */}
            <View style={cc.header}>
              <View style={[cc.iconWrap, { backgroundColor: cat.bg }]}>
                <MaterialIcons name={cat.icon as any} size={18} color={cat.color} />
              </View>

              <View style={cc.headerText}>
                <Text style={[cc.ticketNo, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                  #{item.ticket_no}
                </Text>
                <Text style={[cc.title, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>
                  {item.title}
                </Text>
              </View>

              {/* Priority badge */}
              <View style={[cc.priorityBadge, { backgroundColor: pri.bg, borderColor: pri.color + '30' }]}>
                <Text style={[cc.priorityText, { color: pri.color, fontFamily: FONT }]}>
                  {(item.priority || 'Low').toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Description */}
            {item.description ? (
              <Text style={[cc.desc, { color: isDark ? '#475569' : '#64748B', fontFamily: FONT }]} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}

            {/* Footer */}
            <View style={[cc.footer, { borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
              <View style={cc.footerLeft}>
                <View style={[cc.catPill, { backgroundColor: cat.bg }]}>
                  <Text style={[cc.catText, { color: cat.color, fontFamily: FONT }]}>{cat.label}</Text>
                </View>
                <View style={cc.dateMeta}>
                  <Ionicons name="time-outline" size={11} color={isDark ? '#334155' : '#CBD5E1'} />
                  <Text style={[cc.dateText, { color: isDark ? '#334155' : '#94A3B8', fontFamily: FONT }]}>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                  </Text>
                </View>
              </View>
              <View style={[cc.statusBadge, { backgroundColor: stat.bg, borderColor: stat.color + '30' }]}>
                <MaterialIcons name={stat.icon as any} size={10} color={stat.color} />
                <Text style={[cc.statusText, { color: stat.color, fontFamily: FONT }]}>
                  {(item.status || 'pending').toUpperCase()}
                </Text>
              </View>
            </View>

          </View>
        </BlurView>
      </AnimatedTouch>
    </Animated.View>
  );
};

const cc = StyleSheet.create({
  blur: { borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  inner: { borderRadius: 20, overflow: 'hidden' },
  accentBar: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3.5, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, paddingLeft: 18, paddingBottom: 8 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  headerText: { flex: 1 },
  ticketNo: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, borderWidth: 1 },
  priorityText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  desc: { fontSize: 12, lineHeight: 18, paddingHorizontal: 18, paddingBottom: 10, letterSpacing: -0.1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  catText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 11, fontWeight: '500' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, borderWidth: 1 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
});

// ─── Animated Tab Switcher ─────────────────────────────────────────
const TAB_DEFS = [
  { key: 'MY_REPORTS' as const, label: 'History', icon: 'history' },
  { key: 'FILE_NEW' as const, label: 'File New Report', icon: 'edit' },
];

const TabSwitcher = ({
  activeTab, onSwitch, isDark,
}: { activeTab: 'MY_REPORTS' | 'FILE_NEW'; onSwitch: (k: 'MY_REPORTS' | 'FILE_NEW') => void; isDark: boolean }) => {
  // Sliding pill translateX
  const slideX = useSharedValue(0);
  const pillWidth = useSharedValue(0);

  // Track each tab's measured x + width
  const tabLayouts = React.useRef<{ x: number; width: number }[]>([]);

  const slideToTab = (index: number) => {
    const layout = tabLayouts.current[index];
    if (layout) {
      slideX.value = withSpring(layout.x, { damping: 20, stiffness: 260 });
      pillWidth.value = withSpring(layout.width, { damping: 20, stiffness: 260 });
    }
  };

  // Slide on mount + tab change
  useEffect(() => {
    const idx = TAB_DEFS.findIndex(t => t.key === activeTab);
    // Slight delay to let layout settle on first render
    const t = setTimeout(() => slideToTab(idx), 50);
    return () => clearTimeout(t);
  }, [activeTab]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
    width: pillWidth.value,
  }));

  // Scale for individual tab presses
  const scales = TAB_DEFS.map(() => useSharedValue(1));

  return (
    <Animated.View
      entering={FadeInDown.delay(80).duration(340).easing(Easing.out(Easing.cubic))}
      style={[ts.outerWrap, {
        shadowColor: isDark ? '#10B981' : '#059669',
      }]}
    >
      {/* Ambient glow */}
      <View style={[ts.glow, {
        backgroundColor: isDark ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.05)',
      }]} />

      <BlurView
        intensity={isDark ? 45 : 85}
        tint={isDark ? 'dark' : 'light'}
        style={[ts.blurWrap, {
          backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(16,185,129,0.06)',
          borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.8)',
        }]}
      >
        {/* Inner shadow simulation for inset effect */}
        <View style={[StyleSheet.absoluteFill, {
          borderRadius: 22,
          borderWidth: 1.5,
          borderColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(16,185,129,0.03)'
        }]} />

        <View style={[ts.track, {
          backgroundColor: 'transparent',
        }]}>

          {/* Sliding pill */}
          <Animated.View style={[ts.slidePill, pillStyle, {
            shadowColor: isDark ? '#000000' : '#475569',
            backgroundColor: isDark ? 'rgba(22,32,26,0.95)' : 'rgba(255,255,255,1)',
          }]}>
            {/* Solid Pill border */}
            <View style={[ts.pillBorder, {
              borderColor: isDark ? 'rgba(52,211,153,0.35)' : 'rgba(16,185,129,0.12)',
              borderWidth: isDark ? 1 : 1,
            }]} />
          </Animated.View>

          {/* Tab buttons */}
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
                onLayout={e => {
                  tabLayouts.current[idx] = {
                    x: e.nativeEvent.layout.x,
                    width: e.nativeEvent.layout.width,
                  };
                  // Update slide position on initial layout
                  if (tab.key === activeTab) {
                    slideX.value = e.nativeEvent.layout.x;
                    pillWidth.value = e.nativeEvent.layout.width;
                  }
                }}
              >
                {/* Icon container */}
                <View style={[ts.iconWrap, isActive && {
                  backgroundColor: isDark ? 'rgba(52,211,153,0.18)' : 'rgba(16,185,129,0.12)'
                }]}>
                  <MaterialIcons
                    name={tab.icon as any}
                    size={16}
                    color={isActive
                      ? (isDark ? '#34D399' : '#059669')
                      : (isDark ? '#64748B' : '#94A3B8')}
                  />
                </View>

                <Text style={[ts.tabLabel, {
                  color: isActive
                    ? (isDark ? '#34D399' : '#059669')
                    : (isDark ? '#64748B' : '#94A3B8'),
                  fontFamily: FONT,
                  fontWeight: isActive ? '700' : '600',
                }]}>
                  {tab.label}
                </Text>

                {/* Active dot */}
                {isActive && (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    style={[ts.activeDot, { backgroundColor: isDark ? '#34D399' : '#059669' }]}
                  />
                )}
              </AnimatedTouch>
            );
          })}

        </View>
      </BlurView>
    </Animated.View>
  );
};

const ts = StyleSheet.create({
  outerWrap: {
    marginBottom: 20,
    borderRadius: 22,
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  glow: {
    position: 'absolute',
    top: 4, left: 6, right: 6, bottom: -6,
    borderRadius: 22,
  },
  blurWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  shimmer: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 22,
    position: 'relative',
    gap: 0,
  },
  // Sliding pill
  slidePill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 18,
    overflow: 'hidden',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    zIndex: 0,
  },
  pillShimmer: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Tab buttons
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 16,
    zIndex: 1,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: 1,
  },
});

// ─── Main Screen ───────────────────────────────────────────────────
export default function StaffComplaints() {
  const { isDark } = useTheme();
  const { isViewingAsAdmin, viewAsName, staffId } = useEffectiveStaffId();

  const [activeTab, setActiveTab] = useState<'MY_REPORTS' | 'FILE_NEW'>('MY_REPORTS');
  const [loading, setLoading] = useState(false);
  const [complaints, setComplaints] = useState<UIComplaint[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'DISCIPLINARY' | 'FACILITY'>('ALL');

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

      if (sections.length === 0) {
        setClassStudents([]);
      }
    } catch {
      loadedSections = [];
      setClassSections([]);
      setSelectedClassSectionId(null);
      setClassStudents([]);
    } finally {
      if (loadedSections.length === 0) {
        setLoadingClass(false);
      }
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

  const selectAllClassStudents = () => {
    setSelectedStudentIds(classStudents.map((s) => s.id));
  };

  const clearClassSelection = () => {
    setSelectedStudentIds([]);
  };

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
      setComplaints(data.map(item => ({
        ...item,
        color: CATEGORY_CFG[item.category?.toLowerCase() || 'default']?.color || '#6B7280',
        date: new Date(item.created_at).toLocaleDateString(),
      })));
    } catch { alertCompat('Error', 'Failed to load reports'); }
    finally { setLoading(false); }
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
    } catch { } finally { setIsSearching(false); }
  };

  const handleSubmit = async () => {
    if (isViewingAsAdmin) {
      alertCompat('Read-only', 'Complaints can\'t be filed while viewing another staff member\'s portal.');
      return;
    }
    if (!title || !desc) {
      alertCompat('Missing Fields', 'Please fill in the title and description.');
      return;
    }
    if (studentMode === 'single' && !selectedStudent) {
      alertCompat('Missing Student', 'Please select a student.');
      return;
    }
    if (studentMode === 'multiple' && selectedStudentIds.length === 0) {
      alertCompat('Missing Students', 'Please select at least one student from your class.');
      return;
    }
    try {
      setLoading(true);
      if (studentMode === 'single') {
        await ComplaintService.create({
          title, description: desc, category: 'disciplinary',
          priority: severity.toLowerCase(),
          raised_for_student_id: selectedStudent!.id,
        });
        alertCompat('Submitted', 'Report submitted successfully.');
      } else {
        const result = await ComplaintService.createBulk({
          title, description: desc, category: 'disciplinary',
          priority: severity.toLowerCase(),
          raised_for_student_ids: selectedStudentIds,
        });
        alertCompat('Submitted', `Report sent to ${result.count} student(s).`);
      }
      setTitle(''); setDesc(''); setStudentSearch('');
      setSelectedStudent(null); setSelectedStudentIds([]);
      setSeverity('Low'); setStudentMode('single');
      setActiveTab('MY_REPORTS');
    } catch { alertCompat('Error', 'Failed to submit report.'); }
    finally { setLoading(false); }
  };

  const filtered = complaints.filter(c => {
    if (filterType === 'ALL') return true;
    return c.category?.toUpperCase() === filterType;
  });


  return (
    <View style={{ flex: 1 }}>
      {/* Background */}
      <LinearGradient
        colors={isDark ? ['#06040F', '#0C0820', '#080614'] : ['#F0F4FF', '#EAF0FF', '#F6F2FF']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }}
      />

      <StaffHeader title="Complaints & Remarks" showBackButton />
      {isViewingAsAdmin && <ViewAsBanner name={viewAsName} limited />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={ms.scroll}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Page Header ── */}
        <Animated.View entering={FadeInDown.delay(40).duration(300)} style={ms.pageHeader}>
          <View>
            <Text style={[ms.pageTitle, { color: isDark ? '#EEF2FF' : '#06101E', fontFamily: FONT }]}>
              Student Disciplinary
            </Text>
            <Text style={[ms.pageSub, { color: isDark ? '#475569' : '#94A3B8', fontFamily: FONT }]}>
              Track and manage student behaviour records
            </Text>
          </View>

          {/* Report count pill */}
          <View style={[ms.countPill, { backgroundColor: isDark ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.08)', borderColor: isDark ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.15)' }]}>
            <MaterialIcons name="warning" size={12} color="#EF4444" />
            <Text style={[ms.countText, { color: '#EF4444', fontFamily: FONT }]}>{complaints.length}</Text>
          </View>
        </Animated.View>

        {/* ── Tab Switcher ── */}
        <TabSwitcher activeTab={activeTab} onSwitch={setActiveTab} isDark={isDark} />

        {/* ── History Tab ── */}
        {activeTab === 'MY_REPORTS' && (
          <Animated.View entering={FadeIn.duration(280)}>

            {/* Filter row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
              {FILTER_TABS.map(f => {
                const isActive = filterType === f.key;
                return (
                  <PressChip key={f.key} onPress={() => setFilterType(f.key)}>
                    <View style={[
                      ms.filterChip,
                      {
                        backgroundColor: isActive
                          ? (isDark ? 'rgba(16,185,129,0.18)' : 'rgba(5,150,105,0.10)')
                          : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                        borderColor: isActive
                          ? (isDark ? 'rgba(16,185,129,0.40)' : 'rgba(5,150,105,0.30)')
                          : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                      }
                    ]}>
                      <MaterialIcons
                        name={f.icon as any} size={12}
                        color={isActive ? (isDark ? '#34D399' : '#059669') : (isDark ? '#475569' : '#94A3B8')}
                      />
                      <Text style={[
                        ms.filterText,
                        { color: isActive ? (isDark ? '#34D399' : '#059669') : (isDark ? '#475569' : '#94A3B8'), fontFamily: FONT },
                        isActive && { fontWeight: '700' },
                      ]}>
                        {f.label}
                      </Text>
                    </View>
                  </PressChip>
                );
              })}
            </ScrollView>

            {loading ? (
              <View style={ms.centered}>
                <LogoLoader size={60} color={isDark ? '#34D399' : '#059669'} />
              </View>
            ) : filtered.length === 0 ? (
              <Animated.View entering={FadeIn.duration(280)} style={ms.emptyState}>
                <View style={[ms.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]}>
                  <Ionicons name="document-text-outline" size={36} color={isDark ? '#2C3A50' : '#CDD7E6'} />
                </View>
                <Text style={[ms.emptyText, { color: isDark ? '#475569' : '#94A3B8', fontFamily: FONT }]}>No reports found</Text>
              </Animated.View>
            ) : (
              filtered.map((item, i) => <ComplaintCard key={item.id} item={item} index={i} isDark={isDark} />)
            )}
          </Animated.View>
        )}

        {/* ── File New Tab ── */}
        {activeTab === 'FILE_NEW' && (
          <Animated.View entering={FadeInDown.delay(60).duration(300).easing(Easing.out(Easing.cubic))}>
            <BlurView
              intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'}
              style={[ms.formBlur, { borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.75)' }]}
            >
              <View style={[ms.formInner, { backgroundColor: isDark ? 'rgba(8,6,20,0.58)' : 'rgba(255,255,255,0.68)' }]}>

                {/* Shimmer */}
                <View style={[ms.formShimmer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.90)' }]} />

                {/* Form title */}
                <View style={ms.formTitleRow}>
                  <View style={[ms.formTitleIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                    <MaterialIcons name="report" size={16} color="#EF4444" />
                  </View>
                  <View>
                    <Text style={[ms.formTitle, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>New Report</Text>
                    <Text style={[ms.formSub, { color: isDark ? '#475569' : '#94A3B8', fontFamily: FONT }]}>Fill in the incident details</Text>
                  </View>
                </View>

                {/* Student picker */}
                <View style={{ marginBottom: 18 }}>
                  <Text style={[gi.label, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>Students</Text>

                  <View style={ms.modeRow}>
                    {([
                      { key: 'single' as const, label: 'One Student', icon: 'person-outline' },
                      { key: 'multiple' as const, label: 'Multiple from Class', icon: 'people-outline' },
                    ]).map((mode) => {
                      const active = studentMode === mode.key;
                      return (
                        <PressChip key={mode.key} onPress={() => switchStudentMode(mode.key)} style={{ flex: 1 }}>
                          <View style={[ms.modeChip, {
                            backgroundColor: active
                              ? (isDark ? 'rgba(16,185,129,0.18)' : 'rgba(5,150,105,0.10)')
                              : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                            borderColor: active
                              ? (isDark ? 'rgba(16,185,129,0.40)' : 'rgba(5,150,105,0.30)')
                              : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                          }]}>
                            <Ionicons
                              name={mode.icon as any}
                              size={14}
                              color={active ? (isDark ? '#34D399' : '#059669') : (isDark ? '#475569' : '#94A3B8')}
                            />
                            <Text style={[ms.modeChipText, {
                              color: active ? (isDark ? '#34D399' : '#059669') : (isDark ? '#475569' : '#94A3B8'),
                              fontFamily: FONT,
                              fontWeight: active ? '700' : '500',
                            }]}>{mode.label}</Text>
                          </View>
                        </PressChip>
                      );
                    })}
                  </View>

                  {studentMode === 'single' ? (
                  selectedStudent ? (
                    <View style={[ms.selectedChip, {
                      backgroundColor: 'rgba(16,185,129,0.12)',
                      borderColor: 'rgba(16,185,129,0.30)',
                    }]}>
                      <View style={[ms.selectedAvatar, { backgroundColor: 'rgba(16,185,129,0.20)' }]}>
                        <Ionicons name="person" size={14} color="#10B981" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[ms.selectedName, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>
                          {selectedStudent.display_name}
                        </Text>
                        <Text style={[ms.selectedAdm, { color: isDark ? '#475569' : '#94A3B8', fontFamily: FONT }]}>
                          #{selectedStudent.admission_no}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => { setSelectedStudent(null); setStudentSearch(''); }}
                        style={[ms.clearBtn, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                        <Ionicons name="close" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      <View style={[gi.wrap, ds.searchBarWrapper, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
                      }]}>
                        <Ionicons name="search-outline" size={15} color={isDark ? '#334155' : '#CBD5E1'} />
                        <AppTextInput
                          style={[ds.inputInChrome, gi.input, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}
                          placeholder="Search student name or roll…"
                          placeholderTextColor={isDark ? '#2A3444' : '#C4CDD9'}
                          value={studentSearch}
                          onChangeText={setStudentSearch}
                        />
                        {isSearching && <LogoLoader size={30} color={isDark ? '#34D399' : '#059669'} />}
                      </View>

                      {studentSearch.length > 2 && studentsList.length > 0 && (
                        <BlurView
                          intensity={isDark ? 40 : 55} tint={isDark ? 'dark' : 'light'}
                          style={[ms.suggestBlur, { borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.80)' }]}
                        >
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
                                <Ionicons name="person-outline" size={13} color={isDark ? '#34D399' : '#059669'} />
                              </View>
                              <View>
                                <Text style={[ms.suggestName, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>{s.display_name}</Text>
                                <Text style={[ms.suggestAdm, { color: isDark ? '#475569' : '#94A3B8', fontFamily: FONT }]}>#{s.admission_no}</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </BlurView>
                      )}
                    </View>
                  )
                  ) : (
                    <View>
                      {classSections.length > 0 ? (
                        <>
                          <Text style={[gi.label, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT, marginBottom: 8, marginTop: 4 }]}>
                            Class
                          </Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={ms.classChipRow}
                          >
                            {classSections.map((section) => {
                              const active = selectedClassSectionId === section.class_section_id;
                              return (
                                <TouchableOpacity
                                  key={section.class_section_id}
                                  style={[ms.classChip, {
                                    backgroundColor: active
                                      ? (isDark ? 'rgba(16,185,129,0.18)' : 'rgba(5,150,105,0.10)')
                                      : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                                    borderColor: active
                                      ? (isDark ? 'rgba(16,185,129,0.40)' : 'rgba(5,150,105,0.30)')
                                      : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                                  }]}
                                  onPress={() => setSelectedClassSectionId(section.class_section_id)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[ms.classChipText, {
                                    color: active ? (isDark ? '#34D399' : '#059669') : (isDark ? '#94A3B8' : '#64748B'),
                                    fontFamily: FONT,
                                    fontWeight: active ? '700' : '600',
                                  }]}>
                                    {section.label.replace('-', ' ')}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                          <View style={ms.classHeaderRow}>
                            <Text style={[ms.classLabel, { color: isDark ? '#CBD5E1' : '#475569', fontFamily: FONT }]}>
                              {classStudents.length} student{classStudents.length === 1 ? '' : 's'}
                            </Text>
                            <View style={ms.classActions}>
                              <TouchableOpacity onPress={selectAllClassStudents} style={ms.classActionBtn}>
                                <Text style={[ms.classActionText, { color: isDark ? '#34D399' : '#059669', fontFamily: FONT }]}>Select all</Text>
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
                          <LogoLoader size={36} color={isDark ? '#34D399' : '#059669'} />
                          <Text style={[ms.classLoadingText, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                            {classSections.length === 0 ? 'Loading your classes…' : 'Loading students…'}
                          </Text>
                        </View>
                      ) : classSections.length === 0 ? (
                        <View style={ms.classEmpty}>
                          <Ionicons name="school-outline" size={28} color={isDark ? '#334155' : '#CBD5E1'} />
                          <Text style={[ms.classEmptyText, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                            No classes assigned. Use single-student search instead.
                          </Text>
                        </View>
                      ) : classStudents.length === 0 ? (
                        <View style={ms.classEmpty}>
                          <Ionicons name="people-outline" size={28} color={isDark ? '#334155' : '#CBD5E1'} />
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
                              <TouchableOpacity
                                key={s.id}
                                style={[
                                  ms.studentCard,
                                  {
                                    backgroundColor: checked
                                      ? (isDark ? 'rgba(16,185,129,0.14)' : '#ECFDF5')
                                      : (isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF'),
                                    borderColor: checked
                                      ? (isDark ? '#34D399' : '#059669')
                                      : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'),
                                  },
                                  checked && ms.studentCardSelected,
                                ]}
                                onPress={() => toggleStudentSelection(s)}
                                activeOpacity={0.82}
                              >
                                {checked ? (
                                  <View style={[ms.studentCardBadge, { backgroundColor: isDark ? '#34D399' : '#059669' }]}>
                                    <Ionicons name="checkmark" size={11} color="#fff" />
                                  </View>
                                ) : null}
                                <View style={[ms.studentCardAvatar, {
                                  backgroundColor: checked
                                    ? (isDark ? 'rgba(16,185,129,0.24)' : 'rgba(5,150,105,0.12)')
                                    : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.10)'),
                                }]}>
                                  <Text style={[ms.studentCardInitial, {
                                    color: checked ? (isDark ? '#34D399' : '#059669') : (isDark ? '#CBD5E1' : '#6366F1'),
                                  }]}>
                                    {initial}
                                  </Text>
                                </View>
                                <Text
                                  style={[ms.studentCardName, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}
                                  numberOfLines={2}
                                >
                                  {s.display_name}
                                </Text>
                                <Text style={[ms.studentCardAdm, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                                  #{s.admission_no}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      )}

                      {selectedStudentIds.length > 0 && (
                        <Text style={[ms.selectedCount, { color: isDark ? '#34D399' : '#059669', fontFamily: FONT }]}>
                          {selectedStudentIds.length} student{selectedStudentIds.length === 1 ? '' : 's'} selected
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Incident Title */}
                <GlassInput label="Incident Title" value={title} onChange={setTitle} isDark={isDark}
                  placeholder="e.g. Late Arrival, Uniform Violation" icon="title" />

                {/* Description */}
                <GlassInput label="Description" value={desc} onChange={setDesc} isDark={isDark}
                  placeholder="Detailed description of the incident…" icon="notes" multiline />

                {/* Severity */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={[gi.label, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>Severity Level</Text>
                  <View style={ms.severityRow}>
                    {SEVERITY_CFG.map(lvl => {
                      const isActive = severity === lvl.key;
                      return (
                        <PressChip key={lvl.key} onPress={() => setSeverity(lvl.key)} style={{ flex: 1 }}>
                          <View style={[ms.severityChip, {
                            backgroundColor: isActive ? lvl.activeBg : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                            borderColor: isActive ? lvl.color + '50' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                          }]}>
                            <View style={[ms.sevDot, { backgroundColor: lvl.color, opacity: isActive ? 1 : 0.35 }]} />
                            <Text style={[ms.sevText, {
                              color: isActive ? lvl.color : (isDark ? '#475569' : '#94A3B8'),
                              fontFamily: FONT, fontWeight: isActive ? '700' : '500',
                            }]}>{lvl.key}</Text>
                          </View>
                        </PressChip>
                      );
                    })}
                  </View>
                </View>

                {/* Submit */}
                <AnimatedTouch
                  activeOpacity={1}
                  disabled={loading}
                  onPressIn={() => { }}
                  onPressOut={() => { }}
                  onPress={handleSubmit}
                  style={{ opacity: loading ? 0.7 : 1 }}
                >
                  <LinearGradient
                    colors={['#059669', '#10B981']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={ms.submitGrad}
                  >
                    <View style={ms.submitShine} />
                    {loading
                      ? <LogoLoader color="#fff" />
                      : <>
                        <Ionicons name="send" size={15} color="#fff" />
                        <Text style={[ms.submitText, { fontFamily: FONT }]}>
                          {studentMode === 'multiple' && selectedStudentIds.length > 1
                            ? `Submit to ${selectedStudentIds.length} Students`
                            : 'Submit Report'}
                        </Text>
                      </>
                    }
                  </LinearGradient>
                </AnimatedTouch>

              </View>
            </BlurView>
          </Animated.View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 30 },

  // Page header
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.7 },
  pageSub: { fontSize: 13, fontWeight: '500', marginTop: 3 },
  countPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  countText: { fontSize: 13, fontWeight: '800', letterSpacing: -0.3 },

  // Filter chips
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '600', letterSpacing: -0.1 },

  centered: { marginTop: 60, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 52, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },

  // Form card
  formBlur: { borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, shadowColor: '#059669', shadowOpacity: 0.10, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  formInner: { padding: 20, borderRadius: 24 },
  formShimmer: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  formTitleIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  formTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  formSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  modeChipText: { fontSize: 12, letterSpacing: -0.1 },

  classHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 10 },
  classChipRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  classChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  classChipText: { fontSize: 13 },
  classLabel: { fontSize: 13, fontWeight: '700' },
  classActions: { flexDirection: 'row', gap: 10 },
  classActionBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  classActionText: { fontSize: 12, fontWeight: '700' },
  classLoading: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  classLoadingText: { fontSize: 13, fontWeight: '500' },
  classEmpty: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  classEmptyText: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19 },
  studentCardScroll: { marginTop: 2, marginHorizontal: -2 },
  studentCardRow: { gap: 12, paddingHorizontal: 2, paddingVertical: 10, paddingRight: 8 },
  studentCard: {
    width: 128,
    minHeight: 148,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
      default: {
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
      },
    }),
  },
  studentCardSelected: {
    ...Platform.select({
      ios: { shadowOpacity: 0.14, shadowRadius: 12 },
      android: { elevation: 5 },
      default: {
        boxShadow: '0 10px 28px rgba(5, 150, 105, 0.18)',
      },
    }),
  },
  studentCardBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  studentCardInitial: { fontSize: 18, fontWeight: '800' },
  studentCardName: { fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 16, minHeight: 32 },
  studentCardAdm: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  selectedCount: { marginTop: 8, fontSize: 12, fontWeight: '700' },

  // Student chip
  selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  selectedAvatar: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  selectedName: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  selectedAdm: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  clearBtn: { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },

  // Suggestions dropdown
  suggestBlur: { marginTop: 6, borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  suggestItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  suggestAvatar: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  suggestName: { fontSize: 13, fontWeight: '600', letterSpacing: -0.2 },
  suggestAdm: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  // Severity
  severityRow: { flexDirection: 'row', gap: 10 },
  severityChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 13, borderWidth: 1 },
  sevDot: { width: 6, height: 6, borderRadius: 3 },
  sevText: { fontSize: 13, letterSpacing: -0.1 },

  // Submit
  submitGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  submitShine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
});