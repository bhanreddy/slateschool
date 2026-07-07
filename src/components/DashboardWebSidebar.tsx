import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../hooks/useTheme';
import { SCHOOL_NAME } from '../constants/school';

export const DASHBOARD_SIDEBAR_EXPANDED = 240;
export const DASHBOARD_SIDEBAR_COLLAPSED = 68;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface WebSidebarActionItem {
  title: string;
  icon: IconName;
  route: string;
  gradient: [string, string];
  badge?: number;
  category?: string;
}

function routeIsActive(pathname: string, itemRoute: string): boolean {
  if (pathname === itemRoute) return true;
  if (itemRoute === '/admin' || itemRoute === '/admin/dashboard') return false;
  return pathname.startsWith(`${itemRoute}/`);
}

function getSidebarSection(route: string): 'navigation' | 'manage' | 'reports' {
  if (
    route.includes('/reports') ||
    route.includes('smart-insights') ||
    route.includes('progress-report') ||
    route.includes('certificate')
  ) {
    return 'reports';
  }
  if (
    route.includes('/expenses') ||
    route.includes('/finance') ||
    route.includes('/manage-staff') ||
    route.includes('/addStaff') ||
    route.includes('/staff-form') ||
    route.includes('/access-requests') ||
    route.includes('/leaves') ||
    route.includes('/fees') ||
    route.includes('/add-accounts') ||
    route.includes('/complaints')
  ) {
    return 'manage';
  }
  return 'navigation';
}

interface DashboardWebSidebarProps {
  collapsed: boolean;
  items: WebSidebarActionItem[];
}

const SECTION_LABELS: Record<'navigation' | 'manage' | 'reports', string> = {
  navigation: 'NAVIGATION',
  manage: 'MANAGE',
  reports: 'REPORTS',
};

export default function DashboardWebSidebar({ collapsed, items }: DashboardWebSidebarProps) {
  const { isDark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const width = collapsed ? DASHBOARD_SIDEBAR_COLLAPSED : DASHBOARD_SIDEBAR_EXPANDED;

  const styles = useMemo(() => createStyles(isDark, collapsed), [isDark, collapsed]);

  const grouped = useMemo(() => {
    const buckets: Record<'navigation' | 'manage' | 'reports', WebSidebarActionItem[]> = {
      navigation: [],
      manage: [],
      reports: [],
    };
    items.forEach((item) => {
      buckets[getSidebarSection(item.route)].push(item);
    });
    return (['navigation', 'manage', 'reports'] as const)
      .map((key) => ({ key, label: SECTION_LABELS[key], items: buckets[key] }))
      .filter((g) => g.items.length > 0);
  }, [items]);

  const flatForCollapsed = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const onNavigate = useCallback(
    (route: string) => {
      console.debug('[DashboardWebSidebar] onNavigate start', { route });
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(route as any);
        console.debug('[DashboardWebSidebar] onNavigate end', { route });
      } catch (e) {
        console.error('Button action failed:', e);
      }
    },
    [router],
  );

  const accentTop = '#3B82F6';

  const renderRow = (item: WebSidebarActionItem) => {
    const active = routeIsActive(pathname, item.route);
    const [g0, g1] = item.gradient;
    const showBadge = item.badge !== undefined && item.badge > 0;

    return (
      <Pressable
        key={item.route}
        onPress={() => onNavigate(item.route)}
        style={[styles.row, collapsed && styles.rowCollapsed, Platform.OS === 'web' && { cursor: 'pointer' }]}
      >
        {active ? (
          <>
            <LinearGradient
              colors={[g0, g1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[StyleSheet.absoluteFill, styles.rowActiveFill]}
            />
            <LinearGradient
              colors={[`${g0}FF`, `${g0}00`]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.activeLeftGlow}
            />
          </>
        ) : (
          <View style={styles.rowGhost} />
        )}

        <View style={[styles.iconWrap, collapsed && styles.iconWrapCollapsed, active && styles.iconWrapActive]}>
          <Ionicons
            name={item.icon}
            size={22}
            color={
              active
                ? '#FFFFFF'
                : isDark
                  ? 'rgba(255,255,255,0.38)'
                  : 'rgba(15,23,42,0.42)'
            }
          />
          {collapsed && showBadge ? <View style={styles.badgeDot} /> : null}
        </View>

        {!collapsed ? (
          <View style={styles.meta}>
            <View style={styles.titleRow}>
              <Text style={[styles.itemTitle, active && styles.itemTitleActive]} numberOfLines={2}>
                {item.title}
              </Text>
              {showBadge ? (
                <View style={[styles.badge, { backgroundColor: g0 }]}>
                  <Text style={styles.badgeText}>{item.badge! > 99 ? '99+' : item.badge}</Text>
                </View>
              ) : null}
            </View>
            {item.category ? (
              <Text style={[styles.category, active && styles.categoryActive]} numberOfLines={1}>
                {item.category.toUpperCase()}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={[styles.shell, { width }]}>
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0D1120' : '#F8FAFF' }]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
            borderRightWidth: 0,
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
          style={styles.brandPill}
        >
          <View style={styles.brandOrbInner}>
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons name="school" size={collapsed ? 20 : 22} color="#FFFFFF" />
          </View>
          {!collapsed ? (
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandName} numberOfLines={1}>
                {SCHOOL_NAME || 'SchoolIMS'}
              </Text>
              <Text style={styles.brandSub}>Admin</Text>
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
    </View>
  );
}

function createStyles(isDark: boolean, collapsed: boolean) {
  const fg = isDark ? '#F8FAFC' : '#0F172A';
  const fgMuted = isDark ? 'rgba(248,250,252,0.5)' : 'rgba(15,23,42,0.45)';

  return StyleSheet.create({
    shell: {
      alignSelf: 'stretch',
      flexShrink: 0,
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
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: collapsed ? 10 : 12,
      gap: 12,
      overflow: 'hidden',
    },
    brandOrbInner: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: 'rgba(0,0,0,0.15)',
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
      paddingBottom: 28,
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
      borderRadius: 14,
      marginBottom: 4,
      overflow: 'hidden',
      minHeight: 48,
      position: 'relative',
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
  });
}
