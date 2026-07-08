import React, { useState, useMemo, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, Platform, Share, ActivityIndicator,
} from 'react-native';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';
import { alertCompat } from '../../../src/utils/crossPlatformAlert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import AdminHeader from '../../../src/components/AdminHeader';
import { useAccountsWebChrome } from '../../../src/contexts/AccountsWebChromeContext';
import { FeeService as FeesService } from '../../../src/services/feeService';
import { UpiSettingsService } from '../../../src/services/upiSettingsService';
import { APIError } from '../../../src/services/apiClient';
import { useTheme } from '../../../src/hooks/useTheme';
import { generateReceiptPDF } from '../../../src/utils/pdfGenerator';
import { showConfirm, showSuccess, showError } from '../../../src/components/CustomAlert';
import { buildUpiPayUri, parseInrAmount } from '../../../src/utils/upiDeepLink';
import LogoLoader from '../../../src/components/LogoLoader';
import { generateUUID } from './collect';

const PAYMENT_MODES = [
    { id: 'Cash', label: 'Cash', icon: '💵' },
    { id: 'UPI', label: 'UPI', icon: '📲' },
    { id: 'Cheque', label: 'Cheque', icon: '🏦' },
];

interface MultiFeeLine {
    id: string;          // student_fee_id
    fee_type: string;
    due: number;
    amount: string;      // editable
}

interface RawSelectedItem {
    id: string;
    fee_type: string;
    due: number | string;
}

