import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Platform,
  StatusBar, BackHandler, TouchableOpacity, Pressable, ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop, Path, Ellipse } from 'react-native-svg';
import Animated, {
  FadeInDown, FadeInUp, FadeIn, ZoomIn,
  useAnimatedStyle, useSharedValue,
  withSpring, withTiming, withSequence, withRepeat, withDelay,
  useAnimatedScrollHandler, interpolate, Extrapolate,
  runOnJS,
} from 'react-native-reanimated';
import { useAuth } from '@/src/hooks/useAuth';
import { AttendanceService } from '@/src/services/attendanceService';
import { LeaveService } from '@/src/services/commonServices';
import { useTheme } from '@/src/hooks/useTheme';
import StaffHeader from '@/src/components/StaffHeader';
import DashboardHero from '@/src/components/DashboardHero';
import ViewAsBanner from '@/src/components/ViewAsBanner';
import { useEffectiveStaffId } from '@/src/hooks/useEffectiveStaffId';
import { usePersistedSWR } from '@/src/hooks/usePersistedSWR';
import { useStaffPortalConfig } from '@/src/hooks/useStaffPortalConfig';

const { width: SW, height: SH } = Dimensions.get('window');
const MENU_GAP = 16;
const IS_WEB = Platform.OS === 'web';
/** Cap card width on large web viewports so tiles stay scannable */
const MENU_CARD_W = IS_WEB && SW > 640 ? Math.min((SW - 40 - MENU_GAP) / 2, 228) : (SW - 40 - MENU_GAP) / 2;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const D = {
  dark: {
    bg: '#080B14',
    bgCard: 'rgba(255,255,255,0.055)',
    bgCardElevated: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.08)',
    borderHigh: 'rgba(255,255,255,0.14)',
    text1: '#F0F2FF',
    text2: 'rgba(240,242,255,0.55)',
    text3: 'rgba(240,242,255,0.30)',
    shimmer: 'rgba(255,255,255,0.10)',
    orbA: 'rgba(108,99,255,0.14)',
    orbB: 'rgba(0,196,160,0.08)',
    orbC: 'rgba(255,77,106,0.06)',
    menuTextBg: '#0C0F1C',
    menuTextBorder: 'rgba(255,255,255,0.07)',
  },
  light: {
    bg: '#F0F2F8',
    bgCard: '#FFFFFF',
    bgCardElevated: '#FFFFFF',
    border: 'rgba(0,0,0,0.07)',
    borderHigh: 'rgba(0,0,0,0.12)',
    text1: '#0A0E1A',
    text2: 'rgba(10,14,26,0.55)',
    text3: 'rgba(10,14,26,0.32)',
    shimmer: 'rgba(255,255,255,0.80)',
    orbA: 'rgba(108,99,255,0.08)',
    orbB: 'rgba(0,196,160,0.06)',
    orbC: 'rgba(255,77,106,0.04)',
    menuTextBg: '#FFFFFF',
    menuTextBorder: 'rgba(0,0,0,0.06)',
  },
};

