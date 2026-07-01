import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  Linking,
  Dimensions,
  Platform,
} from 'react-native';
import AppTextInput from '../../src/components/AppTextInput';
import { styles as ds } from '../../src/theme/styles';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolate,
  withSequence,
  withRepeat,
  ZoomIn,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import AdminHeader from '../../src/components/AdminHeader';
import { StaffService } from '../../src/services/staffService';
import { useTheme } from '../../src/hooks/useTheme';
import LogoLoader from '../../src/components/LogoLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  designation: string;
  status: string;
  photo_url: string | null;
  phone: string;
}

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  gradient: [string, string];
  dot: string;
  darkText: string;
  lightText: string;
  darkBg: string;
  lightBg: string;
}> = {
  Present: {
    gradient: ['#00C48C', '#00875A'],
    dot: '#00C48C',
    darkText: '#00C48C',
    lightText: '#00734F',
    darkBg: 'rgba(0,196,140,0.15)',
    lightBg: 'rgba(0,115,79,0.10)',
  },
  Leave: {
    gradient: ['#FFB800', '#E67E00'],
    dot: '#FFB800',
    darkText: '#FFB800',
    lightText: '#A85A00',
    darkBg: 'rgba(255,184,0,0.15)',
    lightBg: 'rgba(168,90,0,0.10)',
  },
  Absent: {
    gradient: ['#FF4D6A', '#C0203B'],
    dot: '#FF4D6A',
    darkText: '#FF4D6A',
    lightText: '#B0102E',
    darkBg: 'rgba(255,77,106,0.15)',
    lightBg: 'rgba(176,16,46,0.10)',
  },
};

// ─── Pulsing Status Dot ───────────────────────────────────────────────────────
function PulsingDot({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.7, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1, false
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0, { duration: 900 }), withTiming(0.6, { duration: 900 })),
      -1, false
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ width: 10, height: 10, marginRight: 6, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: color }, ringStyle]}
      />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

