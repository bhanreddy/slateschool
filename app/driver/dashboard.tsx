import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, RefreshControl } from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import * as Location from 'expo-location';
import { useAuth } from '../../src/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing
} from
  'react-native-reanimated';
import * as Haptics from '@/src/utils/haptics';
import { api } from '../../src/services/apiClient';
import { usePersistedSWR } from '../../src/hooks/usePersistedSWR';
import LogoLoader from '../../src/components/LogoLoader';
import DashboardHero from '../../src/components/DashboardHero';

const PINK = '#EC4899';
const PINK_DARK = '#BE185D';
const PINK_GRADIENT: [string, string] = ['#EC4899', '#BE185D'];
const GREEN = '#10B981';
const RED = '#EF4444';
const HEARTBEAT_INTERVAL = 30000;

type StopStatus = 'pending' | 'arrived' | 'completed' | 'skipped';

interface TripStop {
  id: string;
  stop_id: string;
  stop_name: string;
  stop_order: number;
  status: StopStatus;
  latitude?: number;
  longitude?: number;
  student_count: number;
  arrival_time?: string;
  departure_time?: string;
}

interface BusInfo {
  id: string;
  bus_no: string;
  capacity: number;
}

interface RouteInfo {
  id: string;
  name: string;
  direction: string;
  total_stops: number;
  bus_id?: string;
}

type TripLeg = 'morning' | 'evening';

const LEG_LABEL: Record<TripLeg, string> = {
  morning: 'Morning (pickup)',
  evening: 'Evening (drop-off)',
};

/* ─── Status Colors ─── */
const STATUS_CONFIG: Record<StopStatus, { bg: string; color: string; icon: string; label: string; }> = {
  pending: { bg: '#F1F5F9', color: '#94A3B8', icon: 'ellipse-outline', label: 'Pending' },
  arrived: { bg: '#FEF3C7', color: '#D97706', icon: 'location', label: 'At Stop' },
  completed: { bg: '#DCFCE7', color: '#059669', icon: 'checkmark-circle', label: 'Done' },
  skipped: { bg: '#FEE2E2', color: '#DC2626', icon: 'close-circle', label: 'Skipped' }
};

/* ════════════════════════════════════════════════════════════
   ████  DRIVER DASHBOARD  ████
   ════════════════════════════════════════════════════════════ */
