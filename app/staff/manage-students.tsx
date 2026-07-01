import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import StaffHeader from '../../src/components/StaffHeader';
import SwipeableStudentCard from '../../src/components/SwipeableStudentCard';
import { useAuth } from '../../src/hooks/useAuth';
import { AttendanceService } from '../../src/services/attendanceService';
import { AttendanceStatus } from '../../src/types/schema';
import { useTheme } from '../../src/hooks/useTheme';
import type { SchoolTheme } from '../../src/theme/types';
import LogoLoader from '../../src/components/LogoLoader';
import ViewAsBanner from '../../src/components/ViewAsBanner';
import { useEffectiveStaffId } from '../../src/hooks/useEffectiveStaffId';

interface StudentUI {
  id: string;
  enrollmentId?: string;
  name: string;
  rollNo: string;
  status: 'present' | 'absent' | 'unmarked';
}

const ACCENT = {
  emerald: '#10B981',
  emeraldSoft: '#34D399',
  rose: '#EF4444',
  roseSoft: '#F87171',
  amber: '#F59E0B',
  violet: '#6C63FF',
  blue: '#3D8EFF',
};

const IS_WEB = Platform.OS === 'web';

// ─── Animated progress bar ───────────────────────────────────────────────────
function ProgressBar({
  filled,
  total,
  color,
  trackColor,
}: {
  filled: number;
  total: number;
  color: string;
  trackColor: string;
}) {
  const pct = total > 0 ? filled / total : 0;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [pct, anim]);

  return (
    <View style={[pb.track, { backgroundColor: trackColor }]}>
      <Animated.View
        style={[
          pb.fill,
          {
            backgroundColor: color,
            width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

const pb = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
    width: '100%',
  },
  fill: { height: 4, borderRadius: 4 },
});

// ─── Stat column ─────────────────────────────────────────────────────────────
function StatColumn({
  icon,
  countLabel,
  label,
  color,
  softColor,
  filled,
  total,
  isDark,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  countLabel: string;
  label: string;
  color: string;
  softColor: string;
  filled: number;
  total: number;
  isDark: boolean;
}) {
  const trackColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  return (
    <View style={statCol.wrap}>
      <LinearGradient
        colors={isDark ? [`${color}22`, `${color}0D`] : [`${color}18`, `${color}08`]}
        style={statCol.iconRing}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name={icon} size={18} color={softColor} />
      </LinearGradient>
      <Text style={[statCol.count, { color }]}>{countLabel}</Text>
      <Text style={[statCol.lbl, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.45)' }]}>{label}</Text>
      <ProgressBar filled={filled} total={total} color={color} trackColor={trackColor} />
    </View>
  );
}

const statCol = StyleSheet.create({
  wrap: { flex: 1, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center' },
  iconRing: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  count: { fontSize: 24, fontWeight: '800', letterSpacing: -0.8 },
  lbl: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
});

// ─── Main ────────────────────────────────────────────────────────────────────
export default function ManageStudents() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const router = useRouter();
  const { user } = useAuth();
  const { staffId, isViewingAsAdmin, viewAsName } = useEffectiveStaffId();

  const [students, setStudents] = useState<StudentUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [detectedClassId, setDetectedClassId] = useState<string | null>(null);

  const present = students.filter((s) => s.status === 'present').length;
  const absent = students.filter((s) => s.status === 'absent').length;
  const unmarked = students.filter((s) => s.status === 'unmarked').length;
  const total = students.length;
  const completionPct = total > 0 ? Math.round(((present + absent) / total) * 100) : 0;
  const canSubmit = total > 0 && unmarked === 0;

  const loadStudents = useCallback(async () => {
    if (!user) return;
    try {
      const myClass = await AttendanceService.getMyClass(undefined, staffId);
      if (!myClass) {
        setStudents([]);
        setDetectedClassId(null);
        setLoading(false);
        return;
      }
      setDetectedClassId(myClass.class_section_id);
      const formatted = myClass.students.map((s) => ({
        id: s.student_id,
        enrollmentId: s.enrollment_id,
        name: s.student_name,
        rollNo: s.admission_no,
        status: (s.status === 'present' || s.status === 'absent' ? s.status : 'unmarked') as StudentUI['status'],
      }));
      setStudents(formatted);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [user, staffId]);

  // Reload every time the Attendance tab regains focus so that class-teacher /
  // timetable edits made in the admin timetable manager are reflected here without
  // requiring an app restart.
  useFocusEffect(
    useCallback(() => {
      loadStudents();
    }, [loadStudents])
  );

  const handleStatusChange = useCallback((id: string, newStatus: StudentUI['status']) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)));
  }, []);

  const handleSubmit = async () => {
    if (students.length === 0) {
      alertCompat('No Data', 'No students to submit.');
      return;
    }
    if (unmarked > 0) {
      alertCompat('Incomplete', `${unmarked} student${unmarked > 1 ? 's' : ''} still unmarked.`);
      return;
    }
    try {
      setSubmitting(true);
      if (!detectedClassId) {
        alertCompat('Error', 'No class assigned.');
        return;
      }
      const date = new Date().toISOString().split('T')[0];
      await AttendanceService.markAttendance({
        class_section_id: detectedClassId,
        date,
        records: students
          .filter((s) => s.enrollmentId)
          .map((s) => ({ student_id: s.id, status: s.status as AttendanceStatus })),
      });
      alertCompat('Submitted!', `Present: ${present}   Absent: ${absent}`);
      router.back();
    } catch (error: any) {
      alertCompat('Error', 'Failed to submit attendance: ' + (error?.message || JSON.stringify(error)));
    } finally {
      setSubmitting(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.statsOuter}>
      <LinearGradient
        colors={[ACCENT.violet, ACCENT.blue]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.statsTopAccent}
      />
      <View style={styles.statsCard}>
        <View style={styles.statsCardHeader}>
          <View style={styles.statsCardTitleRow}>
            <Ionicons name="clipboard-outline" size={18} color={ACCENT.violet} />
            <Text style={styles.statsCardTitle}>Roll call</Text>
          </View>
          <View
            style={[
              styles.completionChip,
              completionPct === 100
                ? { backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#DCFCE7' }
                : { backgroundColor: isDark ? 'rgba(245,158,11,0.18)' : '#FEF3C7' },
            ]}
          >
            <Text
              style={[
                styles.completionChipText,
                { color: completionPct === 100 ? ACCENT.emerald : ACCENT.amber },
              ]}
            >
              {completionPct}% complete
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatColumn
            icon="checkmark-circle"
            countLabel={`${present}`}
            label="Present"
            color={ACCENT.emerald}
            softColor={ACCENT.emeraldSoft}
            filled={present}
            total={total}
            isDark={isDark}
          />
          <View style={styles.statDivider} />
          <StatColumn
            icon="close-circle"
            countLabel={`${absent}`}
            label="Absent"
            color={ACCENT.rose}
            softColor={ACCENT.roseSoft}
            filled={absent}
            total={total}
            isDark={isDark}
          />
          <View style={styles.statDivider} />
          <StatColumn
            icon="time-outline"
            countLabel={`${unmarked}`}
            label="Pending"
            color={ACCENT.amber}
            softColor="#FBBF24"
            filled={unmarked}
            total={total}
            isDark={isDark}
          />
        </View>
      </View>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <StaffHeader
          title="Attendance"
          subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          showBackButton
          showMenuButton={false}
        />
        {isViewingAsAdmin && <ViewAsBanner name={viewAsName} />}

        {loading ? (
          <View style={styles.loadingState}>
            <View style={styles.loadingGlow}>
              <LogoLoader size={56} color={ACCENT.violet} />
            </View>
            <Text style={styles.loadingText}>Loading your class…</Text>
          </View>
        ) : students.length === 0 ? (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={isDark ? ['rgba(108,99,255,0.25)', 'rgba(61,142,255,0.12)'] : ['rgba(108,99,255,0.15)', 'rgba(61,142,255,0.08)']}
              style={styles.emptyIconRing}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="people-outline" size={44} color={ACCENT.violet} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No class assigned</Text>
            <Text style={styles.emptySubtitle}>Ask your admin to link a class section to your profile, then return to this screen.</Text>
          </View>
        ) : (
          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <>
                {renderHeader()}
                <View style={styles.listMeta}>
                  <View style={styles.listMetaLeft}>
                    <LinearGradient colors={[ACCENT.violet, ACCENT.emerald]} style={styles.sectionAccent} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
                    <Text style={styles.listMetaText}>Students</Text>
                  </View>
                  {unmarked > 0 ? (
                    <View style={styles.unmarkedBadge}>
                      <View style={styles.unmarkedDot} />
                      <Text style={styles.unmarkedBadgeText}>
                        {unmarked} pending
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.allMarkedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={ACCENT.emerald} />
                      <Text style={styles.allMarkedText}>All marked</Text>
                    </View>
                  )}
                </View>
              </>
            }
            renderItem={({ item }) => <SwipeableStudentCard student={item} onStatusChange={handleStatusChange} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {!loading && students.length > 0 && (
          <View style={styles.footer}>
            <View style={styles.footerInner}>
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[styles.quickBtn, styles.quickBtnPresent, IS_WEB && { cursor: 'pointer' }]}
                  activeOpacity={0.88}
                  onPress={() => setStudents((prev) => prev.map((s) => ({ ...s, status: 'present' })))}
                >
                  <View style={styles.quickBtnIcon}>
                    <Ionicons name="checkmark-done" size={16} color={ACCENT.emerald} />
                  </View>
                  <Text style={[styles.quickBtnText, { color: ACCENT.emerald }]}>All present</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickBtn, styles.quickBtnReset, IS_WEB && { cursor: 'pointer' }]}
                  activeOpacity={0.88}
                  onPress={() => setStudents((prev) => prev.map((s) => ({ ...s, status: 'unmarked' })))}
                >
                  <View style={[styles.quickBtnIcon, styles.quickBtnIconMuted]}>
                    <Ionicons name="refresh" size={16} color={theme.colors.textSecondary} />
                  </View>
                  <Text style={[styles.quickBtnText, { color: theme.colors.textSecondary }]}>Reset</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleSubmit}
                disabled={submitting || !canSubmit}
                style={IS_WEB ? ({ cursor: submitting || !canSubmit ? 'not-allowed' : 'pointer' } as object) : undefined}
              >
                <LinearGradient
                  colors={
                    canSubmit
                      ? [ACCENT.violet, '#5548E8', ACCENT.blue]
                      : isDark
                        ? ['rgba(100,100,110,0.5)', 'rgba(70,70,80,0.45)']
                        : ['#CBD5E1', '#94A3B8']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.submitGradient,
                    canSubmit && !submitting && styles.submitGradientActive,
                    (submitting || !canSubmit) && styles.submitGradientDisabled,
                  ]}
                >
                  {submitting ? (
                    <LogoLoader color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.submitText}>
                        {canSubmit ? 'Submit attendance' : `${unmarked} student${unmarked !== 1 ? 's' : ''} still pending`}
                      </Text>
                      <Ionicons name="cloud-upload-outline" size={22} color="#fff" style={{ marginLeft: 10 }} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

// ─── Theme styles ────────────────────────────────────────────────────────────
const getStyles = (theme: SchoolTheme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },

    loadingState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 32,
    },
    loadingGlow: {
      padding: 20,
      borderRadius: 28,
      backgroundColor: isDark ? 'rgba(108,99,255,0.12)' : 'rgba(108,99,255,0.08)',
    },
    loadingText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      letterSpacing: 0.2,
    },

    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 36,
    },
    emptyIconRing: {
      width: 100,
      height: 100,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.4,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      fontWeight: '500',
    },

    // Stats hero
    statsOuter: {
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 6,
      borderRadius: 22,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 20px 50px -16px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)'
            : '0 16px 40px -12px rgba(15,23,42,0.12), 0 4px 14px -4px rgba(15,23,42,0.08)',
        },
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.35 : 0.1,
          shadowRadius: 20,
        },
        default: { elevation: 5 },
      }),
    },
    statsTopAccent: {
      height: 4,
      width: '100%',
    },
    statsCard: {
      backgroundColor: theme.colors.card,
      paddingBottom: 4,
    },
    statsCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 6,
    },
    statsCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statsCardTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.3,
    },
    completionChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    completionChipText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      marginVertical: 18,
      backgroundColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.08)',
    },

    // List meta
    listMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 10,
    },
    listMetaLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sectionAccent: {
      width: 3,
      height: 16,
      borderRadius: 2,
    },
    listMetaText: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
    unmarkedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(245,158,11,0.16)' : '#FEF3C7',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245,158,11,0.35)' : '#FDE68A',
    },
    unmarkedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: ACCENT.amber,
    },
    unmarkedBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: isDark ? '#FBBF24' : '#B45309',
    },
    allMarkedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(16,185,129,0.14)' : '#DCFCE7',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(16,185,129,0.3)' : '#A7F3D0',
    },
    allMarkedText: {
      fontSize: 12,
      fontWeight: '800',
      color: ACCENT.emerald,
    },

    listContent: {
      paddingBottom: 220,
    },

    footer: {
      position: 'absolute',
      bottom: 88,
      left: 0,
      right: 0,
      paddingHorizontal: 14,
      paddingTop: 12,
    },
    footerInner: {
      gap: 12,
      paddingTop: 14,
      paddingHorizontal: 12,
      paddingBottom: 14,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(21,27,43,0.96)' : 'rgba(255,255,255,0.96)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      ...Platform.select({
        web: {
          boxShadow: isDark ? '0 -12px 40px rgba(0,0,0,0.45)' : '0 -8px 32px rgba(15,23,42,0.1)',
        },
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.3 : 0.06,
          shadowRadius: 12,
        },
        default: { elevation: 12 },
      }),
    },
    quickActions: {
      flexDirection: 'row',
      gap: 10,
    },
    quickBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: 1.5,
    },
    quickBtnPresent: {
      backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#F0FDF4',
      borderColor: isDark ? 'rgba(16,185,129,0.35)' : '#A7F3D0',
    },
    quickBtnReset: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
    },
    quickBtnIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickBtnIconMuted: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
    },
    quickBtnText: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.1,
    },
    submitGradient: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 16,
      borderRadius: 16,
      minHeight: 54,
    },
    submitGradientActive: {
      ...Platform.select({
        web: {
          boxShadow: '0 10px 28px -6px rgba(108,99,255,0.55)',
        },
        ios: {
          shadowColor: ACCENT.violet,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 14,
        },
        default: { elevation: 8 },
      }),
    },
    submitGradientDisabled: {
      opacity: 0.95,
    },
    submitText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.15,
    },
  });
