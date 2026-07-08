import React, { useState, useEffect, useMemo } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import ClayInput from '@/src/components/ClayInput';
import { clayCard, clayInset, clay } from '@/src/theme/clayStyles';
import AppDatePicker from '@/src/components/AppDatePicker';

import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform, Dimensions } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withSpring,
  Easing
} from 'react-native-reanimated';
import StaffHeader from '../../src/components/StaffHeader';
import ViewAsBanner from '../../src/components/ViewAsBanner';
import { useAuth } from '../../src/hooks/useAuth';
import { useEffectiveStaffId } from '../../src/hooks/useEffectiveStaffId';
import { LeaveService, LeaveApplication } from '../../src/services/commonServices';
import { useTheme } from '../../src/hooks/useTheme';

const { width } = Dimensions.get('window');
const FONT = Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif';
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);



// ─── Leave Type Config ─────────────────────────────────────────────
const LEAVE_TYPES = [
  { label: 'Sick Leave', icon: 'local-hospital' as const, color: '#EF4444', bg: 'rgba(239,68,68,0.10)', key: 'sick' },
  { label: 'Casual Leave', icon: 'beach-access' as const, color: '#F97316', bg: 'rgba(249,115,22,0.10)', key: 'casual' },
  { label: 'Emergency', icon: 'warning' as const, color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)', key: 'other' }];

const STATUS_CFG: Record<string, { color: string; bg: string; icon: string; }> = {
  approved: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', icon: 'check-circle' },
  rejected: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: 'cancel' },
  pending: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: 'hourglass-empty' }
};

type StaffLeaveRow = {
  id: string;
  type: string;
  range: string;
  days: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  appliedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewRemarks?: string | null;
};