export default function DriverDashboard() {
  const { user } = useAuth();

  // Data state
  const [buses, setBuses] = useState<BusInfo[]>([]);
  const [selectedBus, setSelectedBus] = useState<BusInfo | null>(null);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteInfo | null>(null);
  const [tripLeg, setTripLeg] = useState<TripLeg>('morning');
  const [stops, setStops] = useState<TripStop[]>([]);

  // Trip state
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [tripStartedAt, setTripStartedAt] = useState<Date | null>(null);
  const [elapsedMin, setElapsedMin] = useState(0);

  // UI state
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [speed, setSpeed] = useState(0);

  const {
    data: driverBusData,
    loading: busDataLoading,
    isRefreshing: busDataRefreshing,
    refetch: refetchBusData,
  } = usePersistedSWR<any>({
    cacheKey: 'driver-my-bus',
    userId: user?.userId,
    ttlMs: 30_000,
    persist: true,
    revalidateOnMount: true,
    enabled: !!user?.userId,
    fetcher: () => api.get<any>('/transport/driver/my-bus'),
  });

  const loading = busDataLoading && !driverBusData;
  const tripControlsEnabled = !busDataRefreshing;

  // Refs
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const displayName = user?.display_name || user?.first_name || 'Driver';
  const greeting = new Date().getHours() < 12 ? 'Good Morning' :
    new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  // Pulse animation
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (isTracking) {
      pulse.value = withRepeat(
        withTiming(1.25, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1, true
      );
    } else { pulse.value = withTiming(1, { duration: 200 }); }
  }, [isTracking]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const inferTripLeg = (direction?: string | null): TripLeg => {
    if (direction === 'afternoon' || direction === 'evening') return 'evening';
    if (direction === 'morning') return 'morning';
    return new Date().getHours() >= 12 ? 'evening' : 'morning';
  };

  const resolveTripDirectionParam = (route: RouteInfo | null, leg: TripLeg) => {
    if (!route) return leg === 'evening' ? 'evening' : 'morning';
    if (route.direction === 'both') return leg === 'evening' ? 'evening' : 'morning';
    if (route.direction === 'afternoon' || route.direction === 'evening') return route.direction;
    return route.direction || 'morning';
  };

  const routesForSelectedBus = selectedBus
    ? routes.filter((r) => r.bus_id === selectedBus.id)
    : routes;

  /* ─── Apply driver's buses & routes from API payload ─── */
  const applyDriverPayload = useCallback(async (data: any) => {
    const busList: BusInfo[] = data.buses?.length ? data.buses : (data.bus ? [data.bus] : []);
    const routeList: RouteInfo[] = data.routes || [];
    setBuses(busList);
    setRoutes(routeList);

    const activeTrips: any[] = data.activeTrips?.length
      ? data.activeTrips
      : (data.activeTrip ? [data.activeTrip] : []);

    if (activeTrips.length > 0) {
      const active = activeTrips[0];
      const activeBus = busList.find((b) => b.id === active.bus_id) || busList[0] || null;
      setSelectedBus(activeBus);
      const activeRoute = routeList.find((r) => r.id === active.route_id) || null;
      if (activeRoute) {
        setSelectedRoute(activeRoute);
        setTripLeg(active.trip_direction === 'evening' || active.trip_direction === 'afternoon' ? 'evening' : 'morning');
      }
      setActiveTripId(active.id);
      setIsTracking(true);
      setTripStartedAt(new Date(active.started_at));
      await fetchTripStatus(active.id);
    } else if (busList.length > 0) {
      const initialBus = busList[0];
      setSelectedBus(initialBus);
      const busRoutes = routeList.filter((r) => r.bus_id === initialBus.id);
      if (busRoutes.length > 0) {
        setSelectedRoute(busRoutes[0]);
        const leg = inferTripLeg(busRoutes[0].direction);
        setTripLeg(leg);
        await fetchRouteStops(busRoutes[0].id, leg);
      }
    }
  }, []);

  useEffect(() => {
    if (!driverBusData) return;
    void applyDriverPayload(driverBusData);
  }, [driverBusData, applyDriverPayload]);

  const refreshDriverData = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchBusData();
    } finally {
      setRefreshing(false);
    }
  }, [refetchBusData]);

  /* ─── Fetch route stops (pre-trip) ─── */
  const fetchRouteStops = async (routeId: string, leg: TripLeg = tripLeg) => {
    try {
      const route = routes.find((r) => r.id === routeId) || selectedRoute;
      const tripDirection = resolveTripDirectionParam(route, leg);
      const data = await api.get<any[]>(`/transport/driver/route/${routeId}/stops?trip_direction=${tripDirection}`);
      setStops(data.map((s, idx) => ({
        id: '', stop_id: s.id, stop_name: s.name,
        stop_order: s.exec_order ?? idx + 1,
        status: 'pending' as StopStatus, latitude: s.latitude, longitude: s.longitude,
        student_count: s.student_count || 0
      })));
    } catch (err) { }
  };

  /* ─── Fetch trip status (during trip) ─── */
  const fetchTripStatus = async (tripId: string) => {
    try {
      const data = await api.get<any>(`/transport/trips/${tripId}/status`);
      setStops(data.stops.map((s: any) => ({
        id: s.id, stop_id: s.stop_id, stop_name: s.stop_name,
        stop_order: s.stop_order, status: s.status,
        latitude: s.latitude, longitude: s.longitude,
        student_count: Number(s.student_count) || 0,
        arrival_time: s.arrival_time, departure_time: s.departure_time
      })));
    } catch (err) { }
  };

  /* ─── Timer for elapsed time ─── */
  useEffect(() => {
    if (isTracking && tripStartedAt) {
      timerRef.current = setInterval(() => {
        setElapsedMin(Math.floor((Date.now() - tripStartedAt.getTime()) / 60000));
      }, 10000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTracking, tripStartedAt]);

  /* ─── START TRIP ─── */
  const handleStartTrip = async () => {
    if (!selectedBus || !selectedRoute) return alertCompat('Error', 'Select a bus and route first.');
    if (selectedRoute.direction === 'both' && !tripLeg) {
      return alertCompat('Error', 'Choose Morning or Evening for this route.');
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setActionLoading(true);
    try {
      const tripDirection = resolveTripDirectionParam(selectedRoute, tripLeg);
      const data = await api.post<any>('/transport/trips/start', {
        route_id: selectedRoute.id,
        bus_id: selectedBus.id,
        trip_direction: tripDirection,
      });
      setActiveTripId(data.trip.id);
      setIsTracking(true);
      setTripStartedAt(new Date());
      setElapsedMin(0);
      await fetchTripStatus(data.trip.id);
      startLocationTracking(selectedBus.id);
    } catch (err: any) {
      alertCompat('Error', err?.message || 'Failed to start trip');
    } finally { setActionLoading(false); }
  };

  /* ─── END TRIP ─── */
  const handleEndTrip = async () => {
    alertCompat('End Trip', 'Are you sure you want to end this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Trip', style: 'destructive', onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setActionLoading(true);
          try {
            await api.post<any>(`/transport/trips/${activeTripId}/end`);
            setIsTracking(false);
            setActiveTripId(null);
            stopLocationTracking();
            await refreshDriverData();
          } catch (err: any) {
            alertCompat('Error', err?.message || 'Failed to end trip');
          } finally { setActionLoading(false); }
        }
      }]
    );
  };

  /* ─── ARRIVE AT STOP ─── */
  const handleArriveStop = async (stopId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionLoading(true);
    try {
      await api.post<any>(`/transport/trips/${activeTripId}/stops/${stopId}/arrive`);
      await fetchTripStatus(activeTripId!);
    } catch (err: any) {
      alertCompat('Cannot Arrive', err?.message || 'Failed');
    } finally { setActionLoading(false); }
  };

  /* ─── COMPLETE STOP ─── */
  const handleCompleteStop = async (stopId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionLoading(true);
    try {
      await api.post<any>(`/transport/trips/${activeTripId}/stops/${stopId}/complete`);
      await fetchTripStatus(activeTripId!);
    } catch (err: any) {
      alertCompat('Cannot Complete', err?.message || 'Failed');
    } finally { setActionLoading(false); }
  };

  /* ─── SKIP STOP ─── */
  const handleSkipStop = async (stopId: string) => {
    alertCompat('Skip Stop', 'Are you sure you want to skip this stop?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Skip', style: 'destructive', onPress: async () => {
          Haptics.selectionAsync();
          setActionLoading(true);
          try {
            await api.post<any>(`/transport/trips/${activeTripId}/stops/${stopId}/skip`);
            await fetchTripStatus(activeTripId!);
          } catch (err: any) { alertCompat('Cannot Skip', err?.message || 'Failed'); } finally { setActionLoading(false); }
        }
      }]
    );
  };

  /* ─── GPS Tracking ─── */
  const startLocationTracking = async (busId: string) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return alertCompat('Permission Denied', 'GPS permission required.');

    locationSubRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 15 },
      async (loc) => {
        const spd = loc.coords.speed && loc.coords.speed > 0 ? loc.coords.speed * 3.6 : 0;
        setSpeed(spd);
        try {
          await api.post<any>(`/transport/buses/${busId}/location`, {
            latitude: loc.coords.latitude, longitude: loc.coords.longitude,
            speed: spd, heading: loc.coords.heading,
            is_mocked: loc.mocked || false
          });
        } catch { }
      }
    );

    heartbeatRef.current = setInterval(async () => {
      try { await api.post(`/transport/buses/${busId}/heartbeat`); } catch { }
    }, HEARTBEAT_INTERVAL);
  };

  const stopLocationTracking = () => {
    if (locationSubRef.current) { locationSubRef.current.remove(); locationSubRef.current = null; }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
  };

  useEffect(() => () => { stopLocationTracking(); if (timerRef.current) clearInterval(timerRef.current); }, []);

  /* ─── Derived state ─── */
  const currentStop = stops.find((s) => s.status === 'pending' || s.status === 'arrived');
  const completedCount = stops.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
  const progressPercent = stops.length > 0 ? completedCount / stops.length * 100 : 0;

  /* ─── Loading ─── */
  if (loading) {
    return (
      <ScreenLayout>
        <StudentHeader title="Dashboard" menuUserType="driver" />
        <View style={s.center}><LogoLoader size={60} color={PINK} /></View>
      </ScreenLayout>);

  }

  return (
    <ScreenLayout>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />
      <StudentHeader title="Dashboard" menuUserType="driver" />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshDriverData} tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" />}>

        {refreshing &&
          <View style={{ width: '100%', alignItems: 'center', paddingVertical: 20 }}>
            <LogoLoader size={30} />
          </View>
        }
        {/* ═══════ Greeting panel ═══════ */}
        <View style={{ marginBottom: 16 }}>
          <DashboardHero
            eyebrow={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
            greeting={greeting}
            name={displayName}
            stacks
          />
        </View>

        {/* ═══════ Trip Tracking Card ═══════ */}
        <Animated.View entering={FadeInDown.delay(80).duration(500)} style={s.heroWrap}>
          <LinearGradient colors={PINK_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <View style={[s.heroDecor, { top: -30, right: -30, width: 120, height: 120 }]} />
            <View style={[s.heroDecor, { bottom: -15, left: -15, width: 60, height: 60 }]} />
            <View style={s.heroTop}>
              <View>
                <Text style={s.heroGreet}>On duty</Text>
                <Text style={s.heroName}>Today's Trip</Text>
              </View>
              <View style={s.heroBusPill}>
                <Ionicons name="bus" size={14} color="#FFF" />
                <Text style={s.heroBusText}>{selectedBus?.bus_no || buses[0]?.bus_no || 'No Bus'}</Text>
              </View>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroBottom}>
              <View style={s.heroMini}>
                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={s.heroMiniText}>{isTracking ? `${elapsedMin} min` : 'Ready'}</Text>
              </View>
              <View style={s.heroMini}>
                <Ionicons name="speedometer-outline" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={s.heroMiniText}>{isTracking ? `${speed.toFixed(0)} km/h` : '—'}</Text>
              </View>
              <View style={[s.statusPill, { backgroundColor: isTracking ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.15)' }]}>
                <Animated.View style={[s.statusDot, { backgroundColor: isTracking ? GREEN : '#FCD34D' }, isTracking && pulseStyle]} />
                <Text style={s.statusPillText}>{isTracking ? 'ON TRIP' : 'IDLE'}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
        {/* ═══════ No Bus State ═══════ */}
        {!selectedBus && buses.length === 0 &&
          <Animated.View entering={FadeInDown.delay(150).duration(500)} style={s.emptyCard}>
            <View style={s.emptyIcon}><Ionicons name="bus-outline" size={36} color="#CBD5E1" /></View>
            <Text style={s.emptyTitle}>No Bus Assigned</Text>
            <Text style={s.emptySub}>Contact admin to get a bus assigned to you.</Text>
          </Animated.View>
        }
        {/* ═══════ Bus Selector (multi-bus drivers) ═══════ */}
        {buses.length > 1 && !isTracking &&
          <Animated.View entering={FadeInDown.delay(140).duration(500)}>
            <View style={s.secHeader}>
              <View style={s.secIconBox}><Ionicons name="bus" size={14} color={PINK} /></View>
              <Text style={s.secTitle}>Select Bus</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.routeScroll}>
              {buses.map((b) =>
                <TouchableOpacity
                  key={b.id}
                  style={[s.routeChip, selectedBus?.id === b.id && s.routeChipActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedBus(b);
                    const busRoutes = routes.filter((r) => r.bus_id === b.id);
                    if (busRoutes.length > 0) {
                      setSelectedRoute(busRoutes[0]);
                      setTripLeg(inferTripLeg(busRoutes[0].direction));
                      fetchRouteStops(busRoutes[0].id, inferTripLeg(busRoutes[0].direction));
                    } else {
                      setSelectedRoute(null);
                      setStops([]);
                    }
                  }}>

                  <Ionicons name="bus-outline" size={14}
                    color={selectedBus?.id === b.id ? '#FFF' : PINK} />
                  <Text style={[s.routeChipText, selectedBus?.id === b.id && { color: '#FFF' }]}>
                    {b.bus_no}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Animated.View>
        }
        {/* ═══════ Route Selector (pre-trip) ═══════ */}
        {selectedBus && !isTracking && routesForSelectedBus.length > 0 &&
          <Animated.View entering={FadeInDown.delay(150).duration(500)}>
            <View style={s.secHeader}>
              <View style={s.secIconBox}><Ionicons name="map" size={14} color={PINK} /></View>
              <Text style={s.secTitle}>Select Route</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.routeScroll}>
              {routesForSelectedBus.map((r) =>
                <TouchableOpacity
                  key={r.id}
                  style={[s.routeChip, selectedRoute?.id === r.id && s.routeChipActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedRoute(r);
                    const leg = inferTripLeg(r.direction);
                    setTripLeg(leg);
                    fetchRouteStops(r.id, leg);
                  }}>

                  <Ionicons name="navigate-outline" size={14}
                    color={selectedRoute?.id === r.id ? '#FFF' : PINK} />
                  <Text style={[s.routeChipText, selectedRoute?.id === r.id && { color: '#FFF' }]}>
                    {r.name}
                  </Text>
                  <Text style={[s.routeChipDir, selectedRoute?.id === r.id && { color: 'rgba(255,255,255,0.7)' }]}>
                    {r.direction}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            {selectedRoute?.direction === 'both' &&
              <View style={s.legRow}>
                {(['morning', 'evening'] as TripLeg[]).map((leg) =>
                  <TouchableOpacity
                    key={leg}
                    style={[s.legChip, tripLeg === leg && s.legChipActive]}
                    onPress={() => {
                      setTripLeg(leg);
                      if (selectedRoute) fetchRouteStops(selectedRoute.id, leg);
                    }}>

                    <Text style={[s.legChipText, tripLeg === leg && { color: '#FFF' }]}>
                      {LEG_LABEL[leg]}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          </Animated.View>
        }
        {/* ═══════ Trip Progress Bar ═══════ */}
        {isTracking &&
          <Animated.View entering={FadeInDown.delay(150).duration(500)} style={s.progressCard}>
            <View style={s.progressHeader}>
              <Text style={s.progressTitle}>Trip Progress</Text>
              <Text style={s.progressCount}>{completedCount}/{stops.length} stops</Text>
            </View>
            <View style={s.progressBarBg}>
              <View style={[s.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={s.progressRoute}>
              {selectedRoute?.name} • {isTracking ? resolveTripDirectionParam(selectedRoute, tripLeg) : selectedRoute?.direction}
            </Text>
          </Animated.View>
        }
        {/* ═══════ Stop List ═══════ */}
        {stops.length > 0 &&
          <Animated.View entering={FadeInUp.delay(200).duration(500)}>
            <View style={s.secHeader}>
              <View style={[s.secIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="list" size={14} color={GREEN} />
              </View>
              <Text style={s.secTitle}>{isTracking ? 'Stop Execution' : 'Route Stops'}</Text>
            </View>
            {stops.map((stop, idx) => {
              const cfg = STATUS_CONFIG[stop.status];
              const isCurrent = currentStop?.stop_id === stop.stop_id;
              const isLast = idx === stops.length - 1;

              return (
                <Animated.View
                  key={stop.stop_id}
                  entering={FadeInDown.delay(250 + idx * 60).duration(400)}
                  style={[s.stopCard, isCurrent && s.stopCardCurrent]}>

                  {/* Timeline connector */}
                  <View style={s.timeline}>
                    <View style={[s.timelineDot, { backgroundColor: cfg.color }]}>
                      <Ionicons name={cfg.icon as any} size={12} color="#FFF" />
                    </View>
                    {!isLast && <View style={[s.timelineLine, {
                      backgroundColor: stop.status === 'completed' ? GREEN : '#E2E8F0'
                    }]} />}
                  </View>
                  {/* Stop Info */}
                  <View style={s.stopContent}>
                    <View style={s.stopTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.stopOrder}>Stop {stop.stop_order}</Text>
                        <Text style={s.stopName}>{stop.stop_name}</Text>
                      </View>
                      <View style={[s.stopBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[s.stopBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>
                    {stop.student_count > 0 &&
                      <View style={s.studentRow}>
                        <Ionicons name="people" size={12} color="#94A3B8" />
                        <Text style={s.studentText}>{stop.student_count} student{stop.student_count > 1 ? 's' : ''}</Text>
                      </View>
                    }
                    {/* Action Buttons (only during active trip, only for current stop) */}
                    {isTracking && isCurrent &&
                      <View style={s.stopActions}>
                        {stop.status === 'pending' &&
                          <>
                            <TouchableOpacity
                              style={[s.stopBtn, { backgroundColor: '#FEF3C7' }]}
                              onPress={() => handleArriveStop(stop.stop_id)}
                              disabled={actionLoading || !tripControlsEnabled}>

                              <Ionicons name="location" size={14} color="#D97706" />
                              <Text style={[s.stopBtnText, { color: '#D97706' }]}>Arrive</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[s.stopBtn, { backgroundColor: '#FEE2E2' }]}
                              onPress={() => handleSkipStop(stop.stop_id)}
                              disabled={actionLoading || !tripControlsEnabled}>

                              <Ionicons name="close-circle-outline" size={14} color={RED} />
                              <Text style={[s.stopBtnText, { color: RED }]}>Skip</Text>
                            </TouchableOpacity>
                          </>
                        }
                        {stop.status === 'arrived' &&
                          <TouchableOpacity
                            style={[s.stopBtn, { backgroundColor: '#DCFCE7', flex: 1 }]}
                            onPress={() => handleCompleteStop(stop.stop_id)}
                            disabled={actionLoading || !tripControlsEnabled}>

                            <Ionicons name="checkmark-circle" size={14} color="#059669" />
                            <Text style={[s.stopBtnText, { color: '#059669' }]}>Complete Stop</Text>
                          </TouchableOpacity>
                        }
                      </View>
                    }
                  </View>
                </Animated.View>);

            })}
          </Animated.View>
        }
        {/* ═══════ Trip Control ═══════ */}
        {selectedBus &&
          <Animated.View entering={FadeInUp.delay(400).duration(500)} style={s.controlSection}>
            {!isTracking ?
              <TouchableOpacity
                style={s.startWrap}
                onPress={handleStartTrip}
                activeOpacity={0.8}
                disabled={actionLoading || !selectedRoute || !tripControlsEnabled}>

                <LinearGradient colors={PINK_GRADIENT} style={s.startGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {actionLoading ?
                    <LogoLoader color="#FFF" /> :

                    <>
                      <Ionicons name="play" size={22} color="#FFF" />
                      <Text style={s.ctrlText}>START TRIP</Text>
                    </>
                  }
                </LinearGradient>
              </TouchableOpacity> :

              <TouchableOpacity style={s.endBtn} onPress={handleEndTrip} activeOpacity={0.8} disabled={actionLoading || !tripControlsEnabled}>
                {actionLoading ? <LogoLoader color="#FFF" /> :
                  <>
                    <Ionicons name="stop" size={22} color="#FFF" />
                    <Text style={s.ctrlText}>END TRIP</Text>
                  </>
                }
              </TouchableOpacity>
            }
          </Animated.View>
        }
        <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenLayout>);

}

/* ════════════════════════════ STYLES ════════════════════════════ */
const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },

  /* Hero */
  heroWrap: {
    borderRadius: 24, overflow: 'hidden', marginBottom: 20,
    shadowColor: PINK, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 8
  },
  hero: { padding: 22, overflow: 'hidden' },
  heroDecor: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroGreet: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500' },
  heroName: { color: '#FFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  heroBusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12
  },
  heroBusText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 14 },
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroMini: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMiniText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { color: '#FFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  /* Empty */
  emptyCard: {
    alignItems: 'center', paddingVertical: 40, backgroundColor: '#FFF',
    borderRadius: 20, marginBottom: 20,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 1
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#F8FAFC',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  /* Sections */
  secHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  secIconBox: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: '#FDF2F8',
    justifyContent: 'center', alignItems: 'center'
  },
  secTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },

  /* Route selector */
  routeScroll: { marginBottom: 20 },
  routeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FDF2F8', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 14, marginRight: 10, borderWidth: 1.5, borderColor: 'transparent'
  },
  routeChipActive: { backgroundColor: PINK, borderColor: PINK_DARK },
  routeChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  routeChipDir: { fontSize: 11, color: '#94A3B8', fontWeight: '500', textTransform: 'capitalize' },
  legRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  legChip: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  legChipActive: { backgroundColor: PINK, borderColor: PINK_DARK },
  legChipText: { fontSize: 12, fontWeight: '700', color: '#64748B' },

  /* Progress */
  progressCard: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 20,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  progressCount: { fontSize: 13, fontWeight: '600', color: PINK },
  progressBarBg: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', backgroundColor: GREEN, borderRadius: 4 },
  progressRoute: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

  /* Stop Cards */
  stopCard: {
    flexDirection: 'row', marginBottom: 4, padding: 4
  },
  stopCardCurrent: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 8,
    shadowColor: PINK, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: '#FDF2F8'
  },
  timeline: { width: 32, alignItems: 'center', marginRight: 8 },
  timelineDot: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center'
  },
  timelineLine: { width: 2, flex: 1, marginVertical: 2 },
  stopContent: { flex: 1, paddingBottom: 12 },
  stopTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  stopOrder: { fontSize: 10, color: '#94A3B8', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  stopName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  stopBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  stopBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  studentText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  stopActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, gap: 5, flex: 1
  },
  stopBtnText: { fontSize: 13, fontWeight: '600' },

  /* Control */
  controlSection: { marginTop: 8, marginBottom: 8 },
  startWrap: {
    borderRadius: 30, overflow: 'hidden',
    shadowColor: PINK, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6
  },
  startGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, gap: 10, borderRadius: 30
  },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 30, backgroundColor: RED, gap: 10,
    shadowColor: RED, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6
  },
  ctrlText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 1.2 }
});