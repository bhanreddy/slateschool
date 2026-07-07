import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Platform, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  TimetableService,
  TimetableSlot,
  DayOfWeek,
  TIMETABLE_DAYS,
  TIMETABLE_DAY_LABELS,
} from '../../src/services/timetableService';
import { useAuth } from '../../src/hooks/useAuth';
import { useStudentQuery } from '../../src/hooks/useStudentQuery';
import type { Student } from '../../src/types/models';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { useTheme, type SchoolTheme } from '../../src/hooks/useTheme';
import LogoLoader from '../../src/components/LogoLoader';
import { t_field } from '../../src/utils/lang';
import { useFeatureGuard } from '../../src/hooks/useFeatures';

const { width } = Dimensions.get('window');

// Subject icon mapping
const SUBJECT_ICONS: Record<string, string> = {
  mathematics: 'calculator-outline',
  maths: 'calculator-outline',
  math: 'calculator-outline',
  physics: 'flask-outline',
  chemistry: 'beaker-outline',
  biology: 'leaf-outline',
  english: 'book-outline',
  hindi: 'document-text-outline',
  history: 'time-outline',
  geography: 'globe-outline',
  science: 'flask-outline',
  computer: 'desktop-outline',
  art: 'color-palette-outline',
  music: 'musical-notes-outline',
  sports: 'football-outline',
  library: 'library-outline',
  default: 'school-outline'
};

const getSubjectIcon = (name: string): string => {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(SUBJECT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return SUBJECT_ICONS.default;
};

// Subject color palette
const SUBJECT_COLORS: string[] = [
'#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316',
'#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6'];

const getSubjectColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
};

interface ProcessedItem {
  type: 'class' | 'break';
  id: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  startRaw: string; // HH:MM:SS
  endRaw: string;
  subject?: string;
  teacher?: string;
  room?: string;
  periodNumber: number;
}