// ─── Staff Card ───────────────────────────────────────────────────────────────
function StaffCard({
  item, index, isDark, cardBg, cardBorder, avatarBg, onCall, onDelete, onOpenPortal,
}: {
  item: StaffMember;
  index: number;
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  avatarBg: string;
  onCall: () => void;
  onDelete: () => void;
  onOpenPortal: () => void;
}) {
  const pressScale = useSharedValue(1);
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.Absent;
  const pillBg = isDark ? cfg.darkBg : cfg.lightBg;
  const statusClr = isDark ? cfg.darkText : cfg.lightText;

  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(500).springify()}
      style={cardAnim}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={() => { pressScale.value = withSpring(0.975, { damping: 18 }); }}
        onPressOut={() => { pressScale.value = withSpring(1, { damping: 18 }); }}
        onPress={onOpenPortal}
        style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
      >
        {isDark && <View style={styles.cardShimmer} />}

        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          <LinearGradient
            colors={cfg.gradient}
            style={styles.avatarRing}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Image
              source={{ uri: item.photo_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }}
              style={[
                styles.avatar,
                { backgroundColor: avatarBg, borderColor: isDark ? '#0C0D14' : '#FFFFFF' },
              ]}
            />
          </LinearGradient>
          <View style={[styles.onlineRing, { backgroundColor: isDark ? '#0C0D14' : '#F3F4F8' }]}>
            <View style={[styles.onlineDot, { backgroundColor: cfg.dot }]} />
          </View>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text
            style={[styles.name, { color: isDark ? '#FFFFFF' : '#111827' }]}
            numberOfLines={1}
          >
            {item.display_name}
          </Text>
          <Text
            style={[styles.role, { color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.45)' }]}
            numberOfLines={1}
          >
            {item.designation}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: pillBg }]}>
            <PulsingDot color={cfg.dot} />
            <Text style={[styles.statusText, { color: statusClr }]}>{item.status}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={onCall} style={styles.actionBtn} activeOpacity={0.8}>
            <LinearGradient
              colors={['#7C6FFF', '#5A4FE0']}
              style={styles.actionGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="call" size={15} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDelete} style={styles.actionBtn} activeOpacity={0.8}>
            <LinearGradient
              colors={['#FF4D6A', '#C0203B']}
              style={styles.actionGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="trash" size={15} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ staffList, isDark }: { staffList: StaffMember[]; isDark: boolean }) {
  const present = staffList.filter((s) => s.status === 'Present').length;
  const absent = staffList.filter((s) => s.status === 'Absent').length;
  const leave = staffList.filter((s) => s.status === 'Leave').length;

  const barBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const barBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const labelColor = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.40)';
  const divColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)';

  const chips = [
    { label: 'Total', value: staffList.length, color: '#7C6FFF' },
    { label: 'Present', value: present, color: '#00C48C' },
    { label: 'On Leave', value: leave, color: '#FFB800' },
    { label: 'Absent', value: absent, color: '#FF4D6A' },
  ];

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(500)}
      style={[styles.statsBar, { backgroundColor: barBg, borderColor: barBorder }]}
    >
      {chips.map((c, i) => (
        <React.Fragment key={c.label}>
          <View style={styles.statChip}>
            <Text style={[styles.statValue, { color: c.color }]}>{c.value}</Text>
            <Text style={[styles.statLabel, { color: labelColor }]}>{c.label}</Text>
          </View>
          {i < chips.length - 1 && (
            <View style={[styles.statsDivider, { backgroundColor: divColor }]} />
          )}
        </React.Fragment>
      ))}
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ManageStaff() {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const searchFocus = useSharedValue(0);

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const pageBg = isDark ? '#0C0D14' : '#F3F4F8';
  const cardBg = isDark ? 'rgba(255,255,255,0.045)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const avatarBg = isDark ? '#1E1F2B' : '#E5E7EB';
  const searchBg = isDark
    ? ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.04)'] as [string, string]
    : ['#FFFFFF', '#FFFFFF'] as [string, string];
  const searchBorder = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.10)';
  const searchTextColor = isDark ? '#FFFFFF' : '#111827';
  const placeholderClr = isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.32)';
  const iconColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.32)';
  const countColor = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.40)';
  const sectionColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const loadingColor = isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.35)';
  const emptyTitleColor = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.52)';
  const emptySubColor = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.30)';
  const orb1Color = isDark ? 'rgba(124,111,255,0.08)' : 'rgba(124,111,255,0.06)';
  const orb2Color = isDark ? 'rgba(0,196,140,0.05)' : 'rgba(0,196,140,0.06)';

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await StaffService.getAll();
      const mapped: StaffMember[] = data.map((item) => ({
        id: item.id,
        first_name: item.first_name || '',
        last_name: item.last_name || '',
        display_name: item.display_name || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
        designation: item.designation_name || item.designation || 'Staff',
        status: item.status_name || item.status || 'Present',
        photo_url: item.photo_url || null,
        phone: item.phone || '',
      }));
      setStaffList(mapped);
    } catch {
      alertCompat('Error', 'Failed to load staff list');
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = staffList.filter(
    (s) =>
      (s.display_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (s.designation?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCall = async (phone: string, name: string) => {
    if (!phone || phone.trim() === '') {
      alertCompat('No Number', `${name} has no phone number on record.`);
      return;
    }
    const clean = phone.replace(/[\s\-\(\)]/g, '');
    const url = `tel:${clean}`;
    const can = await Linking.canOpenURL(url).catch(() => false);
    if (!can) {
      alertCompat('Cannot Call', 'Your device does not support phone calls.');
      return;
    }
    Linking.openURL(url).catch(() =>
      alertCompat('Error', `Unable to place a call to ${name}.`)
    );
  };

  const handleDelete = async (id: string, name: string) => {
    alertCompat(
      'Remove Staff Member',
      `Permanently remove "${name}" from the system?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await StaffService.delete(id);
              alertCompat('Done', 'Staff member removed successfully.');
              fetchStaff();
            } catch (err: any) {
              alertCompat('Error', err.message || 'Failed to delete staff');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ── Animated search glow ──────────────────────────────────────────────────
  const searchBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(124,111,255,${interpolate(
      searchFocus.value, [0, 1],
      [isDark ? 0.09 : 0.10, isDark ? 0.75 : 0.55],
      Extrapolate.CLAMP
    )})`,
    shadowOpacity: interpolate(
      searchFocus.value, [0, 1],
      [0, isDark ? 0.35 : 0.18],
      Extrapolate.CLAMP
    ),
  }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Ambient orbs */}
      <View style={[styles.orb1, { backgroundColor: orb1Color }]} />
      <View style={[styles.orb2, { backgroundColor: orb2Color }]} />

      {/* Header — AdminHeader uses its own theme context internally */}
      <AdminHeader title="Manage Staff" showBackButton />

      {/* Section label + stats */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <View style={styles.sectionLabelRow}>
          <LinearGradient
            colors={['#7C6FFF', '#5A4FE0']}
            style={styles.sectionAccent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={[styles.sectionLabel, { color: sectionColor }]}>STAFF DIRECTORY</Text>
        </View>
        {!loading && <StatsBar staffList={staffList} isDark={isDark} />}
      </Animated.View>

      {/* Search */}
      <Animated.View
        entering={FadeInDown.delay(150).duration(400)}
        style={[
          styles.searchWrapper,
          searchBorderStyle,
          { shadowColor: '#7C6FFF', borderColor: searchBorder },
        ]}
      >
        <LinearGradient
          colors={searchBg}
          style={styles.searchGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <Ionicons name="search" size={18} color={iconColor} style={{ marginRight: 10 }} />
          <AppTextInput
            style={[ds.inputInChrome, styles.searchInput, { color: searchTextColor }]}
            placeholder="Search by name or role…"
            placeholderTextColor={placeholderClr}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => { searchFocus.value = withTiming(1, { duration: 250 }); }}
            onBlur={() => { searchFocus.value = withTiming(0, { duration: 250 }); }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={iconColor} />
            </TouchableOpacity>
          )}
        </LinearGradient>
      </Animated.View>

      {/* Count */}
      {!loading && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.countRow}>
          <Text style={[styles.countText, { color: countColor }]}>
            {filteredStaff.length} {filteredStaff.length === 1 ? 'member' : 'members'}
          </Text>
          {searchQuery.length > 0 && (
            <Text style={styles.countSub}> matching "{searchQuery}"</Text>
          )}
        </Animated.View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <LogoLoader size={60} color="#7C6FFF" />
          <Text style={[styles.loadingText, { color: loadingColor }]}>Loading staff…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStaff}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <StaffCard
              item={item}
              index={index}
              isDark={isDark}
              cardBg={cardBg}
              cardBorder={cardBorder}
              avatarBg={avatarBg}
              onCall={() => handleCall(item.phone, item.display_name)}
              onDelete={() => handleDelete(item.id, item.display_name)}
              onOpenPortal={() =>
                router.push({
                  pathname: '/staff/dashboard',
                  params: { staffId: item.id, viewAsName: item.display_name },
                } as any)
              }
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Animated.View entering={ZoomIn.duration(400)} style={styles.emptyContainer}>
              <LinearGradient
                colors={['rgba(124,111,255,0.15)', 'rgba(124,111,255,0.05)']}
                style={[styles.emptyIconBg, { borderColor: 'rgba(124,111,255,0.2)' }]}
              >
                <Ionicons name="people-outline" size={40} color="rgba(124,111,255,0.6)" />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { color: emptyTitleColor }]}>No Members Found</Text>
              <Text style={[styles.emptySubtitle, { color: emptySubColor }]}>
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : 'Your staff directory is empty'}
              </Text>
            </Animated.View>
          }
          refreshing={loading}
          onRefresh={fetchStaff}
        />
      )}
    </View>
  );
}

