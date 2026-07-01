import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl, Dimensions, StatusBar, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, ZoomIn, useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import StaffHeader from '../../src/components/StaffHeader';
import ViewAsBanner from '../../src/components/ViewAsBanner';
import LogoLoader from '../../src/components/LogoLoader';
import { api } from '../../src/services/apiClient';
import { useEffectiveStaffId } from '../../src/hooks/useEffectiveStaffId';

const { width: SW } = Dimensions.get('window');

// ─── Status matching ───────────────────────────────────────────
const STATUS_META: Record<string, {
    label: string;
    darkColors: [string, string];
    lightColors: [string, string];
    darkText: string;
    lightText: string;
    darkBg: string;
    lightBg: string;
    icon: string;
}> = {
    present: {
        label: 'Present',
        darkColors: ['#00C48C', '#009E72'],
        lightColors: ['#00C48C', '#009E72'],
        darkText: '#00C48C',
        lightText: '#007A58',
        darkBg: 'rgba(0,196,140,0.15)',
        lightBg: 'rgba(0,122,88,0.10)',
        icon: 'checkmark-circle',
    },
    absent: {
        label: 'Absent',
        darkColors: ['#FF4D6A', '#C0203B'],
        lightColors: ['#FF4D6A', '#C0203B'],
        darkText: '#FF4D6A',
        lightText: '#B0102E',
        darkBg: 'rgba(255,77,106,0.15)',
        lightBg: 'rgba(176,16,46,0.10)',
        icon: 'close-circle',
    },
    half_day: {
        label: 'Half-Day',
        darkColors: ['#FFB800', '#E67E00'],
        lightColors: ['#FFB800', '#E67E00'],
        darkText: '#FFB800',
        lightText: '#A05500',
        darkBg: 'rgba(255,184,0,0.15)',
        lightBg: 'rgba(160,85,0,0.10)',
        icon: 'time',
    },
};