export default function CollectMultiFeesScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { theme, isDark } = useTheme();
    const { shellActive } = useAccountsWebChrome();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    const studentId = params.studentId as string;
    const studentName = params.name as string;
    const admissionNo = params.admissionNo as string;
    const className = params.className as string | undefined;
    const sectionName = params.sectionName as string | undefined;
    const fatherName = params.fatherName as string | undefined;
    const fatherMobile = params.fatherMobile as string | undefined;

    const initialLines = useMemo<MultiFeeLine[]>(() => {
        try {
            const parsed: RawSelectedItem[] = JSON.parse((params.items as string) || '[]');
            return parsed.map((it) => {
                const due = Math.max(0, Number(it.due) || 0);
                return { id: it.id, fee_type: it.fee_type, due, amount: String(due) };
            });
        } catch {
            return [];
        }
    }, [params.items]);

    const [lines, setLines] = useState<MultiFeeLine[]>(initialLines);
    const [mode, setMode] = useState('Cash');
    const [remarks, setRemarks] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── UPI settings (for the combined-total QR) ──
    const [upiLoading, setUpiLoading] = useState(false);
    const [upiLoadError, setUpiLoadError] = useState<string | null>(null);
    const [schoolUpiId, setSchoolUpiId] = useState('');
    const [schoolPayeeName, setSchoolPayeeName] = useState('');
    const [upiFetchTick, setUpiFetchTick] = useState(0);

    useEffect(() => {
        if (mode !== 'UPI') return;
        let alive = true;
        setUpiLoading(true);
        setUpiLoadError(null);
        UpiSettingsService.get()
            .then((d) => {
                if (!alive) return;
                setSchoolUpiId((d.upi_id ?? '').trim());
                setSchoolPayeeName((d.display_name ?? '').trim());
            })
            .catch((e) => {
                if (!alive) return;
                setUpiLoadError(e instanceof APIError ? e.message : 'Could not load school UPI settings.');
            })
            .finally(() => { if (alive) setUpiLoading(false); });
        return () => { alive = false; };
    }, [mode, upiFetchTick]);

    const setLineAmount = (id: string, value: string) => {
        setError(null);
        setLines((prev) => prev.map((l) => (l.id === id ? { ...l, amount: value } : l)));
    };
    const removeLine = (id: string) => {
        setError(null);
        setLines((prev) => prev.filter((l) => l.id !== id));
    };

    const parsedLines = lines.map((l) => {
        const amt = parseFloat(l.amount) || 0;
        return { ...l, amt, overpay: amt > l.due, valid: amt > 0 && amt <= l.due };
    });
    const total = parsedLines.reduce((sum, l) => sum + (l.valid ? l.amt : 0), 0);
    const anyOverpay = parsedLines.some((l) => l.overpay);
    const anyInvalid = parsedLines.some((l) => !l.valid);
    const isReady = lines.length > 0 && total > 0 && !anyOverpay && !anyInvalid;

    const inrAmountStr = parseInrAmount(String(total));
    const upiPayUri =
        mode === 'UPI' && inrAmountStr && schoolUpiId && schoolPayeeName
            ? buildUpiPayUri(schoolUpiId, schoolPayeeName, inrAmountStr, remarks || `Fees ${studentName}`)
            : '';
    const upiQrReady = mode === 'UPI' && isReady && !!upiPayUri && !upiLoading && !upiLoadError;

    const submit = async () => {
        setError(null);
        if (!isReady) {
            setError('Enter valid amounts for the selected fee types.');
            return;
        }
        if (mode === 'UPI') {
            if (upiLoading) { setError('Loading school UPI settings…'); return; }
            if (upiLoadError) { setError(upiLoadError); return; }
            if (!schoolUpiId || !schoolPayeeName) {
                setError('School UPI is not configured. Ask an admin to set it under Admin → UPI fee settings, or use Cash/Cheque.');
                return;
            }
            if (!upiPayUri) { setError('Could not build UPI payment link. Check the amount and school UPI settings.'); return; }
        }

        const feeCount = parsedLines.filter((l) => l.valid).length;
        const confirmed = await showConfirm({
            title: 'Confirm Combined Payment',
            message:
                mode === 'UPI'
                    ? `Record ₹${total.toLocaleString('en-IN')} across ${feeCount} fee type${feeCount === 1 ? '' : 's'} on ONE receipt?\n\nOnly confirm after the payer has completed the UPI payment (show them the QR above).`
                    : `Record ₹${total.toLocaleString('en-IN')} across ${feeCount} fee type${feeCount === 1 ? '' : 's'} via ${mode} on ONE receipt?\n\nThis action is permanent and will be logged.`,
            confirmText: 'Confirm & Record',
            cancelText: 'Cancel',
            type: 'confirm',
        });
        if (!confirmed) return;

        setLoading(true);
        try {
            const result = await FeesService.collectMultipleFees({
                payment_method: mode.toLowerCase() as 'cash' | 'upi' | 'cheque',
                transaction_ref: generateUUID(),
                remarks: remarks.trim() || undefined,
                items: parsedLines.filter((l) => l.valid).map((l) => ({ student_fee_id: l.id, amount: l.amt })),
            });

            const txn = {
                ...result.transaction,
                student_id: result.transaction.student_id || studentId,
                student_name: result.transaction.student_name || studentName,
                admission_no: result.transaction.admission_no || admissionNo,
                class_name: result.transaction.class_name || className,
                section_name: result.transaction.section_name || sectionName,
                father_name: result.transaction.father_name || fatherName,
                father_mobile: result.transaction.father_mobile || fatherMobile,
                paid_at: result.transaction.paid_at || new Date().toISOString(),
            } as any;

            const receiptNo = result.receipt?.receipt_no || result.transaction.receipt_no || 'pending';
            const printAction = {
                text: 'Print Receipt',
                onPress: async () => {
                    await generateReceiptPDF(txn);
                    router.back();
                },
            };
            const doneAction = { text: 'Done', onPress: () => router.back() };

            if (Platform.OS === 'web') {
                await showSuccess(
                    '✓ Payment Recorded',
                    `One receipt ${receiptNo} generated for ₹${total.toLocaleString('en-IN')} across ${feeCount} fee type${feeCount === 1 ? '' : 's'}.\n\nLedger updated.`,
                    [{ ...printAction, onPress: async () => { await generateReceiptPDF(txn); } }, { text: 'Done' }],
                );
                router.back();
                return;
            }
            alertCompat(
                '✓ Payment Recorded',
                `One receipt ${receiptNo} generated for ₹${total.toLocaleString('en-IN')} across ${feeCount} fee type${feeCount === 1 ? '' : 's'}.\n\nLedger updated.`,
                [printAction, doneAction],
            );
        } catch (e: any) {
            const msg = e instanceof APIError ? e.message : (e?.message || 'Could not process the combined payment.');
            setError(msg);
            await showError('Payment Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {!shellActive && <AdminHeader title="Collect Multiple Fees" showBackButton={true} />}

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Student card */}
                <View style={styles.infoCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{(studentName || 'S').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.studentName} numberOfLines={1}>{studentName || 'Unknown Student'}</Text>
                        <View style={styles.tagRow}>
                            <View style={styles.tag}><Text style={styles.tagText}>#{admissionNo || '—'}</Text></View>
                            <View style={[styles.tag, styles.tagBlue]}>
                                <Text style={[styles.tagText, { color: '#3B82F6' }]}>
                                    {lines.length} fee type{lines.length === 1 ? '' : 's'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Selected Fee Types</Text>
                <Text style={styles.hint}>
                    One receipt will be generated covering all the fee types below. Edit amounts for partial collection.
                </Text>

                {lines.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>No fee types selected. Go back and select fee types to collect together.</Text>
                    </View>
                ) : (
                    parsedLines.map((l) => (
                        <View key={l.id} style={[styles.lineCard, l.overpay && styles.lineCardError]}>
                            <View style={styles.lineTop}>
                                <Text style={styles.lineType} numberOfLines={1}>{l.fee_type}</Text>
                                <TouchableOpacity onPress={() => removeLine(l.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Text style={styles.removeBtn}>✕</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.lineDue}>Due ₹{l.due.toLocaleString('en-IN')}</Text>
                            <View style={[styles.amountBox, l.overpay && styles.amountBoxError]}>
                                <Text style={styles.rupee}>₹</Text>
                                <AppTextInput
                                    style={[ds.inputInChrome, styles.amountInput]}
                                    keyboardType="numeric"
                                    value={l.amount}
                                    onChangeText={(t) => setLineAmount(l.id, t)}
                                    placeholder="0"
                                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : '#94A3B8'}
                                />
                                {l.valid && (
                                    <View style={styles.payBadge}>
                                        <Text style={styles.payBadgeText}>{l.amt === l.due ? 'FULL' : 'PARTIAL'}</Text>
                                    </View>
                                )}
                            </View>
                            {l.overpay && (
                                <Text style={styles.overpayHint}>⚠ Exceeds due by ₹{(l.amt - l.due).toLocaleString('en-IN')}</Text>
                            )}
                        </View>
                    ))
                )}

                {/* Payment mode */}
                <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Payment Mode</Text>
                <View style={styles.modeRow}>
                    {PAYMENT_MODES.map((m) => {
                        const selected = mode === m.id;
                        return (
                            <TouchableOpacity
                                key={m.id}
                                style={[styles.modeBtn, selected && styles.modeBtnActive]}
                                onPress={() => { setError(null); setMode(m.id); }}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.modeIcon}>{m.icon}</Text>
                                <Text style={[styles.modeLabel, { color: selected ? '#3B82F6' : (isDark ? 'rgba(255,255,255,0.5)' : '#6B7280') }]}>
                                    {m.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Remarks */}
                <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Remarks</Text>
                <AppTextInput
                    style={styles.remarksInput}
                    multiline
                    value={remarks}
                    onChangeText={(t) => { setError(null); setRemarks(t); }}
                    placeholder="e.g. Combined payment for Term 1 fees…"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : '#94A3B8'}
                />

                {/* UPI QR for the combined total */}
                {mode === 'UPI' && isReady ? (
                    <View style={styles.upiSection}>
                        <Text style={styles.upiTitle}>Pay ₹{total.toLocaleString('en-IN')} via UPI</Text>
                        {upiLoading ? (
                            <View style={{ alignItems: 'center', paddingVertical: 20, gap: 10 }}>
                                <ActivityIndicator color="#3B82F6" />
                                <Text style={styles.upiMuted}>Loading school UPI…</Text>
                            </View>
                        ) : upiLoadError ? (
                            <View>
                                <Text style={styles.upiWarn}>{upiLoadError}</Text>
                                <TouchableOpacity onPress={() => setUpiFetchTick((n) => n + 1)}><Text style={styles.upiLink}>Retry</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => setMode('Cash')}><Text style={[styles.upiLink, { marginTop: 6 }]}>Use Cash / Cheque instead</Text></TouchableOpacity>
                            </View>
                        ) : !schoolUpiId || !schoolPayeeName ? (
                            <Text style={styles.upiWarn}>School UPI is not set. An admin must configure it under Admin → UPI fee settings.</Text>
                        ) : upiPayUri ? (
                            <>
                                <View style={styles.upiQrFrame}>
                                    <QRCode value={upiPayUri} size={200} color="#0f172a" backgroundColor="#FFFFFF" />
                                </View>
                                <Text style={styles.upiMeta}><Text style={{ fontWeight: '700' }}>UPI ID </Text>{schoolUpiId}</Text>
                                <Text style={styles.upiMeta}><Text style={{ fontWeight: '700' }}>Amount </Text>₹{inrAmountStr}</Text>
                                <TouchableOpacity
                                    style={styles.upiShareBtn}
                                    onPress={() => Share.share({ message: upiPayUri, title: 'UPI payment' }).catch(() => { })}
                                >
                                    <Text style={styles.upiShareBtnText}>Share UPI link</Text>
                                </TouchableOpacity>
                                <Text style={styles.upiMuted}>After payment appears in the school UPI account, tap the button below to record it.</Text>
                            </>
                        ) : null}
                    </View>
                ) : null}

                {/* Total summary */}
                {lines.length > 0 && (
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Fee types</Text>
                            <Text style={styles.summaryValue}>{parsedLines.filter((l) => l.valid).length}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Payment mode</Text>
                            <Text style={styles.summaryValue}>{mode}</Text>
                        </View>
                        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                            <Text style={styles.summaryTotalLabel}>Total (one receipt)</Text>
                            <Text style={styles.summaryTotalValue}>₹{total.toLocaleString('en-IN')}</Text>
                        </View>
                    </View>
                )}

                {error ? (
                    <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View>
                ) : null}

                <TouchableOpacity
                    style={[styles.payBtn, (!isReady || loading || (mode === 'UPI' && !upiQrReady)) && styles.payBtnDisabled]}
                    onPress={submit}
                    disabled={!isReady || loading || (mode === 'UPI' && !upiQrReady)}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <LogoLoader color="#fff" />
                    ) : (
                        <Text style={styles.payBtnText}>
                            {!isReady
                                ? 'Enter Amounts to Continue'
                                : `Collect ₹${total.toLocaleString('en-IN')} · 1 Receipt`}
                        </Text>
                    )}
                </TouchableOpacity>

                <View style={{ height: 32 }} />
            </ScrollView>
        </View>
    );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 16, gap: 4 },
    infoCard: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
        borderRadius: 18, padding: 16, marginBottom: 8,
        borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    },
    avatar: {
        width: 48, height: 48, borderRadius: 14,
        backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#DBEAFE',
        alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 20, fontWeight: '800', color: '#3B82F6' },
    studentName: { fontSize: 16, fontWeight: '700', color: isDark ? '#F9FAFB' : '#111827', marginBottom: 6 },
    tagRow: { flexDirection: 'row', gap: 6 },
    tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6' },
    tagBlue: { backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#EFF6FF' },
    tagText: { fontSize: 11, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280', letterSpacing: 0.3 },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: isDark ? '#F9FAFB' : '#111827', marginTop: 8, marginBottom: 4, letterSpacing: 0.2 },
    hint: { fontSize: 12, color: isDark ? 'rgba(255,255,255,0.45)' : '#6B7280', marginBottom: 12, lineHeight: 17 },
    emptyBox: {
        padding: 16, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
        borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#D1D5DB',
    },
    emptyText: { fontSize: 13, color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280', textAlign: 'center' },
    lineCard: {
        backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
        borderRadius: 14, padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    },
    lineCardError: { borderColor: '#EF4444' },
    lineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    lineType: { fontSize: 15, fontWeight: '700', color: isDark ? '#F9FAFB' : '#111827', flex: 1 },
    removeBtn: { fontSize: 14, fontWeight: '800', color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF', paddingHorizontal: 6 },
    lineDue: { fontSize: 12, color: isDark ? 'rgba(255,255,255,0.45)' : '#6B7280', marginTop: 2, marginBottom: 10, fontWeight: '600' },
    amountBox: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
        borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
        borderRadius: 12, paddingHorizontal: 14,
    },
    amountBoxError: { borderColor: '#EF4444', backgroundColor: isDark ? 'rgba(239,68,68,0.06)' : '#FFF5F5' },
    rupee: { fontSize: 18, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF', marginRight: 6 },
    amountInput: { flex: 1, fontSize: 22, fontWeight: '800', color: isDark ? '#F9FAFB' : '#111827', paddingVertical: 12 },
    payBadge: { backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    payBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.8 },
    overpayHint: { fontSize: 12, color: '#EF4444', fontWeight: '600', marginTop: 8 },
    modeRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modeBtn: {
        flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14, borderRadius: 14,
        borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFF',
    },
    modeBtnActive: { borderColor: '#3B82F6', backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : '#DBEAFE' },
    modeIcon: { fontSize: 20 },
    modeLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
    remarksInput: {
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
        borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#CBD5E1',
        borderRadius: 14, padding: 14, fontSize: 14, color: isDark ? '#F9FAFB' : '#111827',
        height: 70, textAlignVertical: 'top', marginTop: 4,
    },
    upiSection: {
        marginTop: 16, padding: 16, borderRadius: 16,
        backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
        borderWidth: 1, borderColor: isDark ? 'rgba(245,158,11,0.25)' : '#FDE68A',
        alignItems: 'center',
    },
    upiTitle: { fontSize: 15, fontWeight: '800', color: isDark ? '#FBBF24' : '#B45309', marginBottom: 12 },
    upiMuted: { fontSize: 12, color: isDark ? 'rgba(255,255,255,0.45)' : '#6B7280', textAlign: 'center', marginTop: 8 },
    upiWarn: { fontSize: 13, color: '#F87171', fontWeight: '600', textAlign: 'center' },
    upiLink: { fontSize: 13, fontWeight: '700', color: '#3B82F6', marginTop: 10, textAlign: 'center' },
    upiQrFrame: { padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF', marginBottom: 12 },
    upiMeta: { fontSize: 13, color: isDark ? '#E5E7EB' : '#374151', fontWeight: '600', marginBottom: 4 },
    upiShareBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#EFF6FF', marginTop: 8 },
    upiShareBtnText: { fontSize: 13, fontWeight: '800', color: '#3B82F6' },
    summaryCard: {
        marginTop: 16, backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
        borderRadius: 16, padding: 16, borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
    summaryLabel: { fontSize: 13, color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280', fontWeight: '500' },
    summaryValue: { fontSize: 13, color: isDark ? '#F9FAFB' : '#374151', fontWeight: '700' },
    summaryTotalRow: { borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', marginTop: 4, paddingTop: 12 },
    summaryTotalLabel: { fontSize: 14, fontWeight: '800', color: isDark ? '#F9FAFB' : '#111827' },
    summaryTotalValue: { fontSize: 18, fontWeight: '800', color: '#10B981' },
    errorBanner: {
        marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1,
        borderColor: isDark ? 'rgba(248,113,113,0.5)' : '#FECACA',
        backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
    },
    errorText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: isDark ? '#FECACA' : '#991B1B' },
    payBtn: {
        marginTop: 18, backgroundColor: '#10B981', paddingVertical: 17, borderRadius: 16, alignItems: 'center',
        ...Platform.select({
            ios: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
            android: { elevation: 6 },
        }),
    },
    payBtnDisabled: { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB', shadowOpacity: 0, elevation: 0 },
    payBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
