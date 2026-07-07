import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { StudentService } from '../../src/services/studentService';
import { useStudentQuery } from '../../src/hooks/useStudentQuery';
import type { Student } from '../../src/types/models';
import { FeeService } from '../../src/services/feeService';
import { StudentFee, FeeReceipt } from '../../src/types/models';
import { useAuth } from '../../src/hooks/useAuth';
import * as Haptics from '@/src/utils/haptics';
import { escapeHtml, printHtmlOnWeb } from '../../src/utils/pdfGenerator';
import { useTheme, type SchoolTheme } from '../../src/hooks/useTheme';
import { SchoolSettingsService, SchoolSettings } from '../../src/services/schoolSettingsService';
import LogoLoader from '../../src/components/LogoLoader';
import { useTranslation } from 'react-i18next';
import { t_field } from '../../src/utils/lang';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { useFeatureGuard } from '../../src/hooks/useFeatures';
export default function FeesScreen() {
  useFeatureGuard('nav.fees'); // deep-link guard: redirect Home if Fees is disabled
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    user
  } = useAuth();
  const { t } = useTranslation();
  const roleCode = typeof user?.role === 'object' && user?.role !== null ? (user.role as { code: string }).code : user?.role;
  const isStudent = roleCode === 'student';
  const [activeTab, setActiveTab] = useState<'breakdown' | 'history'>('breakdown');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { data: profile, refetch: refetchProfile } = useStudentQuery<Student>(
    '/students/profile/me',
    'profile',
    3 * 60 * 1000,
    user?.userId,
    { enabled: !!user?.userId && isStudent }
  );
  const [userProfile, setUserProfile] = useState<any>(null);
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [receipts, setReceipts] = useState<FeeReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [summary, setSummary] = useState({
    total_due: 0,
    total_paid: 0,
    balance: 0
  });
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  useEffect(() => {
    const run = async () => {
      if (!user?.userId || !isStudent || !profile?.id) {
        setLoading(false);
        return;
      }
      try {
        setUserProfile(profile);
        const feeData = await StudentService.getFees(profile.id);
        setFees(feeData.fees || []);
        setSummary(feeData.summary || {
          total_due: 0,
          total_paid: 0,
          balance: 0
        });
      } catch {

      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };
    void run();
  }, [user?.userId, isStudent, profile?.id]);
  const loadSchoolSettings = async () => {
    try {
      const data = await SchoolSettingsService.getSettings();
      setSchoolSettings(data);
    } catch (error) {

    }
  };
  useEffect(() => {
    loadSchoolSettings();
  }, []);
  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const fresh = await refetchProfile();
      const sid = fresh?.id ?? profile?.id;
      if (sid) {
        const feeData = await StudentService.getFees(sid);
        setFees(feeData.fees || []);
        setSummary(feeData.summary || { total_due: 0, total_paid: 0, balance: 0 });
      }
    } finally {
      setRefreshing(false);
    }
  };
  const loadReceipts = async () => {
    if (!userProfile?.id) return;
    setLoadingReceipts(true);
    try {
      const data = await FeeService.getReceipts({
        student_id: userProfile.id
      });
      setReceipts(data || []);
    } catch (error) {

    } finally {
      setLoadingReceipts(false);
    }
  };

  const handleDownloadReceipt = async (receiptSummary: FeeReceipt) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Fetch full receipt details including items and student info
      const receipt = await FeeService.getReceipt(receiptSummary.id);

      if (!receipt) {
        alert('Could not fetch receipt details');
        return;
      }

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #4F46E5; padding-bottom: 20px; }
              .school-name { font-size: 24px; font-weight: bold; color: #4F46E5; margin-bottom: 5px; }
              .school-address { font-size: 12px; color: #64748b; margin-bottom: 5px; }
              .school-contact { font-size: 12px; color: #64748b; margin-bottom: 10px; }
              .receipt-title { font-size: 18px; color: #666; letter-spacing: 2px; text-transform: uppercase; margin-top: 15px; }
              .details-container { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 8px; }
              .detail-col { flex: 1; }
              .label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
              .value { font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 12px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
              th { background-color: #f8fafc; font-weight: 600; color: #475569; font-size: 14px; }
              td { font-size: 14px; color: #1e293b; }
              .total-row { font-weight: bold; background-color: #f8fafc; }
              .total-amount { font-size: 18px; color: #4F46E5; }
              .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="school-name">${schoolSettings?.school_name || 'School'}</div>
              ${schoolSettings?.school_address ? `<div class="school-address">${schoolSettings.school_address}</div>` : ''}
              ${schoolSettings?.school_phone || schoolSettings?.school_website ?
      `<div class="school-contact">
                  ${schoolSettings?.school_phone ? `Phone: ${schoolSettings.school_phone}` : ''}
                  ${schoolSettings?.school_phone && schoolSettings?.school_website ? ' &nbsp;|&nbsp; ' : ''}
                  ${schoolSettings?.school_website ? `Web: ${schoolSettings.school_website}` : ''}
                </div>` :
      ''}
              <div class="receipt-title">Fee Receipt</div>
            </div>

            <div class="details-container">
              <div class="detail-col">
                <div class="label">Receipt No</div>
                <div class="value">#${receipt.receipt_no}</div>
                <div class="label">Date</div>
                <div class="value">${new Date(receipt.issued_at).toLocaleDateString()}</div>
              </div>
              <div class="detail-col">
                <div class="label">Student Name</div>
                <div class="value">${receipt.student_name || 'Student'}</div>
                ${receipt.father_name ? `
                <div class="label">Father's Name</div>
                <div class="value">${escapeHtml(receipt.father_name)}</div>
                ` : ''}
                ${receipt.father_mobile ? `
                <div class="label">Father Mobile</div>
                <div class="value">${escapeHtml(receipt.father_mobile)}</div>
                ` : ''}
                <div class="label">Admission No</div>
                <div class="value">${receipt.admission_no || 'N/A'}</div>
                ${receipt.class_name || receipt.section_name ? `
                <div class="label">Class &amp; Section</div>
                <div class="value">${[receipt.class_name, receipt.section_name].filter(Boolean).join(' — ') || 'N/A'}</div>
                ` : ''}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Fee Type</th>
                  <th>Payment Method</th>
                  <th>Date</th>
                  <th style="text-align: right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${receipt.items?.map((item) => `
                  <tr>
                    <td>${item.fee_type || 'Fee Payment'}</td>
                    <td>${(item.payment_method || 'online').toUpperCase()}
                        ${item.transaction_ref ? `<br><small style="color: #64748b">Ref: ${item.transaction_ref}</small>` : ''}
                    </td>
                    <td>${item.paid_at ? new Date(item.paid_at).toLocaleDateString() : 'N/A'}</td>
                    <td style="text-align: right">₹${item.amount.toLocaleString()}</td>
                  </tr>
                `).join('') || ''}
                <tr class="total-row">
                  <td colspan="3" style="text-align: right">Total Amount</td>
                  <td class="total-amount" style="text-align: right">₹${receipt.total_amount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div class="footer">
              <p>This is a computer-generated document. No signature is required.</p>
              ${receipt.issued_by_name ? `<p>Generated by: ${receipt.issued_by_name}</p>` : ''}
            </div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        await printHtmlOnWeb(html);
        return;
      }
      const [Print, Sharing] = await Promise.all([import('expo-print'), import('expo-sharing')]);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {

      alert('Failed to generate receipt');
    }
  };

  const formatAdjustmentOption = (adj: { amount: number; created_at: string; adjustment_type?: string }) => {
    const isAdd = adj.adjustment_type === 'add';
    const sign = isAdd ? '+' : '−';
    const label = isAdd ? 'Added' : 'Waived';
    return `${label}: ${sign}₹${adj.amount.toLocaleString()} (${new Date(adj.created_at).toLocaleDateString()})`;
  };

  const handleDownloadAdjustmentReceipt = async (item: StudentFee) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLoadingReceipts(true);
      const res = await FeeService.getAdjustments({ student_fee_id: item.id });
      const adjustments = res?.data || [];

      if (adjustments.length === 0) {
        alert('No adjustment records found for this fee component.');
        return;
      }

      const generatePdf = async (adj: any) => {
        const details = await FeeService.getAdjustment(adj.id);
        const { generateAdjustmentPDF } = await import('../../src/utils/pdfGenerator');
        await generateAdjustmentPDF(details, schoolSettings);
      };

      if (adjustments.length === 1) {
        await generatePdf(adjustments[0]);
      } else {
        const options = adjustments.map((a: any) => ({
          text: formatAdjustmentOption(a),
          onPress: () => void generatePdf(a)
        }));
        options.push({ text: 'Cancel', style: 'cancel' } as any);
        alertCompat(
          'Multiple Adjustments Found',
          'Please select which adjustment receipt to download:',
          options
        );
      }
    } catch (error) {
      alert('Failed to download adjustment receipt.');
    } finally {
      setLoadingReceipts(false);
    }
  };

  const renderFeeItem = ({
    item

  }: {item: StudentFee;}) => {
    const dueAmount = item.amount_due - item.discount;
    const percent = dueAmount > 0 ? item.amount_paid / dueAmount * 100 : 0;
    return <View style={styles.feeCard}>
      <View style={styles.feeHeader}>
        <Text style={styles.feeTitle}>{t_field(item.fee_type, item.fee_type_te)}</Text>
        <Text style={styles.feeAmount}>₹{dueAmount.toLocaleString()}</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, {
          width: `${Math.min(percent, 100)}%`
        }]} />
      </View>

      <View style={styles.feeFooter}>
        <Text style={styles.paidText}>{t('paidAmount', { defaultValue: 'Paid: ₹{{amount}}', amount: item.amount_paid.toLocaleString() })}</Text>
        <Text style={styles.dueText}>{t('dueAmount', { defaultValue: 'Due: ₹{{amount}}', amount: (dueAmount - item.amount_paid).toLocaleString() })}</Text>
      </View>
      <Text style={[styles.statusText, {
        color: item.status === 'paid' ? '#22c55e' : '#f59e0b'
      }]}>
        {t(item.status.toLowerCase(), item.status.toUpperCase())}
      </Text>

      {((item.adjustment_count ?? 0) > 0 || item.discount > 0) && (
        <View>
          <View style={[styles.divider, { marginVertical: 10, backgroundColor: isDark ? '#334155' : '#e2e8f0' }]} />
          <TouchableOpacity 
            style={[styles.downloadBtn, { backgroundColor: '#eef2ff', paddingVertical: 6 }]} 
            onPress={() => handleDownloadAdjustmentReceipt(item)}
          >
            <Ionicons name="download-outline" size={14} color="#4F46E5" />
            <Text style={[styles.downloadText, { color: '#4F46E5', fontSize: 12 }]}>Adjustment Receipt</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>;
  };
  if (loading) {
    return <ScreenLayout>
      <StudentHeader title={t('fees')} />
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <LogoLoader size={60} color="#4F46E5" />
      </View>
    </ScreenLayout>;
  }
  return <ScreenLayout>
    <StudentHeader title={t('fees')} />

    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" />}>
                {refreshing &&
      <View style={{ width: '100%', alignItems: 'center', paddingVertical: 20 }}>
                        <LogoLoader size={30} />
                    </View>
      }
      {/* SUMMARY CARD */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>{t('totalDue', 'Total Due')}</Text>
            <Text style={styles.summaryValue}>₹{summary.balance.toLocaleString()}</Text>
          </View>
          {summary.balance > 0 && <View style={styles.payBtnMock}>
            <Text style={styles.payBtnText}>{t('payNow', 'Pay Now')}</Text>
          </View>}
        </View>

        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statLabel}>{t('totalFee', 'Total Fee')}</Text>
            <Text style={styles.statValue}>₹{summary.total_due.toLocaleString()}</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View>
            <Text style={styles.statLabel}>{t('paid', 'Paid')}</Text>
            <Text style={styles.statValueSuccess}>₹{summary.total_paid.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* TABS */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'breakdown' && styles.activeTab]} onPress={() => setActiveTab('breakdown')}>
          <Text style={[styles.tabText, activeTab === 'breakdown' && styles.activeTabText]}>
            {t('breakdown', 'Breakdown')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'history' && styles.activeTab]} onPress={() => {
          setActiveTab('history');
          if (receipts.length === 0) loadReceipts();
        }}>
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            {t('receipts', 'Receipts')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      <View style={styles.contentSection}>
        {activeTab === 'breakdown' ? fees.length === 0 ? <Text style={styles.emptyText}>{t('noFeeRecordsFound', 'No fee records found.')}</Text> : fees.map((item) => <View key={item.id}>{renderFeeItem({
            item
          })}</View>) : (/* RECEIPTS LIST */
        loadingReceipts ? <LogoLoader size={30} color="#4F46E5" style={{
          marginTop: 20
        }} /> : receipts.length === 0 ? <Text style={styles.emptyText}>{t('noReceiptsFound', 'No receipts found.')}</Text> : receipts.map((receipt) => {
          return <View key={receipt.id} style={styles.receiptCard}>
              <View style={styles.receiptHeader}>
                <View>
                  <Text style={styles.receiptNo}>#{receipt.receipt_no}</Text>
                  <Text style={styles.receiptDate}>{new Date(receipt.issued_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.receiptAmount}>₹{receipt.total_amount.toLocaleString()}</Text>
              </View>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownloadReceipt(receipt)}>
                <Ionicons name="download-outline" size={16} color="#4F46E5" />
                <Text style={styles.downloadText}>{t('downloadReceipt', 'Download Receipt')}</Text>
              </TouchableOpacity>
            </View>;
        }))}
      </View>

    </ScrollView>
  </ScreenLayout>;
}
const getStyles = (theme: SchoolTheme) => {
  const c = theme.colors;
  const isDark = theme.dark;
  return StyleSheet.create({
  scrollContainer: {
    padding: 20,
    paddingBottom: 40
  },
  /* Summary Card */
  summaryCard: {
    backgroundColor: '#1e293b',
    // Dark slate blue
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    elevation: 8,
    shadowColor: '#1e293b',
    shadowOpacity: 0.3,
    shadowRadius: 10
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  summaryValue: {
    color: isDark ? '#F8FAFC' : c.background,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4
  },
  payBtnMock: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25
  },
  payBtnText: {
    color: '#1e293b',
    fontWeight: '700',
    fontSize: 14
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500'
  },
  statValue: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2
  },
  statValueSuccess: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2
  },
  verticalDivider: {
    width: 1,
    backgroundColor: '#334155'
  },
  /* Tabs */
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    padding: 6,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: c.borderLight
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10
  },
  activeTab: {
    backgroundColor: isDark ? 'rgba(99,102,241,0.22)' : '#e0e7ff'
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textSecondary
  },
  activeTabText: {
    color: c.primary,
    fontWeight: '700'
  },
  /* Receipt Card */
  receiptCard: {
    backgroundColor: c.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: c.borderLight,
    elevation: 2,
    shadowColor: c.textPrimary,
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  receiptNo: {
    fontSize: 16,
    fontWeight: '700',
    color: c.textStrong
  },
  receiptDate: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 2
  },
  receiptAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10b981'
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#e0e7ff',
    borderRadius: 8,
    gap: 8
  },
  downloadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338ca'
  },
  /* Fee Item */
  contentSection: {
    flex: 1
  },
  feeCard: {
    backgroundColor: c.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: c.borderLight,
    elevation: 2,
    shadowColor: c.textPrimary,
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  feeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  feeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: c.textStrong
  },
  feeAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: c.textStrong
  },
  progressBarBg: {
    height: 6,
    backgroundColor: isDark ? c.borderLight : '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4f46e5',
    borderRadius: 3
  },
  feeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  paidText: {
    fontSize: 12,
    color: '#22c55e',
    // green
    fontWeight: '600'
  },
  dueText: {
    fontSize: 12,
    color: '#ef4444',
    // red
    fontWeight: '600'
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 8,
    alignSelf: 'flex-end'
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: c.textMuted
  }
});
};