const ACCENT = {
  violet: '#6C63FF',
  violetMid: '#8B85FF',
  emerald: '#00C4A0',
  rose: '#FF4D6A',
  amber: '#FFB01A',
  blue: '#3D8EFF',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardMetrics {
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  pendingLeaves: number;
  classId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Late Night';
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};
const getTodayDate = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
const getGreetingEmoji = () => {
  const h = new Date().getHours();
  if (h < 12) return '🌤';
  if (h < 17) return '☀️';
  return '🌙';
};

// ─── Background Orbs ─────────────────────────────────────────────────────────
function BgOrbs({ isDark }: { isDark: boolean }) {
  const t = isDark ? D.dark : D.light;
  const f1 = useSharedValue(0);
  const f2 = useSharedValue(0);
  useEffect(() => {
    f1.value = withRepeat(withSequence(withTiming(1, { duration: 7000 }), withTiming(0, { duration: 7000 })), -1, false);
    f2.value = withDelay(3500, withRepeat(withSequence(withTiming(1, { duration: 6000 }), withTiming(0, { duration: 6000 })), -1, false));
  }, []);
  const a1 = useAnimatedStyle(() => ({ opacity: interpolate(f1.value, [0, 1], [0.6, 1]) }));
  const a2 = useAnimatedStyle(() => ({ opacity: interpolate(f2.value, [0, 1], [0.4, 0.9]) }));
  return (
    <>
      <Animated.View style={[styles.orb, { width: 340, height: 340, top: -100, right: -120, borderRadius: 170, backgroundColor: t.orbA }, a1]} />
      <Animated.View style={[styles.orb, { width: 260, height: 260, top: 200, left: -120, borderRadius: 130, backgroundColor: t.orbB }, a2]} />
      <Animated.View style={[styles.orb, { width: 200, height: 200, bottom: 280, right: -60, borderRadius: 100, backgroundColor: t.orbC }]} />
    </>
  );
}

// ─── Circular Attendance Arc ──────────────────────────────────────────────────
function AttendanceArc({
  pct, present, absent, total, unmarked, isDark,
}: { pct: number; present: number; absent: number; total: number; unmarked: number; isDark: boolean }) {
  const SIZE = 164;
  const STROKE = 13;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const ARC_DEG = 240;
  const START_DEG = 150;
  const arcLen = (ARC_DEG / 360) * CIRC;
  const fillLen = (pct / 100) * arcLen;
  const gapLen = CIRC - arcLen;
  const t = isDark ? D.dark : D.light;
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  return (
    <View style={styles.arcContainer}>
      <Svg width={SIZE} height={SIZE} style={{ overflow: 'visible' }}>
        <Defs>
          <SvgGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={ACCENT.emerald} stopOpacity="1" />
            <Stop offset="60%" stopColor={ACCENT.violet} stopOpacity="1" />
            <Stop offset="100%" stopColor={ACCENT.violetMid} stopOpacity="1" />
          </SvgGradient>
          <SvgGradient id="trackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'} stopOpacity="1" />
            <Stop offset="100%" stopColor={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'} stopOpacity="1" />
          </SvgGradient>
        </Defs>
        <Circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke="url(#trackGrad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${gapLen + STROKE}`}
          strokeDashoffset={-(gapLen / 2 + STROKE / 2)}
          transform={`rotate(${START_DEG}, ${cx}, ${cy})`}
        />
        <Circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${fillLen > 0 ? fillLen : 0.01} ${CIRC}`}
          strokeDashoffset={-(gapLen / 2 + STROKE / 2)}
          transform={`rotate(${START_DEG}, ${cx}, ${cy})`}
        />
      </Svg>
      <View style={styles.arcCenter}>
        <Text style={[styles.arcPct, { color: t.text1 }]}>{pct}<Text style={[styles.arcPctSymbol, { color: t.text2 }]}>%</Text></Text>
        <Text style={[styles.arcLabel, { color: t.text3 }]}>Attendance</Text>
      </View>
    </View>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ value, label, color, isDark }: { value: number | string; label: string; color: string; isDark: boolean }) {
  const t = isDark ? D.dark : D.light;
  return (
    <View style={[styles.statPill, { backgroundColor: `${color}14`, borderColor: `${color}22` }]}>
      <Text style={[styles.statPillVal, { color }]}>{value}</Text>
      <Text style={[styles.statPillLbl, { color: t.text3 }]}>{label}</Text>
    </View>
  );
}

// ─── Attendance Hero Card ─────────────────────────────────────────────────────
function AttendanceHero({ data, onPress, isDark }: { data: DashboardMetrics | null; onPress: () => void; isDark: boolean }) {
  const t = isDark ? D.dark : D.light;
  const total = data?.totalStudents || 0;
  const present = data?.presentToday || 0;
  const absent = data?.absentToday || 0;
  const unmarked = Math.max(0, total - present - absent);
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const pressScale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));
  let statusText = total === 0 ? 'No Class Assigned' : unmarked === 0 ? 'Fully Marked ✓' : `${unmarked} left to mark`;
  let statusColor = total === 0 ? t.text3 : unmarked === 0 ? ACCENT.emerald : ACCENT.amber;

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(550).springify().damping(16)} style={[anim, { marginBottom: 20 }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => { pressScale.value = withSpring(0.975, { damping: 18 }); }}
        onPressOut={() => { pressScale.value = withSpring(1, { damping: 14 }); }}
        onPress={onPress}
      >
        <View style={[styles.heroCard, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          {isDark && <View style={[styles.cardTopGlow, { backgroundColor: `${ACCENT.violet}18` }]} />}
          {isDark && <View style={styles.cardShimmerLine} />}
          <View style={styles.heroCardHeader}>
            <View>
              <Text style={[styles.heroCardTitle, { color: t.text1 }]}>Today's Class</Text>
              <Text style={[styles.heroCardSub, { color: t.text2 }]}>Tap to manage attendance</Text>
            </View>
            <View style={[styles.heroCardChip, { backgroundColor: isDark ? 'rgba(108,99,255,0.18)' : 'rgba(108,99,255,0.10)' }]}>
              <Ionicons name="people" size={12} color={ACCENT.violet} style={{ marginRight: 4 }} />
              <Text style={[styles.heroCardChipText, { color: ACCENT.violet }]}>{total} students</Text>
            </View>
          </View>
          <View style={styles.heroCardBody}>
            <AttendanceArc pct={pct} present={present} absent={absent} total={total} unmarked={unmarked} isDark={isDark} />
            <View style={styles.heroStatCol}>
              <StatPill value={present} label="Present" color={ACCENT.emerald} isDark={isDark} />
              <StatPill value={absent} label="Absent" color={ACCENT.rose} isDark={isDark} />
              <StatPill value={unmarked} label="Pending" color={ACCENT.amber} isDark={isDark} />
            </View>
          </View>
          <View style={[styles.heroCardFooter, { backgroundColor: isDark ? 'rgba(0,0,0,0.20)' : '#F7F9FD', borderTopColor: t.border }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.heroCardFooterText, { color: statusColor }]}>{statusText}</Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.heroCardFooterLink, { color: ACCENT.violet }]}>Manage →</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Hero Banner ──────────────────────────────────────────────────────────────
function HeroBanner({ name }: { name: string; isDark: boolean }) {
  return (
    <View style={{ marginTop: 4, marginBottom: 20 }}>
      <DashboardHero
        eyebrow={`${getGreetingEmoji()}  ${getTodayDate()}`.toUpperCase()}
        greeting={getGreeting()}
        name={name}
        stacks
      />
    </View>
  );
}

// ─── Leave Alert ──────────────────────────────────────────────────────────────
function LeaveAlert({ count, onPress, isDark }: { count: number; onPress: () => void; isDark: boolean }) {
  const t = isDark ? D.dark : D.light;
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 900 }), withTiming(1, { duration: 900 })), -1, false);
  }, []);
  const dotAnim = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <Animated.View entering={FadeInDown.delay(60).duration(420).springify()} style={{ marginBottom: 20 }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <LinearGradient
          colors={isDark ? ['rgba(255,176,26,0.15)', 'rgba(255,176,26,0.07)'] : ['rgba(255,176,26,0.12)', 'rgba(255,176,26,0.05)']}
          style={[styles.leaveAlert, { borderColor: 'rgba(255,176,26,0.25)' }]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        >
          <View style={styles.leaveAlertLeft}>
            <Animated.View style={[styles.leaveAlertDot, dotAnim]} />
            <View style={[styles.leaveAlertIconBox, { backgroundColor: 'rgba(255,176,26,0.20)' }]}>
              <Ionicons name="time" size={15} color={ACCENT.amber} />
            </View>
            <View>
              <Text style={styles.leaveAlertTitle}>{count} Leave {count === 1 ? 'Request' : 'Requests'} Awaiting</Text>
              <Text style={[styles.leaveAlertSub, { color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.42)' }]}>Tap to review & approve</Text>
            </View>
          </View>
          <View style={styles.leaveCountBubble}>
            <Text style={styles.leaveCountText}>{count}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────
function SectionLabel({ label, isDark }: { label: string; isDark: boolean }) {
  const t = isDark ? D.dark : D.light;
  return (
    <View style={styles.sectionLabel}>
      <LinearGradient colors={[ACCENT.violet, ACCENT.emerald]} style={styles.sectionAccent} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <Text style={[styles.sectionLabelText, { color: t.text3 }]}>{label}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ENHANCED MENU CARD SYSTEM ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

interface MenuConfig {
  icon: React.ReactNode;
  grad: readonly [string, string, string];
  accentLight: string;       // Light highlight color for accents
  accentBar: [string, string];
  shadowColor: string;
  category: string;
  shimmerColor: string;
  patternType: 'rings' | 'diagonal' | 'dots' | 'arc';
}

const MENU_CONFIGS: Record<string, MenuConfig> = {
  diary: {
    icon: <FontAwesome5 name="book" size={26} color="#fff" />,
    grad: ['#2D7FFF', '#1254D4', '#0830A0'] as const,
    accentLight: '#90C4FF',
    accentBar: ['#70BAFF', '#2D7FFF'],
    shadowColor: '#1254D4',
    category: 'RECORDS',
    shimmerColor: 'rgba(120,190,255,0.38)',
    patternType: 'diagonal',
  },
  timetable: {
    icon: <Ionicons name="calendar" size={27} color="#fff" />,
    grad: ['#00D4A8', '#00A882', '#006858'] as const,
    accentLight: '#80FFE8',
    accentBar: ['#80FFE8', '#00C4A0'],
    shadowColor: '#00A882',
    category: 'SCHEDULE',
    shimmerColor: 'rgba(100,255,220,0.35)',
    patternType: 'dots',
  },
  attendance: {
    icon: <FontAwesome5 name="fingerprint" size={27} color="#fff" />,
    grad: ['#FF8040', '#E8520A', '#B83600'] as const,
    accentLight: '#FFCC90',
    accentBar: ['#FFCC90', '#FF7428'],
    shadowColor: '#E8520A',
    category: 'TRACKING',
    shimmerColor: 'rgba(255,200,100,0.32)',
    patternType: 'rings',
  },
  leaves: {
    icon: <FontAwesome5 name="calendar-check" size={24} color="#fff" />,
    grad: ['#FF3D5C', '#D41040', '#9E0030'] as const,
    accentLight: '#FFAABC',
    accentBar: ['#FFAABC', '#FF2D52'],
    shadowColor: '#D41040',
    category: 'APPROVALS',
    shimmerColor: 'rgba(255,140,160,0.34)',
    patternType: 'arc',
  },
  results: {
    icon: <MaterialIcons name="assessment" size={30} color="#fff" />,
    grad: ['#FFAA00', '#E08000', '#A85800'] as const,
    accentLight: '#FFE090',
    accentBar: ['#FFE090', '#FFB31A'],
    shadowColor: '#E08000',
    category: 'ACADEMIC',
    shimmerColor: 'rgba(255,225,120,0.38)',
    patternType: 'diagonal',
  },
  complaints: {
    icon: <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />,
    grad: ['#8070FF', '#5548E0', '#3530B0'] as const,
    accentLight: '#C8C0FF',
    accentBar: ['#C8C0FF', '#7268FF'],
    shadowColor: '#5548E0',
    category: 'SUPPORT',
    shimmerColor: 'rgba(180,160,255,0.34)',
    patternType: 'rings',
  },
  lms: {
    icon: <MaterialIcons name="cloud-upload" size={28} color="#fff" />,
    grad: ['#FF4EC0', '#D01898', '#920070'] as const,
    accentLight: '#FFB8E8',
    accentBar: ['#FFB8E8', '#FF4DB4'],
    shadowColor: '#D01898',
    category: 'CONTENT',
    shimmerColor: 'rgba(255,155,220,0.34)',
    patternType: 'dots',
  },
  payslips: {
    icon: <FontAwesome5 name="file-invoice-dollar" size={24} color="#fff" />,
    grad: ['#20CEC8', '#0AABA4', '#027A74'] as const,
    accentLight: '#A0F0EC',
    accentBar: ['#A0F0EC', '#2EBFB8'],
    shadowColor: '#0AABA4',
    category: 'FINANCE',
    shimmerColor: 'rgba(100,240,235,0.32)',
    patternType: 'arc',
  },
};

// ─── Shimmer Sweep (kept from original) ──────────────────────────────────────
function ShimmerSweep({ color, width, delay }: { color: string; width: number; delay: number }) {
  const sweep = useSharedValue(-80);
  useEffect(() => {
    sweep.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(width + 80, { duration: 780 }),
          withDelay(4200 + Math.random() * 1200, withTiming(-80, { duration: 0 }))
        ),
        -1, false
      )
    );
  }, []);
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sweep.value }] }));
  return (
    <Animated.View
      style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 68, zIndex: 8, overflow: 'hidden' }, sweepStyle]}
      pointerEvents="none"
    >
      <LinearGradient colors={['transparent', color, 'transparent']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
    </Animated.View>
  );
}

// ─── Card Pattern Decoration ──────────────────────────────────────────────────
// Each pattern type adds a unique geometric decoration to the gradient zone
function CardPattern({ type, accentLight }: { type: MenuConfig['patternType']; accentLight: string }) {
  if (type === 'rings') {
    // Concentric quarter-arc rings in the bottom-right corner
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: 60 + i * 36,
              height: 60 + i * 36,
              borderRadius: (60 + i * 36) / 2,
              borderWidth: 1.2,
              borderColor: `rgba(255,255,255,${0.14 - i * 0.04})`,
              bottom: -(30 + i * 18),
              right: -(30 + i * 18),
            }}
          />
        ))}
        <View style={{ position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', top: 18, right: 14 }} />
      </View>
    );
  }

  if (type === 'diagonal') {
    // Diagonal ruled lines going top-right to bottom-left
    return (
      <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]} pointerEvents="none">
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              height: 1,
              width: 160,
              backgroundColor: 'rgba(255,255,255,0.09)',
              top: -20 + i * 28,
              right: -30,
              transform: [{ rotate: '-38deg' }],
            }}
          />
        ))}
        <View style={{ position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.18)', top: 16, right: 16 }} />
        <View style={{ position: 'absolute', width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.14)', top: 32, right: 32 }} />
      </View>
    );
  }

  if (type === 'dots') {
    // 3×3 dot grid in the top-right
    const dots = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        dots.push(
          <View
            key={`${row}-${col}`}
            style={{
              position: 'absolute',
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: `rgba(255,255,255,${0.18 - row * 0.04})`,
              top: 14 + row * 14,
              right: 14 + col * 14,
            }}
          />
        );
      }
    }
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {dots}
        <View style={{ position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,0,0,0.14)', bottom: -20, left: -20 }} />
      </View>
    );
  }

  if (type === 'arc') {
    // Single large arc sweeping from top-right corner
    return (
      <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]} pointerEvents="none">
        <View
          style={{
            position: 'absolute',
            width: 110,
            height: 110,
            borderRadius: 55,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.13)',
            top: -44,
            right: -44,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: 74,
            height: 74,
            borderRadius: 37,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.09)',
            top: -22,
            right: -22,
          }}
        />
        <View style={{ position: 'absolute', width: 9, height: 9, borderRadius: 4.5, backgroundColor: 'rgba(255,255,255,0.22)', top: 18, right: 52 }} />
        <View style={{ position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.16)', top: 30, right: 38 }} />
      </View>
    );
  }
  return null;
}

// ─── Live Badge (notification indicator) ─────────────────────────────────────
function LiveBadge({ count }: { count: string }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.15, { duration: 750 }), withTiming(1, { duration: 750 })),
      -1, true
    );
  }, []);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={mc.badgeOuter}>
      <Animated.View style={[mc.badgePulseDot, dotStyle]} />
      <View style={mc.badgeInner}>
        <Text style={mc.badgeCountText}>{count}</Text>
      </View>
    </View>
  );
}

// ─── Enhanced Menu Card ───────────────────────────────────────────────────────
function MenuCard({
  title,
  subtitle,
  configKey,
  badge,
  onPress,
  index,
  isDark,
}: {
  title: string;
  subtitle: string;
  configKey: string;
  badge?: string;
  onPress: () => void;
  index: number;
  isDark: boolean;
}) {
  const cfg = MENU_CONFIGS[configKey];
  const t = isDark ? D.dark : D.light;

  const pressScale = useSharedValue(1);
  const pressDepth = useSharedValue(0);
  const hoverLift = useSharedValue(0);

  const wrapperStyle = useAnimatedStyle(() => {
    const y = IS_WEB ? interpolate(hoverLift.value, [0, 1], [0, -6]) : 0;
    const hoverScale = IS_WEB ? interpolate(hoverLift.value, [0, 1], [1, 1.018]) : 1;
    return {
      transform: [{ translateY: y }, { scale: pressScale.value * hoverScale }],
    };
  });

  const gradZoneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressDepth.value, [0, 1], [1, 0.82]),
  }));

  const shimmerDelay = 800 + index * 500;

  const webShadow = IS_WEB
    ? ({
        boxShadow: `0 20px 48px -14px ${cfg.shadowColor}55, 0 10px 28px -12px rgba(15, 23, 42, 0.14), 0 2px 8px -2px rgba(15, 23, 42, 0.08)`,
      } as const)
    : null;
  const nativeShadow = !IS_WEB
    ? {
        shadowColor: cfg.shadowColor,
        shadowOffset: { width: 0, height: 14 } as const,
        shadowOpacity: isDark ? 0.45 : 0.32,
        shadowRadius: 24,
        elevation: 20,
      }
    : null;

  return (
    <Animated.View
      entering={
        FadeInUp
          .delay(180 + index * 65)
          .duration(560)
          .springify()
          .damping(15)
          .stiffness(90)
      }
      style={[
        wrapperStyle,
        { width: MENU_CARD_W },
        webShadow,
        nativeShadow,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
        onPress={onPress}
        onHoverIn={() => {
          if (IS_WEB) hoverLift.value = withTiming(1, { duration: 180 });
        }}
        onHoverOut={() => {
          if (IS_WEB) hoverLift.value = withTiming(0, { duration: 220 });
        }}
        onPressIn={() => {
          pressScale.value = withSpring(0.94, { damping: 22, stiffness: 360 });
          pressDepth.value = withTiming(1, { duration: 90 });
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { damping: 13, stiffness: 180 });
          pressDepth.value = withTiming(0, { duration: 200 });
        }}
        style={({ pressed }) => [
          IS_WEB && { cursor: 'pointer' as const },
          IS_WEB && { userSelect: 'none' as const },
          pressed && { opacity: 0.97 },
        ]}
      >
        {/* ── Outer Card Shell ── */}
        <View style={[mc.card, {
          borderColor: isDark ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.07)',
        }]}>

          {/* ══════════════════════════════════════
              ZONE 1 — GRADIENT ICON PANEL
          ══════════════════════════════════════ */}
          <Animated.View style={[{ borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, gradZoneStyle]}>
            <LinearGradient
              colors={cfg.grad}
              style={mc.gradZone}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* Geometric pattern decoration */}
              <CardPattern type={cfg.patternType} accentLight={cfg.accentLight} />

              {/* Bottom depth shadow — softens gradient into text zone */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.28)']}
                style={mc.gradZoneVignette}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                pointerEvents="none"
              />

              {/* Top-edge gloss line */}
              <View style={mc.topGloss} />

              {/* Shimmer sweep */}
              <ShimmerSweep color={cfg.shimmerColor} width={MENU_CARD_W} delay={shimmerDelay} />

              {/* Badge (top-right) — only when pending */}
              {badge && (
                <View style={mc.badgePosition}>
                  <LiveBadge count={badge} />
                </View>
              )}

              {/* ── Icon — centered, clean, no rings ── */}
              <View style={mc.iconWrapper}>
                {/* Diffuse background glow */}
                <View style={[mc.iconGlowBlob, { backgroundColor: 'rgba(255,255,255,0.14)' }]} />
                {/* Icon container: frosted glass disc */}
                <View style={mc.iconDisc}>
                  {/* Inner highlight ring */}
                  <View style={mc.iconDiscHighlight} />
                  {cfg.icon}
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ══════════════════════════════════════
              ACCENT DIVIDER — gradient line
          ══════════════════════════════════════ */}
          <LinearGradient
            colors={[cfg.accentBar[0], cfg.accentBar[1], 'transparent']}
            style={mc.accentDivider}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />

          {/* ══════════════════════════════════════
              ZONE 2 — TEXT INFO PANEL
          ══════════════════════════════════════ */}
          <View style={[mc.textZone, {
            backgroundColor: t.menuTextBg,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          }]}>

            {/* Category tag */}
            <View style={[mc.categoryTag, { backgroundColor: `${cfg.accentBar[0]}1F`, borderColor: `${cfg.accentBar[0]}38` }]}>
              <View style={[mc.categoryDot, { backgroundColor: cfg.accentLight }]} />
              <Text style={[mc.categoryText, { color: cfg.accentLight }]}>{cfg.category}</Text>
            </View>

            {/* Title + arrow row */}
            <View style={mc.titleRow}>
              <Text style={[mc.titleText, { color: t.text1 }]} numberOfLines={1}>{title}</Text>
              <View style={[mc.arrowChip, { backgroundColor: `${cfg.accentBar[0]}20`, borderColor: `${cfg.accentBar[0]}30` }]}>
                <Ionicons name="chevron-forward" size={14} color={cfg.accentLight} />
              </View>
            </View>

            {/* Subtitle */}
            <Text style={[mc.subtitleText, { color: t.text2 }]} numberOfLines={IS_WEB ? 2 : 1}>{subtitle}</Text>

            {IS_WEB && (
              <Text style={[mc.webHint, { color: t.text3 }]} numberOfLines={1}>Click to open</Text>
            )}

            {/* Bottom accent micro-bar */}
            <LinearGradient
              colors={[cfg.accentBar[0], `${cfg.accentBar[1]}00`]}
              style={mc.microBar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>

          {/* Outer border overlay (full card) */}
          <View style={[mc.outerBorder, {
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
          }]} pointerEvents="none" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function StaffDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const t = isDark ? D.dark : D.light;
  const { staffId, isViewingAsAdmin, viewAsName } = useEffectiveStaffId();
  const viewAsParams = isViewingAsAdmin ? { staffId, viewAsName } : undefined;
  const { payslipsEnabled } = useStaffPortalConfig();

  const { data, loading: metricsLoading } = usePersistedSWR<DashboardMetrics>({
    cacheKey: `staff-dashboard-${staffId ?? 'self'}`,
    userId: user?.userId,
    ttlMs: 120_000,
    persist: !isViewingAsAdmin,
    enabled: !!user,
    fetcher: async () => {
      const pendingLeaves = isViewingAsAdmin ? [] : await LeaveService.getAll({ status: 'pending' });
      let studentCount = 0, presentCount = 0, absentCount = 0;
      let detectedClassId: string | undefined;
      const myClass = await AttendanceService.getMyClass(undefined, staffId);
      if (myClass) {
        detectedClassId = myClass.class_section_id;
        studentCount = myClass.total_students;
        presentCount = myClass.students.filter((s: any) => s.status === 'present').length;
        absentCount = myClass.students.filter((s: any) => s.status === 'absent').length;
      }
      return {
        totalStudents: studentCount,
        presentToday: presentCount,
        absentToday: absentCount,
        pendingLeaves: pendingLeaves.length,
        classId: detectedClassId,
      };
    },
  });
  const loading = metricsLoading && !data;

  useFocusEffect(useCallback(() => {
    // Only the teacher's own home screen should treat hardware back as "exit app".
    // When an admin is viewing this as another staff member's portal, this screen
    // sits on top of Manage Staff in the stack — hardware back must pop to it
    // normally instead of quitting the app.
    if (isViewingAsAdmin) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { BackHandler.exitApp(); return true; });
    return () => sub.remove();
  }, [isViewingAsAdmin]));

  const menuItems = [
    { title: 'Diary', subtitle: 'Daily logs & notes', configKey: 'diary', route: '/staff/diary' },
    { title: 'Timetable', subtitle: 'Class schedule', configKey: 'timetable', route: '/staff/timetable' },
    { title: 'Attendance', subtitle: 'History & reports', configKey: 'attendance', route: '/staff/attendance' },
    { title: 'Leaves', subtitle: 'Review approvals', configKey: 'leaves', route: '/staff/leaves', badge: data?.pendingLeaves ? `${data.pendingLeaves}` : undefined },
    { title: 'Results', subtitle: 'Enter & view marks', configKey: 'results', route: '/staff/results' },
    { title: 'Complaints', subtitle: 'Student issues', configKey: 'complaints', route: '/staff/complaints' },
    { title: 'LMS', subtitle: 'Upload resources', configKey: 'lms', route: '/staff/lms-upload' },
    ...(payslipsEnabled ? [{ title: 'Payslips', subtitle: 'Salary & docs', configKey: 'payslips', route: '/staff/payslip' }] : []),
  ];

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e: any) => { scrollY.value = e.contentOffset.y; },
  });

  const firstName = (isViewingAsAdmin ? viewAsName : user?.displayName)?.split(' ')[0] || 'Teacher';

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <BgOrbs isDark={isDark} />
      <StaffHeader
        title="Staff Portal"
        subtitle={(isViewingAsAdmin ? viewAsName : user?.displayName) || 'Teacher'}
        scrollY={scrollY}
      />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {isViewingAsAdmin && <ViewAsBanner name={viewAsName} />}
        <HeroBanner name={firstName} isDark={isDark} />
        {!isViewingAsAdmin && !!data?.pendingLeaves && (
          <LeaveAlert count={data.pendingLeaves} onPress={() => router.push('/staff/leaves' as any)} isDark={isDark} />
        )}
        <SectionLabel label="TODAY'S CLASS" isDark={isDark} />
        <AttendanceHero
          data={data}
          onPress={() => router.push({ pathname: '/staff/manage-students', params: viewAsParams } as any)}
          isDark={isDark}
        />
        <SectionLabel label="QUICK ACTIONS" isDark={isDark} />
        <View style={styles.menuGrid}>
          {menuItems.map((item, index) => (
            <MenuCard
              key={item.configKey}
              title={item.title}
              subtitle={item.subtitle}
              configKey={item.configKey}
              badge={(item as any).badge}
              onPress={() => router.push({ pathname: item.route, params: viewAsParams } as any)}
              index={index}
              isDark={isDark}
            />
          ))}
        </View>
        <View style={{ height: 90 }} />
      </Animated.ScrollView>
    </View>
  );
}

// ─── Menu Card Styles (mc) ────────────────────────────────────────────────────
const mc = StyleSheet.create({
  // Outer shell
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    ...(IS_WEB ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)' } : {}),
  },
  outerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1,
  },

  // ── Gradient Zone ──────────────────────────────────────────────────
  gradZone: {
    height: IS_WEB ? 124 : 118,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gradZoneVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  topGloss: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 1,
  },

  // Badge (notification)
  badgePosition: {
    position: 'absolute',
    top: 11,
    right: 11,
    zIndex: 20,
  },
  badgeOuter: {
    position: 'relative',
  },
  badgePulseDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#FF3D5C',
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  badgeInner: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.40)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },

  // Icon container
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconGlowBlob: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  iconDisc: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.45)',
      },
      default: {
        shadowColor: 'rgba(0,0,0,0.35)',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
    }),
  },
  iconDiscHighlight: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.60)',
    borderRadius: 1,
  },

  // ── Accent Divider ─────────────────────────────────────────────────
  accentDivider: {
    height: 2.5,
  },

  // ── Text Zone ──────────────────────────────────────────────────────
  textZone: {
    paddingTop: 13,
    paddingHorizontal: 14,
    paddingBottom: 18,
    minHeight: IS_WEB ? 108 : 92,
    justifyContent: 'flex-start',
    gap: 2,
  },

  // Category tag: capsule with colored dot
  categoryTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  categoryDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    opacity: 0.90,
  },
  categoryText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.6,
  },

  // Title + arrow
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.45,
    flex: 1,
    marginRight: 8,
  },
  arrowChip: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // Subtitle
  subtitleText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.05,
    lineHeight: IS_WEB ? 16 : 15,
    marginTop: 2,
    flexShrink: 1,
  },

  webHint: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 6,
    opacity: 0.85,
  },

  // Micro accent bar at bottom of text zone
  microBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    opacity: 0.8,
  },
});

// ─── Shared Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingTop: 108, paddingHorizontal: 20, paddingBottom: 40 },
  orb: { position: 'absolute' },

  // ── Hero Banner ──────────────────────────────────────────────────────────
  heroBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, marginTop: 4 },
  heroBannerLeft: { flex: 1, paddingRight: 16 },
  dateBadge: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, marginBottom: 10 },
  dateBadgeText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  greetLine: { fontSize: 14, fontWeight: '500', letterSpacing: 0.1, marginBottom: 3 },
  nameLine: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, lineHeight: 30 },
  avatarBubble: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: ACCENT.violet, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.40, shadowRadius: 14, elevation: 10 },
  avatarInitial: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },

  // ── Leave Alert ──────────────────────────────────────────────────────────
  leaveAlert: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, paddingVertical: 13, paddingHorizontal: 14 },
  leaveAlertLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  leaveAlertDot: { position: 'absolute', left: -2, top: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT.amber },
  leaveAlertIconBox: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  leaveAlertTitle: { fontSize: 13.5, fontWeight: '700', color: ACCENT.amber },
  leaveAlertSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  leaveCountBubble: { width: 28, height: 28, borderRadius: 14, backgroundColor: ACCENT.amber, alignItems: 'center', justifyContent: 'center' },
  leaveCountText: { fontSize: 12, fontWeight: '800', color: '#000' },

  // ── Section Label ────────────────────────────────────────────────────────
  sectionLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  sectionAccent: { width: 3, height: 14, borderRadius: 2, marginRight: 9 },
  sectionLabelText: { fontSize: 10, fontWeight: '700', letterSpacing: 2.4 },

  // ── Attendance Hero Card ─────────────────────────────────────────────────
  heroCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.10, shadowRadius: 20, elevation: 6 },
  cardTopGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },
  cardShimmerLine: { position: 'absolute', top: 0, left: 30, right: 30, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  heroCardTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  heroCardSub: { fontSize: 11.5, fontWeight: '500', marginTop: 2 },
  heroCardChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  heroCardChipText: { fontSize: 11, fontWeight: '700' },
  heroCardBody: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, gap: 16 },
  heroCardFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: 1, gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  heroCardFooterText: { fontSize: 12, fontWeight: '600' },
  heroCardFooterLink: { fontSize: 12, fontWeight: '700', letterSpacing: -0.2 },

  // ── Arc ──────────────────────────────────────────────────────────────────
  arcContainer: { width: 164, height: 164, alignItems: 'center', justifyContent: 'center' },
  arcCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  arcPct: { fontSize: 38, fontWeight: '900', letterSpacing: -2 },
  arcPctSymbol: { fontSize: 18, fontWeight: '700' },
  arcLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginTop: 2 },

  // ── Stat Pill ────────────────────────────────────────────────────────────
  heroStatCol: { flex: 1, gap: 10 },
  statPill: { borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },
  statPillVal: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statPillLbl: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4, marginTop: 2 },

  // ── Menu Grid ────────────────────────────────────────────────────────────
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: MENU_GAP, marginBottom: 4 },
});