// ─── Static Styles (colours are injected inline / via props — none hardcoded here) ──
const styles = StyleSheet.create({
  container: { flex: 1 },

  orb1: { position: 'absolute', width: 280, height: 280, borderRadius: 140, top: -70, right: -90 },
  orb2: { position: 'absolute', width: 180, height: 180, borderRadius: 90, bottom: 120, left: -60 },

  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, marginTop: 6, marginBottom: 14,
  },
  sectionAccent: { width: 3, height: 13, borderRadius: 2, marginRight: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 2.4 },

  statsBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 16,
    borderRadius: 14, borderWidth: 1,
    paddingVertical: 12, paddingHorizontal: 8,
  },
  statChip: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 1, letterSpacing: 0.5 },
  statsDivider: { width: 1, height: 28 },

  searchWrapper: {
    marginHorizontal: 20, marginBottom: 10,
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, elevation: 6,
  },
  searchGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 50 },
  searchInput: {
    flex: 1, fontSize: 15, fontWeight: '500',
    ...Platform.select({
      web: { outlineWidth: 0, outlineStyle: 'none' } as any,
      default: {},
    }),
  },

  countRow: { flexDirection: 'row', paddingHorizontal: 22, marginBottom: 12 },
  countText: { fontSize: 12, fontWeight: '600' },
  countSub: { fontSize: 12, fontWeight: '600', color: '#7C6FFF' },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, padding: 14, marginBottom: 10,
    borderWidth: 1, overflow: 'hidden',
  },
  cardShimmer: {
    position: 'absolute', top: 0, left: 24, right: 24, height: 1,
    backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 1,
  },

  avatarWrapper: { position: 'relative', marginRight: 14 },
  avatarRing: {
    width: 56, height: 56, borderRadius: 28, padding: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2 },
  onlineRing: {
    position: 'absolute', bottom: 1, right: 1,
    width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5 },

  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 2 },
  role: { fontSize: 12, fontWeight: '500', marginBottom: 7, letterSpacing: 0.2 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  actions: { flexDirection: 'column', gap: 8, marginLeft: 10 },
  actionBtn: { borderRadius: 12, overflow: 'hidden', shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 4 },
  actionGrad: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 14, fontWeight: '500', letterSpacing: 0.5 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyIconBg: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4, borderWidth: 1,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  emptySubtitle: { fontSize: 13, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 },
});