import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Pressable,
  StatusBar,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { api } from '../../src/services/apiClient';
import LogoLoader from '../../src/components/LogoLoader';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { useTheme } from '../../src/hooks/useTheme';

/** Legacy trips may still use `active`; canonical live status is `in_progress`. */
const tripStatusIsActive = (s?: string | null) =>
  s === 'in_progress' || s === 'active';

/**
 * Best-effort recent GPS fix for calibration capture (Phase A). Native only;
 * returns {} when permission is missing or no recent fix exists — the mark
 * still goes through, it just doesn't contribute a calibration sample.
 */
const calibrationFixBody = async (): Promise<Record<string, unknown>> => {
  if (Platform.OS === 'web') return {};
  try {
    const pos = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
    if (!pos) return {};
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
      is_mocked: pos.mocked || false,
    };
  } catch {
    return {};
  }
};

type TripPayload = {
  trip: {
    id: string;
    status: string;
    started_at?: string | null;
    completed_at?: string | null;
    route_name?: string;
    direction?: string;
    date?: string;
  };
  stops: Array<{
    stop_id: string;
    stop_name: string;
    stop_order: number;
    status?: string;
    reached_at?: string | null;
    assigned_students?: number;
  }>;
};

export default function DriverTripScreen() {
  const [payload, setPayload] = useState<TripPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noRoute, setNoRoute] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { theme } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);

  const loadTrip = useCallback(async (silent?: boolean) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.get<TripPayload>('/transport/driver/my-trip');
      setPayload(data);
      setNoRoute(false);
    } catch (e: any) {
      const code = e?.statusCode ?? e?.status;
      const msg = e?.message || '';
      if (code === 404 || msg.includes('No route')) {
        setNoRoute(true);
        setPayload(null);
      } else {
        alertCompat('Error', msg || 'Could not load trip');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrip();
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [loadTrip]),
  );

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    const st = payload?.trip?.status;
    if (tripStatusIsActive(st)) {
      pollRef.current = setInterval(() => loadTrip(true), 30000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [payload?.trip?.status, loadTrip]);

  const trip = payload?.trip;
  const stops = payload?.stops ?? [];

  const onRefresh = () => {
    setRefreshing(true);
    loadTrip(true);
  };

  const markReached = async (stopId: string) => {
    if (!trip?.id || submitting) return;
    setSubmitting(true);
    const prev = payload;
    if (prev) {
      setPayload({
        ...prev,
        stops: prev.stops.map((s) =>
          s.stop_id === stopId
            ? { ...s, status: 'reached', reached_at: new Date().toISOString() }
            : s,
        ),
      });
    }
    try {
      const fix = await calibrationFixBody();
      await api.post(`/transport/driver/trip/${trip.id}/stop/${stopId}/reach`, {
        ...fix,
        source: 'manual',
      });
      alertCompat('Updated', 'Stop marked — notifications sent');
    } catch (e: any) {
      if (prev) setPayload(prev);
      alertCompat('Error', e?.message || 'Could not mark stop');
    } finally {
      setSubmitting(false);
    }
  };

  const startTrip = async () => {
    if (!trip?.id || submitting) return;
    setSubmitting(true);
    try {
      // Natural moment to ask for GPS: fixes captured on "Mark reached" feed
      // route calibration (Phase A). Non-blocking; trip starts either way.
      if (Platform.OS !== 'web') {
        Location.requestForegroundPermissionsAsync().catch(() => {});
      }
      await api.post(`/transport/driver/trip/${trip.id}/start`, {});
      await loadTrip(true);
    } catch (e: any) {
      alertCompat('Error', e?.message || 'Could not start trip');
    } finally {
      setSubmitting(false);
    }
  };

  const completeTrip = async () => {
    if (!trip?.id || submitting) return;
    setSubmitting(true);
    setConfirmComplete(false);
    try {
      await api.post(`/transport/driver/trip/${trip.id}/complete`, {});
      await loadTrip(true);
    } catch (e: any) {
      alertCompat('Error', e?.message || 'Could not complete trip');
    } finally {
      setSubmitting(false);
    }
  };

  const statusBanner = () => {
    const s = trip?.status || 'scheduled';
    const label =
      s === 'completed'
        ? 'Completed'
        : tripStatusIsActive(s)
          ? 'In Progress'
          : 'Not Started';
    const bg =
      s === 'completed'
        ? theme.colors.borderLight
        : tripStatusIsActive(s)
          ? theme.colors.primary + '18'
          : theme.colors.borderLight;
    const fg =
      s === 'completed'
        ? theme.colors.textSecondary
        : tripStatusIsActive(s)
          ? theme.colors.primaryDark
          : theme.colors.textMuted;
    const icon =
      s === 'completed' ? 'checkmark-circle' : tripStatusIsActive(s) ? 'radio-button-on' : 'time-outline';
    return (
      <View style={[styles.banner, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={18} color={fg} />
        <Text style={[styles.bannerText, { color: fg }]}>{label}</Text>
      </View>
    );
  };

  if (loading && !payload) {
    return (
      <ScreenLayout>
        <StudentHeader title="My Trip" menuUserType="driver" showBackButton={false} />
        <View style={styles.center}>
          <LogoLoader size={56} color={theme.colors.primary} />
        </View>
      </ScreenLayout>
    );
  }

  if (noRoute) {
    return (
      <ScreenLayout>
        <StatusBar barStyle="dark-content" />
        <StudentHeader title="My Trip" menuUserType="driver" showBackButton={false} />
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bus-outline" size={40} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No route assigned</Text>
          <Text style={styles.emptySub}>Contact your school admin to get a route.</Text>
          <TouchableOpacity style={styles.retry} onPress={() => loadTrip()} activeOpacity={0.85}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <StatusBar barStyle="dark-content" />
      <StudentHeader
        menuUserType="driver"
        showBackButton={false}
        title={
          trip?.date && trip?.route_name
            ? `${trip.route_name} · ${trip.date}`
            : trip?.route_name || 'My Trip'
        }
      />
      {statusBanner()}
      <View style={styles.actions}>
        {trip?.status === 'scheduled' && (
          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.btnDisabled]}
            onPress={startTrip}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Start Trip</Text>
          </TouchableOpacity>
        )}
        {tripStatusIsActive(trip?.status) && (
          <TouchableOpacity
            style={[styles.secondaryBtn, submitting && styles.btnDisabled]}
            onPress={() => setConfirmComplete(true)}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Ionicons name="flag" size={18} color={theme.colors.primary} />
            <Text style={styles.secondaryBtnText}>Complete Trip</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={stops}
        keyExtractor={(item) => item.stop_id}
        contentContainerStyle={styles.listPad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const done = item.status === 'reached' || item.status === 'completed';
          return (
            <View style={[styles.card, done && styles.cardDone]}>
              <View style={styles.cardLeft}>
                <View style={[styles.stopIcon, done && styles.stopIconDone]}>
                  <Ionicons
                    name={done ? 'checkmark' : 'ellipse-outline'}
                    size={18}
                    color={done ? '#FFF' : theme.colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopName}>{item.stop_name}</Text>
                  <Text style={styles.meta}>
                    {item.assigned_students ?? 0} student(s)
                    {item.reached_at
                      ? ` · ${new Date(item.reached_at).toLocaleTimeString()}`
                      : ''}
                  </Text>
                </View>
              </View>
              {tripStatusIsActive(trip?.status) && !done && (
                <TouchableOpacity
                  style={styles.markBtn}
                  onPress={() => markReached(item.stop_id)}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  <Text style={styles.markBtnText}>Mark reached</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptySub}>No stops on this route.</Text>}
        ListFooterComponent={<View style={{ height: 110 }} />}
      />

      <Modal transparent visible={confirmComplete} animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setConfirmComplete(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Complete this trip?</Text>
            <Text style={styles.modalSub}>This will end tracking and notify parents if configured.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setConfirmComplete(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOk} onPress={completeTrip}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenLayout>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: theme.colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  banner: {
    marginHorizontal: 16, marginTop: 12, paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  bannerText: { fontWeight: '800', textAlign: 'center', fontSize: 15 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginVertical: 14 },
  listPad: { paddingBottom: 8 },
  primaryBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: theme.colors.primary + '44',
  },
  secondaryBtnText: { color: theme.colors.primary, fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  cardDone: { opacity: 0.72 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  stopIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: theme.colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  stopIconDone: { backgroundColor: theme.colors.success },
  stopName: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textMuted, marginTop: 3, fontWeight: '500' },
  markBtn: {
    backgroundColor: theme.colors.primary + '14',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  markBtnText: { color: theme.colors.primary, fontWeight: '800', fontSize: 13 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 16, color: theme.colors.textPrimary, letterSpacing: -0.3 },
  emptySub: { fontSize: 15, color: theme.colors.textMuted, marginTop: 8, textAlign: 'center', fontWeight: '500' },
  retry: {
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    minHeight: 48,
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 22,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, color: theme.colors.textPrimary },
  modalSub: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 18, lineHeight: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalCancel: { padding: 14, paddingHorizontal: 18 },
  modalCancelText: { fontWeight: '700', color: theme.colors.textSecondary },
  modalOk: { backgroundColor: theme.colors.primary, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14, minHeight: 48, justifyContent: 'center' },
});
