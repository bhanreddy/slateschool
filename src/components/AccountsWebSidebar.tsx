import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { SCHOOL_NAME } from '../constants/school';
import {
  DASHBOARD_SIDEBAR_COLLAPSED,
  DASHBOARD_SIDEBAR_EXPANDED,
} from './DashboardWebSidebar';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface AccountsSidebarNavItem {
  title: string;
  icon: IconName;
  route: string;
  gradient: [string, string];
  badge?: number;
  category?: string;
}

function routeIsActive(pathname: string, itemRoute: string): boolean {
  const p = pathname.split('?')[0].replace(/\/$/, '') || '';
  const r = itemRoute.replace(/\/$/, '');
  if (p === r) return true;
  if (r === '/accounts/dashboard') return p === '/accounts/dashboard';
  return p.startsWith(`${r}/`);
}

const SECTION_LABELS = {
  workspace: 'WORKSPACE',
  people: 'PEOPLE',
  system: 'SYSTEM',
} as const;

const DEFAULT_NAV: AccountsSidebarNavItem[] = [
  {
    title: 'Dashboard',
    icon: 'grid-outline',
    route: '/accounts/dashboard',
    gradient: ['#3B82F6', '#1D4ED8'],
    category: 'Overview',
  },
  {
    title: 'Transactions',
    icon: 'swap-horizontal-outline',
    route: '/accounts/fees',
    gradient: ['#10B981', '#059669'],
    category: 'Fees & payments',
  },
  {
    title: 'Reports',
    icon: 'bar-chart-outline',
    route: '/accounts/invoices',
    gradient: ['#8B5CF6', '#6D28D9'],
    category: 'Documents',
  },
  {
    title: 'Users / Clients',
    icon: 'people-outline',
    route: '/accounts/manage-users',
    gradient: ['#0EA5E9', '#0284C7'],
    category: 'Directory',
  },
  {
    title: 'Pending Enrolments',
    icon: 'person-add-outline',
    route: '/accounts/pending-enrollments',
    gradient: ['#8B5CF6', '#7C3AED'],
    category: 'Admissions',
  },
  {
    title: 'Settings',
    icon: 'settings-outline',
    route: '/accounts/settings',
    gradient: ['#64748B', '#475569'],
    category: 'Preferences',
  },
];

interface AccountsWebSidebarProps {
  collapsed: boolean;
  pendingEnrollmentsBadge?: number;
}