const TimeTableScreen = () => {
  useFeatureGuard('nav.time_table'); // deep-link guard
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const roleCode = typeof user?.role === 'object' && user?.role !== null ? (user.role as { code: string }).code : user?.role;
  const isStudent = roleCode === 'student';

  const { data: profile, refetch: refetchProfile } = useStudentQuery<Student>(
    '/students/profile/me',
    'profile',
    3 * 60 * 1000,
    user?.userId,
    { enabled: !!user?.userId && isStudent }
  );

  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => {
    const idx = new Date().getDay(); // 0=Sun..6=Sat
    return idx >= 1 && idx <= 6 ? TIMETABLE_DAYS[idx - 1] : 'monday';
  });

  // Per-day school if the fetched slots span more than one weekday.
  const isPerDay = useMemo(() => {
    const days = new Set(slots.map((s) => s.day_of_week).filter(Boolean));
    return days.size > 1;
  }, [slots]);

  // Slots to render: a single weekday in per-day schools, the whole template otherwise.
  const visibleSlots = useMemo(() => {
    if (!isPerDay) return slots;
    return slots.filter((s) => (s.day_of_week || 'monday') === selectedDay);
  }, [slots, isPerDay, selectedDay]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const loadTimetable = async () => {
    if (!user || !isStudent) return;
    try {
      if (profile?.current_enrollment?.class_section_id) {
        const data = await TimetableService.getClassSlots(profile.current_enrollment.class_section_id);
        setSlots(data);
      } else {
        setSlots([]);
      }
    } catch {

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadTimetable();
  }, [user?.userId, isStudent, profile?.current_enrollment?.class_section_id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchProfile();
    await loadTimetable();
  };

  // Process slots: sort + insert gap breaks
  const processedItems: ProcessedItem[] = useMemo(() => {
    if (!visibleSlots.length) return [];
    const sorted = [...visibleSlots].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const items: ProcessedItem[] = [];

    sorted.forEach((slot, i) => {
      // Check for gap before this slot (break)
      if (i > 0) {
        const prevEnd = sorted[i - 1].end_time;
        if (slot.start_time > prevEnd) {
          items.push({
            type: 'break',
            id: `break-${i}`,
            startTime: prevEnd.slice(0, 5),
            endTime: slot.start_time.slice(0, 5),
            startRaw: prevEnd,
            endRaw: slot.start_time,
            periodNumber: 0
          });
        }
      }

      items.push({
        type: 'class',
        id: slot.id || `slot-${i}`,
        startTime: slot.start_time.slice(0, 5),
        endTime: slot.end_time.slice(0, 5),
        startRaw: slot.start_time,
        endRaw: slot.end_time,
        subject: t_field(slot.subject_name, slot.subject_name_te) || 'N/A',
        teacher: slot.teacher_name || 'N/A',
        room: slot.room_no || 'N/A',
        periodNumber: slot.period_number
      });
    });

    return items;
  }, [visibleSlots, i18n.language]);

  // Check if a time range is currently active
  const isActive = (startRaw: string, endRaw: string): boolean => {
    const hours = currentTime.getHours();
    const mins = currentTime.getMinutes();
    const now = hours * 60 + mins;
    const [sh, sm] = startRaw.split(':').map(Number);
    const [eh, em] = endRaw.split(':').map(Number);
    return now >= sh * 60 + sm && now < eh * 60 + em;
  };

  // Check if a time is in the past
  const isPast = (endRaw: string): boolean => {
    const hours = currentTime.getHours();
    const mins = currentTime.getMinutes();
    const now = hours * 60 + mins;
    const [eh, em] = endRaw.split(':').map(Number);
    return now >= eh * 60 + em;
  };

  // Count stats
  const totalPeriods = processedItems.filter((i) => i.type === 'class').length;
  const completedPeriods = processedItems.filter((i) => i.type === 'class' && isPast(i.endRaw)).length;
  const currentPeriod = processedItems.find((i) => i.type === 'class' && isActive(i.startRaw, i.endRaw));

  const durationMinutes = (startRaw: string, endRaw: string): number => {
    const [sh, sm] = startRaw.split(':').map(Number);
    const [eh, em] = endRaw.split(':').map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  };

  return (
    <ScreenLayout>
      <StudentHeader title={t('timetable.title')} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" />}>

                {refreshing &&
        <View style={{ width: '100%', alignItems: 'center', paddingVertical: 20 }}>
                        <LogoLoader size={30} />
                    </View>
        }
        {/* Header Stats */}
        <Animated.View entering={FadeInUp.duration(600)} style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF' }]}>
            <Ionicons name="book-outline" size={18} color="#6366F1" />
            <Text style={[styles.statValue, { color: '#6366F1' }]}>{totalPeriods}</Text>
            <Text style={styles.statLabel}>Periods</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? '#052E16' : '#ECFDF5' }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
            <Text style={[styles.statValue, { color: '#16A34A' }]}>{completedPeriods}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? '#172554' : '#EFF6FF' }]}>
            <Ionicons name="timer-outline" size={18} color="#3B82F6" />
            <Text style={[styles.statValue, { color: '#3B82F6' }]}>{currentPeriod?.subject?.slice(0, 8) || '—'}</Text>
            <Text style={styles.statLabel}>Current</Text>
          </View>
        </Animated.View>

        {/* Day selector — only shown for per-day schools */}
        {isPerDay && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dayTabs}
            contentContainerStyle={{ paddingHorizontal: 4 }}
          >
            {TIMETABLE_DAYS.map((d) => {
              const activeDay = selectedDay === d;
              return (
                <Text
                  key={d}
                  onPress={() => setSelectedDay(d)}
                  style={[
                    styles.dayTab,
                    {
                      backgroundColor: activeDay ? '#6366F1' : (isDark ? '#1F2937' : '#EEF2FF'),
                      color: activeDay ? '#FFFFFF' : '#6366F1',
                    },
                  ]}
                >
                  {TIMETABLE_DAY_LABELS[d]}
                </Text>
              );
            })}
          </ScrollView>
        )}

        {/* Timeline */}
        {loading ?
        <LogoLoader size={60} color="#6366F1" style={{ marginTop: 60 }} /> :
        processedItems.length === 0 ?
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={56} color={isDark ? '#374151' : '#D1D5DB'} />
            <Text style={styles.emptyTitle}>No Classes Scheduled</Text>
            <Text style={styles.emptySubtitle}>Your timetable will appear here once it's configured</Text>
          </Animated.View> :

        <View style={styles.timeline}>
            {processedItems.map((item, index) => {
            const active = isActive(item.startRaw, item.endRaw);
            const past = isPast(item.endRaw);

            if (item.type === 'break') {
              const mins = durationMinutes(item.startRaw, item.endRaw);
              return (
                <Animated.View key={item.id} entering={FadeInDown.delay(index * 60).duration(500)} style={styles.breakRow}>
                    {/* Timeline connector */}
                    <View style={styles.timelineConnector}>
                      <View style={[styles.connectorLine, past && styles.connectorLinePast]} />
                      <View style={[styles.breakDot, { backgroundColor: '#F59E0B' }]}>
                        <Ionicons name={mins > 30 ? 'restaurant' : 'cafe'} size={10} color="#FFF" />
                      </View>
                      <View style={[styles.connectorLine, past && styles.connectorLinePast]} />
                    </View>
                    <View style={styles.breakCard}>
                      <Text style={styles.breakText}>
                        {mins > 30 ? 'Lunch Break' : 'Break'} · {mins} min
                      </Text>
                      <Text style={styles.breakTime}>{item.startTime} - {item.endTime}</Text>
                    </View>
                  </Animated.View>);

            }

            const color = getSubjectColor(item.subject || '');
            const icon = getSubjectIcon(item.subject || '');

            return (
              <Animated.View key={item.id} entering={FadeInDown.delay(index * 60).duration(500)} style={styles.periodRow}>
                  {/* Timeline connector */}
                  <View style={styles.timelineConnector}>
                    {index > 0 && <View style={[styles.connectorLine, past && styles.connectorLinePast]} />}
                    {index === 0 && <View style={{ flex: 1 }} />}
                    <View style={[
                  styles.timelineDot,
                  active && styles.timelineDotActive,
                  past && styles.timelineDotPast,
                  { borderColor: active ? color : past ? '#D1D5DB' : '#C7D2FE' }]
                  }>
                      {active && <View style={[styles.timelineDotInner, { backgroundColor: color }]} />}
                      {past && <Ionicons name="checkmark" size={10} color="#9CA3AF" />}
                    </View>
                    {index < processedItems.length - 1 && <View style={[styles.connectorLine, past && styles.connectorLinePast]} />}
                    {index === processedItems.length - 1 && <View style={{ flex: 1 }} />}
                  </View>

                  {/* Period Card */}
                  <View style={[
                styles.periodCard,
                active && styles.periodCardActive,
                past && styles.periodCardPast,
                active && { borderColor: color + '40' }]
                }>
                    {/* Active glow bar */}
                    {active && <View style={[styles.activeBar, { backgroundColor: color }]} />}

                    <View style={styles.periodCardInner}>
                      {/* Top row: Time + Icon */}
                      <View style={styles.periodTopRow}>
                        <View style={styles.timeChip}>
                          <Ionicons name="time-outline" size={12} color={active ? color : '#6B7280'} />
                          <Text style={[styles.timeChipText, active && { color }]}>{item.startTime} - {item.endTime}</Text>
                        </View>
                        <View style={[styles.subjectIcon, { backgroundColor: color + '15' }]}>
                          <Ionicons name={icon as any} size={18} color={color} />
                        </View>
                      </View>

                      {/* Subject name */}
                      <Text style={[
                    styles.subjectName,
                    past && styles.subjectNamePast]
                    }>{item.subject}</Text>

                      {/* Details row */}
                      <View style={styles.detailsRow}>
                        <View style={styles.detailChip}>
                          <Ionicons name="person-outline" size={13} color={isDark ? '#94A3B8' : '#64748B'} />
                          <Text style={styles.detailText}>{item.teacher}</Text>
                        </View>
                        {item.room && item.room !== 'N/A' &&
                      <View style={styles.detailChip}>
                            <Ionicons name="location-outline" size={13} color={isDark ? '#94A3B8' : '#64748B'} />
                            <Text style={styles.detailText}>{item.room}</Text>
                          </View>
                      }
                      </View>

                      {/* Active status badge */}
                      {active &&
                    <View style={[styles.activeBadge, { backgroundColor: color + '15' }]}>
                          <View style={[styles.activePulse, { backgroundColor: color }]} />
                          <Text style={[styles.activeBadgeText, { color }]}>Ongoing</Text>
                        </View>
                    }
                    </View>
                  </View>
                </Animated.View>);

          })}
          </View>
        }

        <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenLayout>);

};