function formatStaffDateTime(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

// ─── Leave Type Chip ───────────────────────────────────────────────
const LeaveTypeChip = ({ type, isActive, onPress, isDark }: { type: typeof LEAVE_TYPES[0]; isActive: boolean; onPress: () => void; isDark: boolean; }) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handleIn = () => { scale.value = withSpring(0.94, { damping: 15, stiffness: 250 }); };
  const handleOut = () => { scale.value = withSpring(1, { damping: 15, stiffness: 250 }); };

  return (
    <AnimatedTouchable style={animStyle} onPressIn={handleIn} onPressOut={handleOut} onPress={onPress} activeOpacity={1}>
      <View style={[
        chipStyles.chip,
        clayCard(isDark, 'sm'),
        { borderRadius: 16, backgroundColor: isDark ? '#1A2332' : '#EFF2F9', borderWidth: 0 },
        isActive && {
          ...(clayInset(isDark) as any),
          borderRadius: 16,
          borderColor: type.color + '50',
          backgroundColor: type.bg,
          borderWidth: 1,
        }
      ]}>
        {isActive && <View style={[chipStyles.chipGlow, { backgroundColor: type.color + '15' }]} />}
        <View style={[chipStyles.iconWrap, { backgroundColor: isActive ? type.color + '20' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
          <MaterialIcons name={type.icon} size={14} color={isActive ? type.color : isDark ? '#64748B' : '#94A3B8'} />
        </View>
        <Text style={[chipStyles.chipText, { color: isActive ? type.color : isDark ? '#64748B' : '#94A3B8', fontFamily: FONT, fontWeight: isActive ? '700' : '500' }]}>
          {type.label}
        </Text>
        {isActive && <View style={[chipStyles.activeDot, { backgroundColor: type.color }]} />}
      </View>
    </AnimatedTouchable>
  );
};

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
    borderWidth: 1, gap: 8, overflow: 'hidden', position: 'relative'
  },
  chipGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  iconWrap: { width: 24, height: 24, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  chipText: { fontSize: 13, letterSpacing: -0.1 },
  activeDot: { width: 4, height: 4, borderRadius: 2, marginLeft: 2 }
});

// ─── History Card ──────────────────────────────────────────────────
const HistoryCard = ({ item, index, isDark }: { item: StaffLeaveRow; index: number; isDark: boolean }) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const cfg = STATUS_CFG[item.status] || STATUS_CFG.pending;
  const leaveTypeCfg = LEAVE_TYPES.find((t) => t.label === item.type) || LEAVE_TYPES[0];
  const statusLabel = item.status.charAt(0).toUpperCase() + item.status.slice(1);
  const showReview = (item.status === 'approved' || item.status === 'rejected') &&
    (item.reviewedBy || item.reviewedAt || item.reviewRemarks);

  return (
    <Animated.View entering={FadeInDown.delay(200 + index * 80).duration(320).easing(Easing.out(Easing.cubic))}>
      <AnimatedTouchable
        activeOpacity={0.85}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 18, stiffness: 220 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 220 }); }}
        style={animStyle}>

        <View style={[hcStyles.blurWrap, clayCard(isDark, 'sm'), { backgroundColor: isDark ? '#1A2332' : '#EFF2F9', padding: 0 }]}>
          <View style={[hcStyles.inner]}>
            <View style={[hcStyles.accentBar, { backgroundColor: leaveTypeCfg.color }]} />

            <View style={hcStyles.row}>
              <View style={[hcStyles.iconBox, { backgroundColor: leaveTypeCfg.bg }]}>
                <MaterialIcons name={leaveTypeCfg.icon} size={20} color={leaveTypeCfg.color} />
              </View>

              <View style={hcStyles.textBlock}>
                <Text style={[hcStyles.type, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>{item.type}</Text>
                <View style={hcStyles.metaRow}>
                  <Ionicons name="calendar-outline" size={11} color={isDark ? '#475569' : '#94A3B8'} />
                  <Text style={[hcStyles.date, { color: isDark ? '#475569' : '#94A3B8', fontFamily: FONT }]}>{item.range}</Text>
                  <View style={[hcStyles.daysPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
                    <Text style={[hcStyles.daysText, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>{item.days}</Text>
                  </View>
                </View>
              </View>

              <View style={[hcStyles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.color + '30' }]}>
                <MaterialIcons name={cfg.icon as any} size={11} color={cfg.color} />
                <Text style={[hcStyles.statusText, { color: cfg.color, fontFamily: FONT }]}>{statusLabel}</Text>
              </View>
            </View>

            <View style={[hcStyles.detailBlock, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}>
              <View style={hcStyles.detailRow}>
                <Ionicons name="time-outline" size={13} color={isDark ? '#64748B' : '#94A3B8'} />
                <Text style={[hcStyles.detailLabel, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>Applied</Text>
                <Text style={[hcStyles.detailValue, { color: isDark ? '#CBD5E1' : '#475569', fontFamily: FONT }]} numberOfLines={2}>
                  {item.appliedAt || '—'}
                </Text>
              </View>
              <View style={hcStyles.reasonBlock}>
                <Text style={[hcStyles.reasonLabel, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>Reason</Text>
                <Text style={[hcStyles.reasonBody, { color: isDark ? '#E2E8F0' : '#334155', fontFamily: FONT }]}>{item.reason}</Text>
              </View>

              {showReview && (
                <View style={[hcStyles.reviewBlock, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(79,70,229,0.06)' }]}>
                  <Text style={[hcStyles.reviewTitle, { color: isDark ? '#A5B4FC' : '#4F46E5', fontFamily: FONT }]}>Review</Text>
                  {item.reviewedAt && (
                    <Text style={[hcStyles.reviewLine, { color: isDark ? '#94A3B8' : '#64748B', fontFamily: FONT }]}>
                      {formatStaffDateTime(item.reviewedAt)}{item.reviewedBy ? ` · ${item.reviewedBy}` : ''}
                    </Text>
                  )}
                  {item.reviewRemarks && (
                    <Text style={[hcStyles.reviewRemarks, { color: isDark ? '#CBD5E1' : '#475569', fontFamily: FONT }]}>{item.reviewRemarks}</Text>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </AnimatedTouchable>
    </Animated.View>
  );
};

const hcStyles = StyleSheet.create({
  blurWrap: { borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  inner: { borderRadius: 24, overflow: 'hidden' },
  accentBar: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 4, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingLeft: 20, paddingRight: 16 },
  iconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  textBlock: { flex: 1, gap: 5 },
  type: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  date: { fontSize: 12, fontWeight: '500' },
  daysPill: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 8, marginLeft: 2 },
  daysText: { fontSize: 10, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailBlock: { marginLeft: 20, marginRight: 16, marginBottom: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  detailLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { flex: 1, fontSize: 13, fontWeight: '600', minWidth: 120 },
  reasonBlock: { gap: 6 },
  reasonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  reasonBody: { fontSize: 14, fontWeight: '500', lineHeight: 22 },
  reviewBlock: { borderRadius: 14, padding: 14, gap: 6 },
  reviewTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewLine: { fontSize: 12, fontWeight: '500' },
  reviewRemarks: { fontSize: 14, fontWeight: '500', lineHeight: 22 }
});

// ─── Submit Button ─────────────────────────────────────────────────
const SubmitButton = ({ onPress, loading, isDark }: { onPress: () => void; loading: boolean; isDark: boolean; }) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedTouchable
      activeOpacity={1} disabled={loading}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 220 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 220 }); }}
      onPress={onPress}
      style={[animStyle, { opacity: loading ? 0.7 : 1, marginTop: 12 }]}>

      <View style={[sbStyles.btn, clay(isDark, 'sm'), { backgroundColor: '#4F46E5' }]}>
        <Ionicons name={loading ? 'reload' : 'paper-plane'} size={18} color="#ffffff" style={{ marginRight: 8 }} />
        <Text style={[sbStyles.text, { fontFamily: FONT }]}>
          {loading ? 'Submitting…' : 'Submit Application'}
        </Text>
      </View>
    </AnimatedTouchable>
  );
};

const sbStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, borderRadius: 20, overflow: 'hidden', position: 'relative'
  },
  text: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 }
});

// ─── Main Screen ───────────────────────────────────────────────────
export default function ApplyLeave() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { isViewingAsAdmin, viewAsName } = useEffectiveStaffId();

  const [leaveType, setLeaveType] = useState('Sick Leave');
  const [reason, setReason] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [leaves, setLeaves] = useState<StaffLeaveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reasonFocused, setReasonFocused] = useState(false);

  useEffect(() => { loadLeaves(); }, [user]);

  const loadLeaves = async () => {
    try {
      if (user) {
        const data = await LeaveService.getAll({ limit: 100 });
        const typeLabel = (code: string) => code === 'sick' ? 'Sick Leave' : code === 'casual' ? 'Casual Leave' : code === 'other' ? 'Emergency' : code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const formatted: StaffLeaveRow[] = data.map((l: LeaveApplication) => ({
          id: l.id, type: typeLabel(l.leave_type),
          range: `${new Date(l.start_date).toLocaleDateString()} – ${new Date(l.end_date).toLocaleDateString()}`,
          days: calculateDays(l.start_date, l.end_date), status: l.status,
          reason: l.reason || '', appliedAt: formatStaffDateTime(l.created_at),
          reviewedAt: l.reviewed_at, reviewedBy: l.reviewed_by_name ?? null, reviewRemarks: l.review_remarks ?? null
        }));
        setLeaves(formatted);
      }
    } catch (err) { }
  };

  const calculateDays = (start: string, end: string) => {
    const diff = Math.abs(new Date(end).getTime() - new Date(start).getTime());
    const days = Math.max(1, Math.ceil(diff / 86400000) + 1);
    return `${days} Day${days !== 1 ? 's' : ''}`;
  };

  const handleApply = async () => {
    if (isViewingAsAdmin) {
      alertCompat('Read-only', 'Leave applications can\'t be submitted while viewing another staff member\'s portal.');
      return;
    }
    if (!fromDate || !toDate || !reason) {
      alertCompat('Missing Fields', 'Please fill in all fields before submitting.');
      return;
    }
    try {
      setLoading(true);
      if (user) {
        const typeMap: Record<string, string> = { 'Sick Leave': 'sick', 'Casual Leave': 'casual', 'Emergency': 'other' };
        await LeaveService.create({ leave_type: typeMap[leaveType] || 'other', start_date: fromDate, end_date: toDate, reason });
        alertCompat('Submitted', 'Your leave application has been submitted.');
        loadLeaves();
        setReason(''); setFromDate(''); setToDate('');
      }
    } catch (err) {
      alertCompat('Error', 'Failed to submit application.');
    } finally {
      setLoading(false);
    }
  };

  const activeLeaveCfg = LEAVE_TYPES.find((t) => t.label === leaveType)!;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#1A2332' : '#EFF2F9' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      <StaffHeader title="Apply Leave" showBackButton={true} />
      {isViewingAsAdmin && <ViewAsBanner name={viewAsName} limited />}

      <ScrollView contentContainerStyle={mainStyles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Form Card ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(340).easing(Easing.out(Easing.cubic))}>
          <View style={[mainStyles.cardBlur, clayCard(isDark, 'lg'), { padding: 24 }]}>

            {/* Title row */}
            <View style={mainStyles.cardTitleRow}>
              <View style={[mainStyles.titleIcon, { backgroundColor: activeLeaveCfg.bg }]}>
                <MaterialIcons name={activeLeaveCfg.icon} size={20} color={activeLeaveCfg.color} />
              </View>
              <View>
                <Text style={[mainStyles.cardTitle, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>
                  New Application
                </Text>
                <Text style={[mainStyles.cardSubtitle, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                  Fill in the details below
                </Text>
              </View>
            </View>

            {/* Leave Type */}
            <View style={mainStyles.fieldGroup}>
              <Text style={[mainStyles.fieldLabel, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                Leave Type
              </Text>
              <View style={mainStyles.chipsRow}>
                {LEAVE_TYPES.map((t) =>
                  <LeaveTypeChip key={t.key} type={t} isActive={leaveType === t.label} onPress={() => setLeaveType(t.label)} isDark={isDark} />
                )}
              </View>
            </View>

            {/* Date Row */}
            <View style={mainStyles.dateRow}>
              <AppDatePicker
                label="From Date" value={fromDate} onChange={setFromDate} isDark={isDark} placeholder="YYYY-MM-DD" variant="compact"
                wrapperStyle={{ ...(clayInset(isDark) as any), borderRadius: 16 }}
              />
              <View style={{ width: 14 }} />
              <AppDatePicker
                label="To Date" value={toDate} onChange={setToDate} isDark={isDark} placeholder="YYYY-MM-DD" variant="compact" minimumDate={fromDate || undefined}
                wrapperStyle={{ ...(clayInset(isDark) as any), borderRadius: 16 }}
              />
            </View>

            {/* Reason Input (Upgraded Premium Design) */}
            <View style={mainStyles.fieldGroup}>
              <ClayInput
                label="Reason"
                value={reason}
                onChangeText={setReason}
                isDark={isDark}
                placeholder="Briefly describe your reason for leave…"
                multiline
                containerStyle={{ marginBottom: 4 }}
              />

                <Text style={[mainStyles.charCount, { color: isDark ? '#475569' : '#94A3B8', fontFamily: FONT, opacity: reason.length > 0 ? 1 : 0 }]}>
                  {reason.length} chars
                </Text>
              </View>

            <SubmitButton onPress={handleApply} loading={loading} isDark={isDark} />
          </View>
        </Animated.View>

        {/* ── History ── */}
        <Animated.View entering={FadeInDown.delay(160).duration(320)} style={mainStyles.historyHeader}>
          <View style={mainStyles.historyTitleRow}>
            <Text style={[mainStyles.historyTitle, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>Leave History</Text>
            <View style={[mainStyles.historyCount, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.08)' }]}>
              <Text style={[mainStyles.historyCountText, { color: isDark ? '#818CF8' : '#4F46E5', fontFamily: FONT }]}>{leaves.length}</Text>
            </View>
          </View>
        </Animated.View>

        {leaves.length === 0 ? (
          <Animated.View entering={FadeIn.delay(200).duration(300)} style={mainStyles.emptyState}>
            <View style={[mainStyles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]}>
              <Ionicons name="calendar-outline" size={36} color={isDark ? '#475569' : '#94A3B8'} />
            </View>
            <Text style={[mainStyles.emptyText, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>No leave history yet</Text>
          </Animated.View>
        ) : (
          <View style={mainStyles.historyList}>
            {leaves.map((item, i) => <HistoryCard key={item.id} item={item} index={i} isDark={isDark} />)}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Main Styles ───────────────────────────────────────────────────
const mainStyles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 110 },
  cardBlur: { borderRadius: 32, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, marginBottom: 32 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28 },
  titleIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  cardSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  fieldGroup: { marginBottom: 22 },
  fieldLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dateRow: { flexDirection: 'row', marginBottom: 22 },
  textAreaWrap: {
    borderRadius: 20, // softer radius for input
    padding: 18,      // Increased padding for breathing room
    minHeight: 120
  },
  textArea: { fontSize: 15, fontWeight: '500', lineHeight: 22, letterSpacing: -0.1 },
  charCount: { fontSize: 11, fontWeight: '700', textAlign: 'right', marginTop: 8 },
  historyHeader: { marginBottom: 18, marginTop: 8 },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  historyCount: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  historyCountText: { fontSize: 13, fontWeight: '800' },
  historyList: { gap: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 14 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, fontWeight: '600' }
});