export default function AccountsWebSidebar({
  collapsed,
  pendingEnrollmentsBadge = 0,
}: AccountsWebSidebarProps) {
  const { isDark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();

  const widthSV = useSharedValue(
    collapsed ? DASHBOARD_SIDEBAR_COLLAPSED : DASHBOARD_SIDEBAR_EXPANDED,
  );

  useEffect(() => {
    widthSV.value = withTiming(
      collapsed ? DASHBOARD_SIDEBAR_COLLAPSED : DASHBOARD_SIDEBAR_EXPANDED,
      { duration: 280, easing: Easing.out(Easing.cubic) },
    );
  }, [collapsed, widthSV]);

  const shellAnimStyle = useAnimatedStyle(() => ({
    width: widthSV.value,
    overflow: 'hidden' as const,
  }));

  const items = useMemo(() => {
    return DEFAULT_NAV.map((it) =>
      it.route === '/accounts/pending-enrollments' && pendingEnrollmentsBadge > 0
        ? { ...it, badge: pendingEnrollmentsBadge }
        : it,
    );
  }, [pendingEnrollmentsBadge]);

  const grouped = useMemo(() => {
    const workspace = items.filter((i) =>
      ['/accounts/dashboard', '/accounts/fees', '/accounts/invoices'].includes(i.route),
    );
    const people = items.filter((i) =>
      ['/accounts/manage-users', '/accounts/pending-enrollments'].includes(i.route),
    );
    const system = items.filter((i) => i.route === '/accounts/settings');
    return [
      { key: 'workspace' as const, label: SECTION_LABELS.workspace, items: workspace },
      { key: 'people' as const, label: SECTION_LABELS.people, items: people },
      { key: 'system' as const, label: SECTION_LABELS.system, items: system },
    ].filter((g) => g.items.length > 0);
  }, [items]);

  const flatForCollapsed = useMemo(() => items, [items]);

  const styles = useMemo(() => createStyles(isDark, collapsed), [isDark, collapsed]);

  const onNavigate = useCallback(
    (route: string) => {
      console.debug('[AccountsWebSidebar] onNavigate start', { route });
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(route as any);
        console.debug('[AccountsWebSidebar] onNavigate end', { route });
      } catch (e) {
        console.error('Button action failed:', e);
      }
    },
    [router],
  );

  const onLogout = useCallback(async () => {
    console.debug('[AccountsWebSidebar] onLogout start');
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.removeItem('accounts_auto_login');
      await signOut();
      router.replace('/welcome');
      console.debug('[AccountsWebSidebar] onLogout end');
    } catch (e) {
      console.error('Button action failed:', e);
    }
  }, [router, signOut]);

  const accentTop = '#3B82F6';

  const renderRow = (item: AccountsSidebarNavItem) => {
    const active = routeIsActive(pathname, item.route);
    const [g0, g1] = item.gradient;
    const showBadge = item.badge !== undefined && item.badge > 0;
    const restingShadow = isDark
      ? '7px 8px 18px rgba(0,0,0,0.28), -5px -5px 14px rgba(255,255,255,0.025), inset 1.5px 1.5px 3px rgba(255,255,255,0.06), inset -2px -2px 5px rgba(0,0,0,0.18)'
      : '7px 9px 18px rgba(100,116,139,0.13), -6px -6px 16px rgba(255,255,255,0.96), inset 2px 2px 4px rgba(255,255,255,0.82), inset -2.5px -2.5px 6px rgba(100,116,139,0.10)';
    const activeShadow = isDark
      ? `8px 11px 22px ${g1}66, -5px -5px 14px rgba(255,255,255,0.035), inset 2px 2px 4px rgba(255,255,255,0.24), inset -3px -4px 7px rgba(0,0,0,0.22)`
      : `8px 12px 22px ${g1}42, -6px -6px 16px rgba(255,255,255,0.98), inset 2px 2px 5px rgba(255,255,255,0.34), inset -3px -4px 7px rgba(15,23,42,0.16)`;

    return (
      <Pressable
        key={item.route}
        onPress={() => onNavigate(item.route)}
        style={({ pressed }: any) => [
          styles.row,
          collapsed && styles.rowCollapsed,
          {
            borderRadius: 18,
            marginBottom: 10,
            backgroundColor: active ? g0 : (isDark ? '#182235' : '#F2F5FB'),
            borderWidth: 1,
            borderColor: active
              ? 'rgba(255,255,255,0.34)'
              : isDark ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.86)',
            shadowColor: active ? g1 : (isDark ? '#000000' : '#64748B'),
            shadowOffset: { width: pressed ? 2 : 6, height: pressed ? 3 : 9 },
            shadowOpacity: pressed ? 0.14 : (active ? 0.26 : 0.12),
            shadowRadius: pressed ? 5 : 12,
            elevation: pressed ? 2 : 5,
            transform: [{ translateY: pressed ? 2 : 0 }, { scale: pressed ? 0.988 : 1 }],
            ...(Platform.OS === 'web' ? ({
              cursor: 'pointer',
              boxShadow: pressed
                ? 'inset 4px 5px 9px rgba(15,23,42,0.19), inset -2px -2px 5px rgba(255,255,255,0.14), 2px 3px 8px rgba(15,23,42,0.10)'
                : active ? activeShadow : restingShadow,
              transition: 'transform 120ms ease, box-shadow 150ms ease, border-color 150ms ease',
            } as any) : {}),
          },
        ]}
      >
        <View style={[StyleSheet.absoluteFill, { borderRadius: 18, overflow: 'hidden' }]}>
          <LinearGradient
            colors={active
              ? [g0, g1]
              : isDark ? ['#202C43', '#151E2F'] : ['#FAFCFF', '#E9EEF7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              Platform.OS === 'web' && ({
                backgroundImage: 'radial-gradient(105% 95% at 2% -10%, rgba(255,255,255,0.46) 0%, rgba(255,255,255,0.12) 42%, rgba(255,255,255,0) 70%)',
              } as any),
            ]}
          />
          <View style={styles.topSpecular} pointerEvents="none" />
        </View>

        <View
          style={[
            styles.iconWrap,
            collapsed && styles.iconWrapCollapsed,
            {
              backgroundColor: active
                ? 'rgba(255,255,255,0.20)'
                : isDark ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.64)',
              borderWidth: 1,
              borderColor: active
                ? 'rgba(255,255,255,0.28)'
                : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.82)',
              shadowColor: active ? g1 : '#64748B',
              shadowOffset: { width: 2, height: 3 },
              shadowOpacity: active ? 0.28 : 0.12,
              shadowRadius: 5,
              elevation: 2,
              ...(Platform.OS === 'web' ? ({
                boxShadow: active
                  ? 'inset 2px 2px 4px rgba(255,255,255,0.32), inset -3px -3px 6px rgba(15,23,42,0.17), 3px 5px 9px rgba(15,23,42,0.18)'
                  : isDark
                    ? 'inset 2px 2px 4px rgba(255,255,255,0.07), inset -3px -3px 6px rgba(0,0,0,0.20), 3px 5px 9px rgba(0,0,0,0.16)'
                    : 'inset 2px 2px 4px rgba(255,255,255,0.96), inset -3px -3px 6px rgba(100,116,139,0.14), 3px 5px 9px rgba(100,116,139,0.13)',
              } as any) : {}),
            },
          ]}
        >
          <Ionicons
            name={item.icon}
            size={22}
            color={
              active
                ? '#FFFFFF'
                : isDark
                  ? 'rgba(255,255,255,0.45)'
                  : 'rgba(15,23,42,0.5)'
            }
          />
          {collapsed && showBadge ? <View style={styles.badgeDot} /> : null}
        </View>

        {!collapsed ? (
          <View style={styles.meta}>
            <View style={styles.titleRow}>
              <Text style={[styles.itemTitle, active && { color: '#FFFFFF', textShadowColor: 'rgba(15,23,42,0.20)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }]} numberOfLines={2}>
                {item.title}
              </Text>
              {showBadge ? (
                <View style={[
                  styles.badge,
                  {
                    backgroundColor: active ? 'rgba(255,255,255,0.22)' : g0,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.38)',
                    ...(Platform.OS === 'web' ? ({ boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.34), inset -2px -2px 4px rgba(15,23,42,0.18), 2px 3px 7px rgba(15,23,42,0.16)' } as any) : {}),
                  },
                ]}>
                  <Text style={styles.badgeText}>{item.badge! > 99 ? '99+' : item.badge}</Text>
                </View>
              ) : null}
            </View>
            {item.category ? (
              <Text style={[styles.category, active && { color: 'rgba(255,255,255,0.76)' }]} numberOfLines={1}>
                {item.category.toUpperCase()}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Animated.View style={[styles.shellOuter, shellAnimStyle]}>
      <View style={styles.shellInner}>
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0D1120' : '#E9EEF7' }]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.34)',
            },
          ]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[`${accentTop}55`, `${accentTop}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.rightBorderGradient}
        />

        <View style={[styles.topBrand, !collapsed && styles.topBrandExpanded]}>
          <LinearGradient
            colors={isDark ? ['#3B82F6', '#7C3AED'] : ['#6366F1', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.brandPill,
              Platform.OS === 'web' && ({
                boxShadow: isDark
                  ? '8px 11px 24px rgba(30,41,100,0.50), -5px -5px 14px rgba(255,255,255,0.025), inset 2px 2px 5px rgba(255,255,255,0.28), inset -4px -5px 8px rgba(15,23,42,0.20)'
                  : '8px 12px 25px rgba(79,70,229,0.30), -6px -6px 16px rgba(255,255,255,0.92), inset 2px 2px 5px rgba(255,255,255,0.32), inset -4px -5px 8px rgba(30,27,75,0.18)',
              } as any),
            ]}
          >
            <View style={[
              styles.brandOrbInner,
              Platform.OS === 'web' && ({
                boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.24), inset -3px -3px 6px rgba(15,23,42,0.18), 3px 5px 10px rgba(15,23,42,0.22)',
              } as any),
            ]}>
              <LinearGradient
                colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Ionicons name="wallet" size={collapsed ? 20 : 22} color="#FFFFFF" />
            </View>
            {!collapsed ? (
              <View style={styles.brandTextWrap}>
                <Text style={styles.brandName} numberOfLines={1}>
                  {SCHOOL_NAME || 'SchoolIMS'}
                </Text>
                <Text style={styles.brandSub}>Accounts</Text>
              </View>
            ) : null}
          </LinearGradient>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {collapsed
            ? flatForCollapsed.map((item) => renderRow(item))
            : grouped.map((group) => (
                <View key={group.key} style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>{group.label}</Text>
                  {group.items.map((item) => renderRow(item))}
                </View>
              ))}
        </ScrollView>

        <Pressable
          onPress={onLogout}
          style={({ pressed }: any) => [
            styles.logoutRow,
            collapsed && styles.logoutRowCollapsed,
            {
              borderRadius: 18,
              borderWidth: 1,
              backgroundColor: isDark ? '#3B2028' : '#FDE2E5',
              borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.82)',
              shadowColor: isDark ? '#000' : '#DC2626',
              shadowOffset: { width: pressed ? 2 : 6, height: pressed ? 3 : 9 },
              shadowOpacity: pressed ? 0.10 : (isDark ? 0.24 : 0.16),
              shadowRadius: pressed ? 5 : 12,
              elevation: pressed ? 2 : 5,
              paddingVertical: 10,
              paddingHorizontal: 10,
              marginHorizontal: 10,
              marginBottom: 16,
              marginTop: 10,
              transform: [{ translateY: pressed ? 2 : 0 }, { scale: pressed ? 0.988 : 1 }],
              ...(Platform.OS === 'web' ? ({
                cursor: 'pointer',
                boxShadow: pressed
                  ? 'inset 4px 5px 9px rgba(127,29,29,0.18), inset -2px -2px 5px rgba(255,255,255,0.26), 2px 3px 8px rgba(127,29,29,0.08)'
                  : isDark
                    ? '7px 9px 19px rgba(0,0,0,0.30), -5px -5px 14px rgba(255,255,255,0.025), inset 2px 2px 4px rgba(255,255,255,0.07), inset -3px -3px 6px rgba(0,0,0,0.18)'
                    : '7px 10px 20px rgba(220,38,38,0.16), -6px -6px 16px rgba(255,255,255,0.95), inset 2px 2px 4px rgba(255,255,255,0.74), inset -3px -3px 6px rgba(190,24,93,0.10)',
                transition: 'transform 120ms ease, box-shadow 150ms ease',
              } as any) : {}),
            },
          ]}
        >
          <View style={[StyleSheet.absoluteFill, { borderRadius: 18, overflow: 'hidden' }]}>
            <LinearGradient
              colors={isDark ? ['#4A2731', '#301A22'] : ['#FFF2F3', '#F8D5D9']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.topSpecular} pointerEvents="none" />
          </View>
          <View style={[
            styles.iconWrapLogout,
            {
              backgroundColor: isDark ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.58)',
              marginLeft: 0,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.82)',
              ...(Platform.OS === 'web' ? ({
                boxShadow: isDark
                  ? 'inset 2px 2px 4px rgba(255,255,255,0.06), inset -3px -3px 6px rgba(0,0,0,0.22), 3px 5px 9px rgba(0,0,0,0.16)'
                  : 'inset 2px 2px 4px rgba(255,255,255,0.95), inset -3px -3px 6px rgba(190,24,93,0.10), 3px 5px 9px rgba(190,24,93,0.12)',
              } as any) : {}),
            },
          ]}>
            <Ionicons
              name="log-out-outline"
              size={22}
              color={isDark ? 'rgba(248,113,113,0.95)' : '#DC2626'}
            />
          </View>
          {!collapsed ? (
            <Text style={[styles.logoutLabel, { marginLeft: 10 }]}>Logout</Text>
          ) : null}
        </Pressable>
      </View>
    </Animated.View>
  );
}

function createStyles(isDark: boolean, collapsed: boolean) {
  const fg = isDark ? '#F8FAFC' : '#0F172A';
  const fgMuted = isDark ? 'rgba(248,250,252,0.5)' : 'rgba(15,23,42,0.45)';

  return StyleSheet.create({
    shellOuter: {
      alignSelf: 'stretch',
      flexShrink: 0,
    },
    shellInner: {
      flex: 1,
      alignSelf: 'stretch',
      position: 'relative',
      overflow: 'hidden',
    },
    rightBorderGradient: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 2,
      bottom: 0,
      zIndex: 4,
    },
    topBrand: {
      paddingHorizontal: collapsed ? 8 : 12,
      paddingVertical: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      minHeight: 72,
      zIndex: 2,
    },
    topBrandExpanded: {
      alignItems: 'stretch',
    },
    brandPill: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 20,
      paddingVertical: 10,
      paddingHorizontal: collapsed ? 10 : 12,
      gap: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.32)',
      shadowColor: '#4338CA',
      shadowOffset: { width: 7, height: 10 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
      elevation: 6,
    },
    brandOrbInner: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: 'rgba(0,0,0,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.24)',
    },
    brandTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    brandName: {
      fontSize: 14,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    brandSub: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
      textTransform: 'uppercase',
    },
    scroll: { flex: 1, minHeight: 0, zIndex: 2 },
    scrollContent: {
      paddingVertical: 12,
      paddingHorizontal: collapsed ? 8 : 10,
      paddingBottom: 12,
    },
    sectionBlock: {
      marginBottom: 8,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
      color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.4)',
      marginBottom: 8,
      marginTop: 4,
      paddingHorizontal: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 18,
      marginBottom: 10,
      overflow: 'hidden',
      minHeight: 54,
      position: 'relative',
    },
    topSpecular: {
      position: 'absolute',
      top: 1,
      left: 14,
      right: 14,
      height: 1,
      borderRadius: 1,
      backgroundColor: 'rgba(255,255,255,0.48)',
    },
    rowCollapsed: {
      justifyContent: 'center',
      paddingHorizontal: 0,
    },
    rowActiveFill: {
      borderRadius: 14,
    },
    rowGhost: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
    },
    activeLeftGlow: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 56,
      borderRadius: 14,
      zIndex: 1,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
      marginRight: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
      zIndex: 2,
    },
    iconWrapActive: {
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    iconWrapCollapsed: {
      marginLeft: 0,
      marginRight: 0,
    },
    badgeDot: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#EF4444',
      borderWidth: 1.5,
      borderColor: isDark ? '#0D1120' : '#F8FAFF',
    },
    meta: {
      flex: 1,
      minWidth: 0,
      paddingRight: 10,
      paddingVertical: 6,
      zIndex: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    itemTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      color: fg,
      letterSpacing: -0.2,
    },
    itemTitleActive: {
      color: '#FFFFFF',
    },
    category: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1,
      color: fgMuted,
      marginTop: 4,
    },
    categoryActive: {
      color: 'rgba(255,255,255,0.75)',
    },
    badge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
    },
    logoutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: collapsed ? 0 : 10,
      marginHorizontal: collapsed ? 0 : 10,
      marginBottom: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      zIndex: 2,
    },
    logoutRowCollapsed: {
      justifyContent: 'center',
    },
    iconWrapLogout: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: collapsed ? 0 : 8,
      marginRight: collapsed ? 0 : 10,
      backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
    },
    logoutLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: isDark ? 'rgba(248,113,113,0.95)' : '#DC2626',
      letterSpacing: -0.2,
    },
  });
}