export default TimeTableScreen;

const getStyles = (theme: SchoolTheme, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'},
  scrollContent: {
    paddingTop: 16
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 20
  },
  dayTabs: {
    paddingHorizontal: 12,
    marginBottom: 16,
    flexGrow: 0,
  },
  dayTab: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    marginHorizontal: 4,
    overflow: 'hidden',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 4
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },

  /* Timeline Structure */
  timeline: {
    paddingHorizontal: 16
  },
  periodRow: {
    flexDirection: 'row',
    minHeight: 100
  },
  breakRow: {
    flexDirection: 'row',
    minHeight: 52
  },
  timelineConnector: {
    width: 32,
    alignItems: 'center'
  },
  connectorLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#C7D2FE'
  },
  connectorLinePast: {
    backgroundColor: '#E5E7EB'
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center'
  },
  timelineDotActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5
  },
  timelineDotPast: {
    backgroundColor: theme.colors.background,
    borderColor: '#D1D5DB'
  },
  timelineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  breakDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center'
  },

  /* Period Card */
  periodCard: {
    flex: 1,
    marginLeft: 12,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
    borderWidth: 1,
    borderColor: isDark ? theme.colors.border : '#F1F5F9',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 }
    })
  },
  periodCardActive: {
    borderWidth: 1.5,
    ...Platform.select({
      ios: { shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 4 }
    })
  },
  periodCardPast: {
    opacity: 0.6
  },
  activeBar: {
    height: 3,
    width: '100%'
  },
  periodCardInner: {
    padding: 14,
    gap: 8
  },
  periodTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280'
  },
  subjectIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  subjectName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    letterSpacing: -0.2
  },
  subjectNamePast: {
    color: theme.colors.textSecondary
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap'
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  detailText: {
    fontSize: 12,
    fontWeight: '500',
    color: isDark ? '#94A3B8' : '#64748B'
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
    marginTop: 2
  },
  activePulse: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  },

  /* Break */
  breakCard: {
    flex: 1,
    marginLeft: 12,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#2D2306' : '#FFFBEB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? '#854D0E33' : '#FDE68A'
  },
  breakText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309'
  },
  breakTime: {
    fontSize: 11,
    fontWeight: '500',
    color: '#D97706'
  },

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textSecondary
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40
  }
});