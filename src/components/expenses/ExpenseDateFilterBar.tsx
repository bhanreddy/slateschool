import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppDatePicker from '@/src/components/AppDatePicker';
import {
  daysAgoInput,
  formatDateShort,
  lastMonthRange,
  monthStartInput,
  todayDateInput,
} from './expenseConstants';

type Props = {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onClear?: () => void;
  isDark?: boolean;
};

type PresetId = 'this_month' | 'last_7' | 'last_month' | 'custom';

function detectPreset(from: string, to: string): PresetId {
  const today = todayDateInput();
  if (from === monthStartInput() && to === today) return 'this_month';
  if (from === daysAgoInput(6) && to === today) return 'last_7';
  const lm = lastMonthRange();
  if (from === lm.from && to === lm.to) return 'last_month';
  return 'custom';
}

const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_7', label: 'Last 7 days' },
  { id: 'last_month', label: 'Last month' },
];

export default function ExpenseDateFilterBar({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onClear,
  isDark = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const activePreset = useMemo(() => detectPreset(fromDate, toDate), [fromDate, toDate]);
  const hasCustomRange = activePreset === 'custom';

  const applyPreset = (id: PresetId) => {
    if (id === 'this_month') {
      onFromDateChange(monthStartInput());
      onToDateChange(todayDateInput());
      setExpanded(false);
      return;
    }
    if (id === 'last_7') {
      onFromDateChange(daysAgoInput(6));
      onToDateChange(todayDateInput());
      setExpanded(false);
      return;
    }
    if (id === 'last_month') {
      const lm = lastMonthRange();
      onFromDateChange(lm.from);
      onToDateChange(lm.to);
      setExpanded(false);
      return;
    }
    setExpanded(true);
  };

  const surface = isDark ? '#111827' : '#fff';
  const borderIdle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const muted = isDark ? '#94A3B8' : '#64748B';
  const strong = isDark ? '#E2E8F0' : '#0F172A';

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetRow}
      >
        {PRESETS.map((p) => {
          const active = activePreset === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => applyPreset(p.id)}
              style={({ pressed }) => [
                styles.presetChip,
                {
                  backgroundColor: active
                    ? 'rgba(79,70,229,0.12)'
                    : (isDark ? '#1E293B' : '#F8FAFC'),
                  borderColor: active ? '#4F46E5' : borderIdle,
                },
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text
                style={[
                  styles.presetText,
                  { color: active ? '#4F46E5' : muted, fontWeight: active ? '800' : '600' },
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            setExpanded((v) => !v);
          }}
          style={({ pressed }) => [
            styles.presetChip,
            {
              backgroundColor: expanded || hasCustomRange
                ? 'rgba(79,70,229,0.12)'
                : (isDark ? '#1E293B' : '#F8FAFC'),
              borderColor: expanded || hasCustomRange ? '#4F46E5' : borderIdle,
            },
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={13}
            color={expanded || hasCustomRange ? '#4F46E5' : muted}
          />
          <Text
            style={[
              styles.presetText,
              {
                color: expanded || hasCustomRange ? '#4F46E5' : muted,
                fontWeight: expanded || hasCustomRange ? '800' : '600',
              },
            ]}
          >
            Custom
          </Text>
        </Pressable>
      </ScrollView>

      <View
        style={[
          styles.toggle,
          {
            backgroundColor: surface,
            borderColor: expanded || hasCustomRange ? '#4F46E5' : borderIdle,
          },
        ]}
      >
        <Pressable
          style={styles.toggleMain}
          onPress={() => setExpanded((v) => !v)}
        >
          <View style={[styles.calIcon, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF' }]}>
            <Ionicons name="calendar-outline" size={15} color="#4F46E5" />
          </View>
          <Text style={[styles.toggleText, { color: strong }]} numberOfLines={1}>
            {formatDateShort(fromDate)} → {formatDateShort(toDate)}
          </Text>
        </Pressable>
        {hasCustomRange && onClear ? (
          <TouchableOpacity
            hitSlop={8}
            onPress={onClear}
            style={styles.resetInline}
          >
            <Ionicons name="refresh-outline" size={14} color="#4F46E5" />
          </TouchableOpacity>
        ) : null}
        <Pressable hitSlop={8} onPress={() => setExpanded((v) => !v)} style={styles.chevronHit}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={isDark ? '#64748B' : '#94A3B8'}
          />
        </Pressable>
      </View>

      {expanded ? (
        <View
          style={[
            styles.panel,
            {
              backgroundColor: surface,
              borderColor: borderIdle,
            },
          ]}
        >
          <View style={styles.dateRow}>
            <AppDatePicker
              label="From date"
              value={fromDate}
              onChange={onFromDateChange}
              maximumDate={toDate}
              variant="compact"
              isDark={isDark}
              containerStyle={styles.dateField}
            />
            <AppDatePicker
              label="To date"
              value={toDate}
              onChange={onToDateChange}
              minimumDate={fromDate}
              variant="compact"
              isDark={isDark}
              containerStyle={styles.dateField}
            />
          </View>
          {hasCustomRange && onClear ? (
            <Pressable style={styles.clearBtn} onPress={onClear}>
              <Ionicons name="refresh-outline" size={14} color="#4F46E5" />
              <Text style={styles.clearText}>Reset to this month</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginBottom: 8, gap: 8 },
  presetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetText: { fontSize: 12, letterSpacing: 0.1 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  toggleMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  calIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: { flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  resetInline: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronHit: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1, marginBottom: 0 },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
  },
  clearText: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
});
