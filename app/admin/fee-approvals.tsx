import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AdminHeader from '../../src/components/AdminHeader';
import LogoLoader from '../../src/components/LogoLoader';
import { useTheme } from '../../src/hooks/useTheme';
import { usePermissions } from '../../src/hooks/usePermissions';
import { useAuth } from '../../src/hooks/useAuth';
import { AdminService } from '../../src/services/adminService';
import { ApprovalService, ApprovalRequest } from '../../src/services/approvalService';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { APIError } from '../../src/services/apiClient';

function formatInr(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function FeeApprovalsScreen() {
  const { isDark, theme } = useTheme();
  const { role } = useAuth();
  const { hasPermission } = usePermissions();
  const canManageSchoolSetting = role === 'admin' || role === 'principal';
  const canReviewApprovals = hasPermission('fee.underpayment.approve');

  const [rows, setRows] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [partialEnabled, setPartialEnabled] = useState(true);
  const [loadingSetting, setLoadingSetting] = useState(true);
  const [savingSetting, setSavingSetting] = useState(false);

  const pageBg = isDark ? '#0C0D14' : '#F3F4F8';
  const cardBg = isDark ? 'rgba(255,255,255,0.045)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const textPrimary = isDark ? '#FFFFFF' : '#111827';
  const textSecondary = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';

  const loadSetting = useCallback(async () => {
    if (!canManageSchoolSetting) {
      setLoadingSetting(false);
      return;
    }
    try {
      setLoadingSetting(true);
      const res = await AdminService.getPartialFeePaymentSetting();
      setPartialEnabled(!!res.enabled);
    } catch {
      alertCompat('Error', 'Failed to load partial fee payment setting');
    } finally {
      setLoadingSetting(false);
    }
  }, [canManageSchoolSetting]);

  const loadApprovals = useCallback(async () => {
    if (!canReviewApprovals) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await ApprovalService.listPending({ status: 'PENDING', type: 'fee_underpayment' });
      setRows(data);
    } catch {
      alertCompat('Error', 'Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, [canReviewApprovals]);

  useEffect(() => {
    void loadSetting();
    void loadApprovals();
  }, [loadSetting, loadApprovals]);

  const handlePartialToggle = async (nextValue: boolean) => {
    const previous = partialEnabled;
    setPartialEnabled(nextValue);
    setSavingSetting(true);
    try {
      const res = await AdminService.setPartialFeePaymentEnabled(nextValue);
      setPartialEnabled(!!res.enabled);
    } catch (err) {
      setPartialEnabled(previous);
      const message = err instanceof APIError ? err.message : 'Failed to update setting';
      alertCompat('Error', message);
    } finally {
      setSavingSetting(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActingId(id);
    try {
      await ApprovalService.approve(id);
      alertCompat('Approved', 'Partial payment has been enabled once for this student. Accounts must complete the collection flow to post it.');
      await loadApprovals();
    } catch (err: any) {
      alertCompat('Error', err?.message || 'Could not approve request');
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string) => {
    alertCompat('Reject Payment', 'Reject this partial payment request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setActingId(id);
          try {
            await ApprovalService.reject(id);
            alertCompat('Rejected', 'No payment was posted.');
            await loadApprovals();
          } catch (err: any) {
            alertCompat('Error', err?.message || 'Could not reject request');
          } finally {
            setActingId(null);
          }
        },
      },
    ]);
  };

  if (!canManageSchoolSetting && !canReviewApprovals) {
    return (
      <View style={[styles.container, { backgroundColor: pageBg }]}>
        <AdminHeader title="Partial Fee Collection" showBackButton />
        <View style={styles.center}>
          <Text style={{ color: textSecondary }}>You do not have permission to manage fee collection settings.</Text>
        </View>
      </View>
    );
  }

  const listHeader = (
    <>
      {canManageSchoolSetting ? (
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={[styles.settingCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.settingTop}>
              <View style={[styles.settingIcon, { backgroundColor: partialEnabled ? '#ECFDF5' : '#FEF2F2' }]}>
                <Ionicons
                  name={partialEnabled ? 'pie-chart-outline' : 'lock-closed-outline'}
                  size={22}
                  color={partialEnabled ? '#059669' : '#DC2626'}
                />
              </View>
              <View style={styles.settingBody}>
                <Text style={[styles.settingTitle, { color: textPrimary }]}>Allow partial fee collection</Text>
                <Text style={[styles.settingDesc, { color: textSecondary }]}>
                  When enabled, accounts can collect less than the full balance — each partial payment is held for admin approval before posting. When disabled, direct collection requires the full balance, but accounts can request admin approval for a partial payment.
                </Text>
              </View>
              {loadingSetting ? (
                <ActivityIndicator size="small" color="#7C6FFF" />
              ) : (
                <Switch
                  value={partialEnabled}
                  onValueChange={handlePartialToggle}
                  disabled={savingSetting}
                  trackColor={{ false: isDark ? '#374151' : '#D1D5DB', true: '#86EFAC' }}
                  thumbColor={partialEnabled ? '#059669' : '#F9FAFB'}
                />
              )}
            </View>
            <View style={[styles.settingStatusPill, {
              backgroundColor: partialEnabled
                ? (isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5')
                : (isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2'),
            }]}>
              <Text style={{
                color: partialEnabled ? '#059669' : '#DC2626',
                fontSize: 12,
                fontWeight: '700',
              }}>
                {partialEnabled ? 'Partial payments allowed school-wide' : 'Full payment required school-wide'}
              </Text>
            </View>
          </View>
        </Animated.View>
      ) : null}

      {canReviewApprovals ? (
        <Text style={[styles.sectionLabel, { color: textSecondary }]}>PENDING APPROVALS</Text>
      ) : null}
    </>
  );

  if (!canReviewApprovals) {
    return (
      <View style={[styles.container, { backgroundColor: pageBg }]}>
        <AdminHeader title="Partial Fee Collection" showBackButton />
        <View style={styles.staticContent}>{listHeader}</View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <AdminHeader title="Partial Fee Collection" showBackButton />

      {loading && rows.length === 0 ? (
        <View style={styles.center}>
          <LogoLoader size={56} color="#7C6FFF" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => {
                void loadSetting();
                void loadApprovals();
              }}
            />
          }
          contentContainerStyle={styles.list}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={[styles.emptyBlock, { backgroundColor: theme.colors.card, borderColor: cardBorder }]}>
              <Ionicons name="checkmark-circle-outline" size={40} color="#10B981" />
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>No pending approvals</Text>
              <Text style={[styles.emptySub, { color: textSecondary }]}>
                {partialEnabled
                  ? 'Partial fee payments awaiting review will appear here.'
                  : 'Accounts partial payment requests awaiting review will appear here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const payload = item.payload || {};
            const busy = actingId === item.id;
            const studentName = typeof payload.student_name === 'string' ? payload.student_name : '';
            const admissionNo = typeof payload.admission_no === 'string' ? payload.admission_no : '';
            const className = typeof payload.class_name === 'string' ? payload.class_name : '';
            const sectionName = typeof payload.section_name === 'string' ? payload.section_name : '';
            const feeType = typeof payload.fee_type === 'string' ? payload.fee_type : '';
            const paymentMethod = typeof payload.payment_method === 'string' ? payload.payment_method : '';
            return (
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: textPrimary }]}>Partial Fee Payment</Text>
                  <Text style={[styles.cardMeta, { color: textSecondary }]}>
                    {new Date(item.created_at).toLocaleString('en-IN')}
                  </Text>
                </View>
                <Text style={[styles.line, { color: textSecondary }]}>
                  Requested by {item.requested_by_name || 'Accounts'}
                </Text>
                {studentName || admissionNo ? (
                  <Text style={[styles.line, { color: textSecondary }]}>
                    Student: {studentName || 'Student'}{admissionNo ? ` (#${admissionNo})` : ''}
                  </Text>
                ) : null}
                {className || sectionName || feeType ? (
                  <Text style={[styles.line, { color: textSecondary }]}>
                    {[className, sectionName, feeType].filter(Boolean).join(' - ')}
                  </Text>
                ) : null}
                <Text style={[styles.amount, { color: textPrimary }]}>
                  {formatInr(payload.amount)} of {formatInr(payload.amount_due)} due
                </Text>
                {paymentMethod ? (
                  <Text style={[styles.line, { color: textSecondary }]}>Mode: {paymentMethod.toUpperCase()}</Text>
                ) : null}
                {item.reason ? (
                  <Text style={[styles.line, { color: textSecondary }]}>Reason: {item.reason}</Text>
                ) : null}
                <View style={styles.actions}>
                  <TouchableOpacity
                    disabled={busy}
                    onPress={() => handleReject(item.id)}
                    style={[styles.btn, styles.rejectBtn]}
                  >
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={busy} onPress={() => handleApprove(item.id)} style={styles.btnWrap}>
                    <LinearGradient colors={['#10B981', '#059669']} style={styles.approveBtn}>
                      {busy ? (
                        <LogoLoader size={18} color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                          <Text style={styles.approveText}>Approve Once</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  staticContent: { padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  list: { padding: 20, paddingBottom: 40 },
  settingCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20 },
  settingTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  settingIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  settingBody: { flex: 1, paddingTop: 2 },
  settingTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  settingDesc: { fontSize: 13, lineHeight: 19 },
  settingStatusPill: {
    marginTop: 14, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2,
    marginBottom: 12,
  },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardMeta: { fontSize: 11, fontWeight: '600' },
  line: { fontSize: 13, marginBottom: 4 },
  amount: { fontSize: 22, fontWeight: '800', marginVertical: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  rejectBtn: { backgroundColor: 'rgba(239,68,68,0.12)' },
  rejectText: { color: '#EF4444', fontWeight: '700' },
  btnWrap: { flex: 1.4, borderRadius: 12, overflow: 'hidden' },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  approveText: { color: '#fff', fontWeight: '700' },
  emptyBlock: {
    alignItems: 'center', padding: 28, borderRadius: 16,
    borderWidth: 1, gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
