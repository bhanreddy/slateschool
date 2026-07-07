import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppDatePicker from '@/src/components/AppDatePicker';
import { monthStartInput, todayDateInput } from './expenseConstants';

type Props = {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onClear?: () => void;
  isDark?: boolean;
};

export default function ExpenseDateFilterBar({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onClear,
  isDark = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasCustomRange = fromDate !== monthStartInput() || toDate !== todayDateInput();

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[
          styles.toggle,
          {
            backgroundColor: isDark ? '#111827' : '#fff',
            borderColor: expanded || hasCustomRange
              ? '#6366F1'
              : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
          },
        ]}
        onPress={() => setExpanded((v) => !v)}
      >
        <Ionicons name="calendar-outline" size={16} color={hasCustomRange ? '#6366F1' : (isDark ? '#94A3B8' : '#64748B')} />
        <Text style={[styles.toggleText, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>
          {fromDate} → {toDate}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={isDark ? '#64748B' : '#94A3B8'}
        />
      </Pressable>

      {expanded ? (
        <View
          style={[
            styles.panel,
            {
              backgroundColor: isDark ? '#111827' : '#fff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
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
              <Ionicons name="refresh-outline" size={14} color="#6366F1" />
              <Text style={styles.clearText}>Reset to this month</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginBottom: 4 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  toggleText: { flex: 1, fontSize: 13, fontWeight: '600' },
  panel: {
    marginTop: 8,
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
  clearText: { fontSize: 13, fontWeight: '700', color: '#6366F1' },
});
