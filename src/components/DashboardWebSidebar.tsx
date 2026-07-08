import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withSequence
} from 'react-native-reanimated';
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

function getCategoryClayColors(category: string, isDark: boolean) {
  let bg = '#4A72E6';
  let shadowColor = '#253FA3';
  if (category === 'Academic' || category === 'AI') {
    bg = isDark ? '#3053C4' : '#4A72E6';
    shadowColor = isDark ? '#1C318F' : '#253FA3';
  } else if (category === 'Finance') {
    bg = isDark ? '#1B7F5F' : '#2CB288';
    shadowColor = isDark ? '#0D4E3A' : '#136146';
  } else if (category === 'Analytics') {
    bg = isDark ? '#5033B3' : '#825AE6';
    shadowColor = isDark ? '#2F187A' : '#4925A3';
  } else if (category === 'Comms') {
    bg = isDark ? '#9B531C' : '#E58539';
    shadowColor = isDark ? '#5C2D0B' : '#75390E';
  } else if (category === 'Support') {
    bg = isDark ? '#9E4437' : '#E06D5E';
    shadowColor = isDark ? '#5B1E16' : '#7D2F23';
  } else if (category === 'Ops') {
    bg = isDark ? '#9E731D' : '#E6AE3C';
    shadowColor = isDark ? '#5A3E08' : '#7D550A';
  } else if (category === 'HR') {
    bg = isDark ? '#9E333C' : '#E65A65';
    shadowColor = isDark ? '#5E1015' : '#7D1B22';
  } else if (category === 'Security') {
    bg = isDark ? '#9E2833' : '#E64A57';
    shadowColor = isDark ? '#5E0B11' : '#7D161F';
  }
  return { bg, shadowColor };
}

function SidebarRow({
  item,
  collapsed,
  active,
  isDark,
  onNavigate,
  styles,
}: {
  item: WebSidebarActionItem;
  collapsed: boolean;
  active: boolean;
  isDark: boolean;
  onNavigate: (route: string) => void;
  styles: any;
}) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ]
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 150 });
    translateY.value = withTiming(1, { duration: 150 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 150 });
    translateY.value = withTiming(0, { duration: 150 });
  };

  const category = item.category ?? 'Academic';
  const showBadge = item.badge !== undefined && item.badge > 0;
  
  const clayStyle = useMemo(() => {
    if (!active) {
      return {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.04)',
      };
    }

    const { bg, shadowColor } = getCategoryClayColors(category, isDark);
    const borderRadius = 14;

    if (Platform.OS === 'web') {
      return {
        backgroundColor: bg,
        borderRadius,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.45)',
        boxShadow:
          `0px 6px 14px ${shadowColor}26, ` +
          `-4px -4px 10px ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)'}, ` +
          `inset 2px 2px 4px rgba(255, 255, 255, 0.45), ` +
          `inset -2.5px -2.5px 5px rgba(0, 0, 0, 0.16)`
      };
    }

    return {
      backgroundColor: bg,
      borderRadius,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.45)',
      shadowColor,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.45 : 0.28,
      shadowRadius: 10,
      elevation: 4,
    };
  }, [category, active, isDark]);

  return (
    <Pressable
      onPress={() => onNavigate(item.route)}
      onHoverIn={() => {
        scale.value = withTiming(1.02, { duration: 180 });
        translateY.value = withTiming(-2, { duration: 180 });
      }}
      onHoverOut={() => {
        scale.value = withTiming(1, { duration: 180 });
        translateY.value = withTiming(0, { duration: 180 });
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[Platform.OS === 'web' && { cursor: 'pointer' }]}
    >
      <Animated.View
        style={[
          styles.row,
          collapsed && styles.rowCollapsed,
          animStyle,
          clayStyle,
        ]}
      >
        <View style={[
          styles.iconWrap, 
          collapsed && styles.iconWrapCollapsed, 
          active && styles.iconWrapActive,
          active && (Platform.OS === 'web' ? {
            boxShadow: '1px 2px 4px rgba(0,0,0,0.12), inset 1px 1px 2px rgba(255,255,255,0.35)'
          } : {
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 1.5 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1.5
          })
        ]}>
          <Ionicons
            name={item.icon}
            size={20}
            color={
              active
                ? '#FFFFFF'
                : isDark
                  ? 'rgba(255,255,255,0.45)'
                  : 'rgba(15,23,42,0.48)'
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
                <View style={[
                  styles.badge, 
                  { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.9)',
                    borderColor: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.85)',
                    borderWidth: 1,
                    ...(Platform.OS === 'web' ? {
                      boxShadow: '1px 1.5px 3px rgba(0,0,0,0.08), inset 1px 1px 1.5px rgba(255,255,255,0.35)'
                    } : {
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 2,
                      elevation: 1
                    })
                  }
                ]}>
                  <Text style={[styles.badgeText, { color: active ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#0F172A') }]}>
                    {item.badge! > 99 ? '99+' : item.badge}
                  </Text>
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
      </Animated.View>
    </Pressable>
  );
}

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

  const clayBrandPillStyle = useMemo(() => {
    const bg = isDark ? '#3053C4' : '#4A72E6'; // Vibrant clay periwinkle blue
    const shadowColor = isDark ? '#1C318F' : '#253FA3';
    
    if (Platform.OS === 'web') {
      return {
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.45)',
        boxShadow:
          `0px 8px 18px ${shadowColor}33, ` +
          `-4px -4px 10px ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)'}, ` +
          `inset 2px 2px 4px rgba(255, 255, 255, 0.45), ` +
          `inset -2.5px -2.5px 5px rgba(0, 0, 0, 0.16)`
      };
    }

    return {
      backgroundColor: bg,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.45)',
      shadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.45 : 0.28,
      shadowRadius: 12,
      elevation: 6,
    };
  }, [isDark]);

  const clayBrandOrbStyle = useMemo(() => {
    if (Platform.OS === 'web') {
      return {
        backgroundColor: 'rgba(255, 255, 255, 0.22)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.32)',
        boxShadow: '1px 2px 4px rgba(0,0,0,0.12), inset 1px 1px 2px rgba(255,255,255,0.35)'
      };
    }
    return {
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.32)',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1.5 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1.5
    };
  }, []);

  const renderRow = (item: WebSidebarActionItem) => {
    const active = routeIsActive(pathname, item.route);
    return (
      <SidebarRow
        key={item.route}
        item={item}
        collapsed={collapsed}
        active={active}
        isDark={isDark}
        onNavigate={onNavigate}
        styles={styles}
      />
    );
  };

  return (
    <View style={[styles.shell, { width }]}>
      <View
        style={[StyleSheet.absoluteFill, { 
          backgroundColor: isDark ? '#0D1120' : '#F8FAFF',
          borderRightWidth: 1,
          borderRightColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          ...(Platform.OS === 'web' ? {
            boxShadow: isDark ? '3px 0px 10px rgba(0,0,0,0.25)' : '3px 0px 10px rgba(100,116,139,0.08)'
          } : {})
        }]}
      />

      <View style={[styles.topBrand, !collapsed && styles.topBrandExpanded]}>
        <View style={[styles.brandPill, clayBrandPillStyle]}>
          <View style={[styles.brandOrbInner, clayBrandOrbStyle]}>
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
        </View>
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
      overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
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
      marginBottom: 6,
      minHeight: 48,
      position: 'relative',
    },
    rowCollapsed: {
      justifyContent: 'center',
      paddingHorizontal: 0,
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
