/**
 * Shared "History" chrome: tabs, date selector, and calendar bottom sheet
 * (matches student Diary screen behavior; reusable by staff diary).
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Pressable,
  Platform,
} from 'react-native';
import AppDatePicker from '@/src/components/AppDatePicker';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../theme/themes';

function clay(isDark: boolean, raised: 'sm' | 'md' | 'lg' = 'md'): any {
  const spread = raised === 'lg' ? 24 : raised === 'sm' ? 12 : 18;
  const dy = raised === 'lg' ? 12 : raised === 'sm' ? 6 : 9;
  if (Platform.OS === 'web') {
    const drop = isDark ? 'rgba(0,0,0,0.60)' : 'rgba(166,180,200,0.55)';
    const light = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,1)';
    const innerHi = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)';
    const innerLo = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(166,180,200,0.35)';
    return {
      boxShadow:
        `${dy}px ${dy}px ${spread}px ${drop}, ` +
        `-${dy}px -${dy}px ${spread}px ${light}, ` +
        `inset 3px 3px 6px ${innerHi}, ` +
        `inset -3px -3px 6px ${innerLo}`,
    };
  }
  return {
    shadowColor: isDark ? '#000000' : '#94A3B8',
    shadowOffset: { width: 0, height: dy },
    shadowOpacity: isDark ? 0.45 : 0.26,
    shadowRadius: spread,
    elevation: raised === 'lg' ? 10 : raised === 'sm' ? 4 : 7,
  };
}

function clayInset(isDark: boolean): any {
  if (Platform.OS === 'web') {
    const innerLo = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(166,180,200,0.45)';
    const innerHi = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.95)';
    return {
      boxShadow: `inset 4px 4px 8px ${innerLo}, inset -4px -4px 8px ${innerHi}`,
      borderWidth: 0,
    };
  }
  return {
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)',
  };
}

function clayCard(isDark: boolean, raised: 'sm' | 'md' | 'lg' = 'md'): any {
  return {
    backgroundColor: isDark ? '#1A2332' : '#EFF2F9',
    borderRadius: raised === 'lg' ? 30 : 24,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
    ...clay(isDark, raised),
  };
}

export const DIARY_HISTORY_PRIOR_DAYS = 14;

export type DiaryHistoryTabId = 'today' | 'history';

const WEEK_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const CAL_CELL = 44;
const CAL_INNER = 38;
const CAL_TOTAL_W = CAL_CELL * 7;

export function toYmd(date: Date) {
  return date.toISOString().split('T')[0];
}

export function priorHistoryYmds(anchor: Date): string[] {
  return Array.from({ length: DIARY_HISTORY_PRIOR_DAYS }, (_, i) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - (i + 1));
    return toYmd(d);
  });
}

function buildCalendarMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function MiniCalendar({
  selectedYmd,
  onSelect,
  availableYmds,
}: {
  selectedYmd: string;
  onSelect: (ymd: string) => void;
  availableYmds: string[];
}) {
  const { theme, isDark } = useTheme();
  const todayYmd = toYmd(new Date());

  const [viewYear, setViewYear] = useState(() => parseInt(selectedYmd.split('-')[0], 10));
  const [viewMonth, setViewMonth] = useState(() => parseInt(selectedYmd.split('-')[1], 10) - 1);

  const cells = buildCalendarMonth(viewYear, viewMonth);
  const availableSet = new Set(availableYmds);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  }

  return (
    <View style={{ paddingBottom: 8, alignItems: 'center' }}>
      <View
        style={{
          width: CAL_TOTAL_W,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          paddingHorizontal: 2,
        }}
      >
        <Pressable
          onPress={prevMonth}
          hitSlop={10}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
          }}
        >
          <Ionicons name="chevron-back" size={18} color={theme.colors.textSecondary} />
        </Pressable>

        <Text
          style={{
            fontSize: 16,
            fontWeight: '800',
            color: theme.colors.textStrong,
            letterSpacing: -0.4,
          }}
        >
          {monthLabel}
        </Text>

        <Pressable
          onPress={nextMonth}
          hitSlop={10}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
          }}
        >
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      <View style={{ width: CAL_TOTAL_W, flexDirection: 'row', marginBottom: 4 }}>
        {WEEK_DAYS.map((d) => (
          <View key={d} style={{ width: CAL_CELL, alignItems: 'center', paddingVertical: 4 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '800',
                color: theme.colors.textTertiary,
                letterSpacing: 0.8,
              }}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ width: CAL_TOTAL_W, flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, idx) => {
          if (!day) {
            return <View key={`e${idx}`} style={{ width: CAL_CELL, height: CAL_CELL }} />;
          }

          const ymd = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = ymd === selectedYmd;
          const isToday = ymd === todayYmd;
          const hasData = availableSet.has(ymd);
          const isFuture = ymd > todayYmd;

          return (
            <Pressable
              key={ymd}
              onPress={() => !isFuture && onSelect(ymd)}
              disabled={isFuture}
              style={{
                width: CAL_CELL,
                height: CAL_CELL,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isFuture ? 0.3 : 1,
              }}
            >
              <View
                style={{
                  width: CAL_INNER,
                  height: CAL_INNER,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  borderWidth: isToday && !isSelected ? 2 : 0,
                  borderColor: theme.colors.primary,
                }}
              >
                {isSelected && (
                  <LinearGradient
                    colors={['#4338CA', '#6366F1']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    zIndex: 1,
                    color: isSelected
                      ? '#FFFFFF'
                      : isToday
                        ? theme.colors.primary
                        : theme.colors.textStrong,
                  }}
                >
                  {day}
                </Text>
                {hasData && !isSelected ? (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: theme.colors.primary,
                    }}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function DiaryHistoryDatePickerSheet({
  visible,
  selectedYmd,
  availableYmds,
  onSelect,
  onClose,
  subtitle = 'Dots mark days with homework',
}: {
  visible: boolean;
  selectedYmd: string;
  availableYmds: string[];
  onSelect: (ymd: string) => void;
  onClose: () => void;
  subtitle?: string;
}) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => chromeStyles(theme), [theme]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          style={styles.sheetOverlay}
        />
      </TouchableWithoutFeedback>

      <Animated.View
        entering={SlideInDown.springify().damping(22).stiffness(260)}
        exiting={SlideOutDown.duration(220)}
        style={styles.sheetContainer}
      >
        <LinearGradient
          colors={isDark ? ['#161B2E', '#0F172A'] : ['#FFFFFF', '#F5F7FF']}
          style={[
            styles.sheetCard,
            {
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)',
            },
          ]}
        >
          <View
            style={[
              styles.sheetHandle,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.15)',
              },
            ]}
          />

          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Pick a Date</Text>
              <Text style={styles.sheetSubtitle}>{subtitle}</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[
                styles.sheetCloseBtn,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.05)',
                },
              ]}
            >
              <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          <MiniCalendar
            selectedYmd={selectedYmd}
            onSelect={(ymd) => {
              onSelect(ymd);
              onClose();
            }}
            availableYmds={availableYmds}
          />
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
}

export function DiaryHistoryTabSwitcher({
  active,
  onChange,
  todayLabel = "Today's HW",
  historyLabel = 'History',
}: {
  active: DiaryHistoryTabId;
  onChange: (t: DiaryHistoryTabId) => void;
  todayLabel?: string;
  historyLabel?: string;
}) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => chromeStyles(theme), [theme]);

  const tabs: { id: DiaryHistoryTabId; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { id: 'today', icon: 'today-outline', label: todayLabel },
    { id: 'history', icon: 'time-outline', label: historyLabel },
  ];

  return (
    <View
      style={[
        styles.tabBar,
        clayInset(isDark),
        {
          backgroundColor: isDark ? '#0F1524' : '#E8EDF5',
          borderRadius: 20,
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={styles.tabItem}
            onPress={() => onChange(tab.id)}
            android_ripple={{ color: '#6366F1' + '18', borderless: true }}
          >
            {isActive && (
              <Animated.View
                entering={FadeIn.duration(180)}
                style={[
                  StyleSheet.absoluteFill,
                  { borderRadius: 16, backgroundColor: theme.colors.primary },
                  clay(isDark, 'sm'),
                ]}
              />
            )}
            <Ionicons
              name={tab.icon}
              size={16}
              color={isActive ? '#FFFFFF' : theme.colors.textSecondary}
              style={{ zIndex: 1 }}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? '#FFFFFF' : theme.colors.textSecondary, zIndex: 1 },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DiaryHistoryDateSelectorButton({
  selectedYmd,
  onPress,
  onSelect,
}: {
  selectedYmd: string;
  onPress: () => void;
  onSelect?: (ymd: string) => void;
}) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => chromeStyles(theme), [theme]);

  if (Platform.OS === 'web' && onSelect) {
    return (
      <Animated.View
        entering={FadeInDown.duration(300).springify()}
        layout={Layout.springify()}
        style={styles.dateSelectorWrap}
      >
        <AppDatePicker
          label="Pick a date"
          value={selectedYmd}
          onChange={onSelect}
          maximumDate={new Date()}
          isDark={isDark}
          containerStyle={{ marginBottom: 0 }}
        />
      </Animated.View>
    );
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [y, m, d] = selectedYmd.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  let relLabel = '';
  const diff = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (date.toDateString() === yesterday.toDateString()) relLabel = 'Yesterday';
  else if (diff <= 7) relLabel = `${diff} days ago`;
  else relLabel = `${Math.round(diff / 7)} week${Math.round(diff / 7) !== 1 ? 's' : ''} ago`;

  const fullLabel = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      layout={Layout.springify()}
      style={styles.dateSelectorWrap}
    >
      <Pressable onPress={onPress} android_ripple={{ color: '#6366F1' + '18' }}>
        <View
          style={[
            styles.dateSelector,
            clayCard(isDark, 'sm'),
            {
              borderRadius: 20,
            },
          ]}
        >
          <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.dsIconBox}>
            <Ionicons name="calendar" size={16} color="#FFFFFF" />
          </LinearGradient>

          <View style={styles.dsText}>
            <Text style={styles.dsLabel} numberOfLines={1}>
              {fullLabel}
            </Text>
            <Text style={[styles.dsRel, { color: theme.colors.primary }]}>{relLabel}</Text>
          </View>

          <View
            style={[
              styles.dsChevron,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.05)',
              },
            ]}
          >
            <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function chromeStyles(theme: Theme) {
  return StyleSheet.create({
    tabBar: {
      flexDirection: 'row',
      borderRadius: 16,
      borderWidth: 1,
      padding: 4,
      gap: 4,
    },
    tabItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 12,
      borderRadius: 16,
      overflow: 'hidden',
    },
    tabLabel: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },

    dateSelectorWrap: { marginBottom: 14 },
    dateSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1,
    },
    dsIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dsText: { flex: 1, gap: 2 },
    dsLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textStrong,
      letterSpacing: -0.3,
    },
    dsRel: { fontSize: 12, fontWeight: '600' },
    dsChevron: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },

    sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    sheetCard: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingBottom: 40,
      borderWidth: 1,
      borderBottomWidth: 0,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 4,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    sheetTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.textStrong,
      letterSpacing: -0.5,
    },
    sheetSubtitle: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      marginTop: 3,
      fontWeight: '500',
    },
    sheetCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