// ─── Stat Chip ────────────────────────────────────────────────────────────────
function StatChip({ value, label, color, icon, isDark }: { value: number; label: string; color: string; icon: string; isDark: boolean }) {
    const chipBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    const chipBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
    const labelColor = isDark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.42)';

    return (
        <View style={[styles.statChip, { backgroundColor: chipBg, borderColor: chipBorder }]}>
            <View style={[styles.statIcon, { backgroundColor: `${color}22` }]}>
                <Ionicons name={icon as any} size={14} color={color} />
            </View>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: labelColor }]}>{label}</Text>
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function StaffMyAttendanceScreen() {
    const { theme, isDark } = useTheme();
    const { t } = useTranslation();
    const router = useRouter();
    const { isViewingAsAdmin, viewAsName } = useEffectiveStaffId();

    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<any[]>([]);

    const scrollY = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler({
        onScroll: (e) => { scrollY.value = e.contentOffset.y; },
    });

    // ── Theme tokens ────────────────────────────────────────────────────────────
    const pageBg = isDark ? '#0E0F1A' : '#F2F3F8';
    const cardBg = isDark ? 'rgba(255,255,255,0.048)' : '#FFFFFF';
    const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    const summaryBg = isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
    const summaryBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    const titleColor = isDark ? '#FFFFFF' : '#111827';
    const subColor = isDark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.42)';
    const sectionColor = isDark ? 'rgba(255,255,255,0.36)' : 'rgba(0,0,0,0.36)';
    const filterBg = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
    const filterBorder = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)';
    const filterText = isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.65)';
    const orb1Color = isDark ? 'rgba(124,111,255,0.08)' : 'rgba(124,111,255,0.05)';
    const orb2Color = isDark ? 'rgba(0,196,140,0.06)' : 'rgba(0,196,140,0.05)';

    // Date range for the current month
    const currentDate = new Date();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

    // ── Data ────────────────────────────────────────────────────────────────────
    const fetchAttendance = useCallback(async () => {
        try {
            setLoading(true);
            // Fetch for the current month by default
            const data = await api.get<any[]>('/attendance/staff/me', { from_date: firstDay, to_date: lastDay });
            setRecords(data || []);
        } catch { }
        finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [firstDay, lastDay]);

    useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

    const onRefresh = () => { setRefreshing(true); fetchAttendance(); };

    // Calculate Summary
    const stats = records.reduce((acc, curr) => {
        if (curr.status === 'present') acc.present++;
        else if (curr.status === 'absent') acc.absent++;
        else if (curr.status === 'half_day') acc.half++;
        return acc;
    }, { present: 0, absent: 0, half: 0 });

    const currentMonthStr = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    // ── Render ──────────────────────────────────────────────────────────────────
    return (
        <View style={[styles.container, { backgroundColor: pageBg }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={pageBg} />

            {/* Ambient orbs */}
            <View style={[styles.orb1, { backgroundColor: orb1Color }]} />
            <View style={[styles.orb2, { backgroundColor: orb2Color }]} />

            <StaffHeader title="My Attendance" subtitle={currentMonthStr} scrollY={scrollY} onBack={() => router.back()} />
            {isViewingAsAdmin && <ViewAsBanner name={viewAsName} limited />}

            {loading && !refreshing ? (
                <View style={styles.loaderContainer}>
                    <LogoLoader size={56} color="#7C6FFF" />
                    <Text style={[styles.loaderText, { color: subColor }]}>Loading history…</Text>
                </View>
            ) : (
                <Animated.ScrollView
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="transparent"
                            colors={['transparent']}
                            progressBackgroundColor="transparent"
                        />
                    }
                >
                    {refreshing && (
                        <View style={{ alignItems: 'center', paddingBottom: 16 }}>
                            <LogoLoader size={30} color="#7C6FFF" />
                        </View>
                    )}

                    {/* ── Summary card ─────────────────────────────────────────────── */}
                    <Animated.View
                        entering={FadeInDown.delay(0).duration(500).springify()}
                        style={[styles.summaryCard, { backgroundColor: summaryBg, borderColor: summaryBorder }]}
                    >
                        {isDark && <View style={styles.summaryShimmer} />}

                        <View style={styles.summaryTop}>
                            <View style={{ flex: 1 }}>
                                <View style={styles.sectionAccentRow}>
                                    <LinearGradient
                                        colors={['#7C6FFF', '#5A4FE0']}
                                        style={styles.sectionAccent}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    />
                                    <Text style={[styles.overviewLabel, { color: sectionColor }]}>MONTHLY OVERVIEW</Text>
                                </View>
                                <Text style={[styles.dateTitle, { color: titleColor }]}>{currentMonthStr}</Text>
                                <Text style={[styles.dateSub, { color: subColor }]}>{records.length} total records</Text>
                            </View>
                        </View>

                        {/* Stat chips */}
                        <View style={styles.statChipsRow}>
                            <StatChip value={stats.present} label="Present" color="#00C48C" icon="checkmark-circle" isDark={isDark} />
                            <StatChip value={stats.absent} label="Absent" color="#FF4D6A" icon="close-circle" isDark={isDark} />
                            <StatChip value={stats.half} label="Half-Day" color="#FFB800" icon="time" isDark={isDark} />
                        </View>
                    </Animated.View>

                    {/* ── Filter chips ───────────────────────────────────────────────── */}
                    <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.filterRow}>
                        {['This Month', 'All Statuses'].map((label) => (
                            <TouchableOpacity
                                key={label}
                                activeOpacity={0.75}
                                style={[styles.filterChip, { backgroundColor: filterBg, borderColor: filterBorder }]}
                            >
                                <Text style={[styles.filterChipText, { color: filterText }]}>{label}</Text>
                                <Ionicons name="chevron-down" size={13} color={filterText} style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                        ))}
                    </Animated.View>

                    {/* ── Section header ─────────────────────────────────────────────── */}
                    <Animated.View
                        entering={FadeInDown.delay(120).duration(400)}
                        style={styles.listHeader}
                    >
                        <View style={styles.sectionAccentRow}>
                            <LinearGradient
                                colors={['#7C6FFF', '#5A4FE0']}
                                style={styles.sectionAccent}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                            />
                            <Text style={[styles.sectionTitle, { color: sectionColor }]}>ATTENDANCE LOG</Text>
                        </View>
                    </Animated.View>

                    {/* ── Attendance List ────────────────────────────────────────────────── */}
                    {records.length === 0 ? (
                        <Animated.View entering={ZoomIn.duration(400)} style={styles.emptyBox}>
                            <LinearGradient
                                colors={['rgba(124,111,255,0.15)', 'rgba(124,111,255,0.04)']}
                                style={styles.emptyIcon}
                            >
                                <Ionicons name="calendar-outline" size={36} color="rgba(124,111,255,0.6)" />
                            </LinearGradient>
                            <Text style={[styles.emptyTitle, { color: titleColor }]}>No Records Found</Text>
                            <Text style={[styles.emptySub, { color: subColor }]}>
                                Attendance has not been marked.
                            </Text>
                        </Animated.View>
                    ) : (
                        records.map((record, index) => {
                            const dateObj = new Date(record.attendance_date);
                            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                            const dayNum = dateObj.toLocaleDateString('en-US', { day: 'numeric' });
                            const monthShort = dateObj.toLocaleDateString('en-US', { month: 'short' });
                            const status = record.status || 'absent';
                            const meta = STATUS_META[status] ?? STATUS_META.absent;

                            return (
                                <Animated.View key={record.id} entering={FadeInUp.delay(index * 30).duration(450).springify().damping(13)}>
                                    <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                                        <View style={styles.cardRow}>
                                            <View style={[styles.dateBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                                                <Text style={[styles.dayText, { color: titleColor }]}>{dayNum}</Text>
                                                <Text style={[styles.monthText, { color: subColor }]}>{monthShort}</Text>
                                            </View>

                                            <View style={styles.cardInfo}>
                                                <Text style={[styles.staffName, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1}>
                                                    {dayName}, {monthShort} {dayNum}
                                                </Text>
                                                <Text style={[styles.staffRole, { color: subColor }]} numberOfLines={1}>
                                                    Marked at: {new Date(record.marked_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                </Text>
                                            </View>

                                            {/* Status Badge */}
                                            <View style={[styles.statusBadge, { backgroundColor: isDark ? meta.darkBg : meta.lightBg }]}>
                                                <Ionicons name={meta.icon as any} size={13} color={isDark ? meta.darkText : meta.lightText} style={{ marginRight: 5 }} />
                                                <Text style={[styles.statusBadgeText, { color: isDark ? meta.darkText : meta.lightText }]}>{meta.label}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </Animated.View>
                            );
                        })
                    )}
                </Animated.ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    orb1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, top: -80, right: -100 },
    orb2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, bottom: 140, left: -80 },
    scrollContent: { paddingTop: 100, paddingHorizontal: 20, paddingBottom: 40 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
    loaderText: { fontSize: 14, fontWeight: '500', letterSpacing: 0.4 },

    summaryCard: {
        borderRadius: 22, padding: 20, marginBottom: 18,
        borderWidth: 1, overflow: 'hidden',
    },
    summaryShimmer: {
        position: 'absolute', top: 0, left: 28, right: 28, height: 1,
        backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 1,
    },
    summaryTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
    sectionAccentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    sectionAccent: { width: 3, height: 12, borderRadius: 2, marginRight: 7 },
    overviewLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2.2 },
    dateTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 3 },
    dateSub: { fontSize: 13, fontWeight: '500' },

    statChipsRow: { flexDirection: 'row', gap: 10 },
    statChip: {
        flex: 1, alignItems: 'center', padding: 12,
        borderRadius: 14, borderWidth: 1, gap: 5,
    },
    statIcon: {
        width: 28, height: 28, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center', marginBottom: 2,
    },
    statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    statLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },

    filterRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
    filterChip: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 9,
        borderRadius: 20, borderWidth: 1,
    },
    filterChipText: { fontSize: 12, fontWeight: '600' },

    listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2.2 },

    card: {
        borderRadius: 18, padding: 14, marginBottom: 10,
        borderWidth: 1, overflow: 'hidden',
    },
    cardRow: { flexDirection: 'row', alignItems: 'center' },
    dateBox: {
        width: 46, height: 46, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', marginRight: 13,
    },
    dayText: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
    monthText: { fontSize: 11, fontWeight: '600', marginTop: -2 },
    cardInfo: { flex: 1 },
    staffName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 3 },
    staffRole: { fontSize: 12, fontWeight: '500' },

    statusBadge: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    },
    statusBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

    emptyBox: { alignItems: 'center', paddingTop: 40, gap: 12 },
    emptyIcon: {
        width: 76, height: 76, borderRadius: 22,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 4, borderWidth: 1, borderColor: 'rgba(124,111,255,0.2)',
    },
    emptyTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
    emptySub: { fontSize: 13, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 },
});
