import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Pressable, StyleSheet, Dimensions, Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { useStaffPortalConfig } from '../hooks/useStaffPortalConfig';
import { BusAttendanceService } from '../services/busAttendanceService';
import * as Haptics from '../utils/haptics';

const { width } = Dimensions.get('window');

const TAB_CONFIG: Record<string, { icon: string; iconActive: string; label: string }> = {
    'trip': { icon: 'navigate-outline', iconActive: 'navigate', label: 'Trip' },
    'dashboard': { icon: 'bus-outline', iconActive: 'bus', label: 'Route' },
    'students': { icon: 'people-outline', iconActive: 'people', label: 'Students' },
    'bus-attendance': { icon: 'clipboard-outline', iconActive: 'clipboard', label: 'Attend' },
    'payslip': { icon: 'wallet-outline', iconActive: 'wallet', label: 'Pay' },
    'profile': { icon: 'person-outline', iconActive: 'person', label: 'Profile' },
};

const ORDERED_TABS = ['trip', 'dashboard', 'students', 'bus-attendance', 'payslip', 'profile'];
const ALLOW_REAL_BLUR = Platform.OS === 'ios';

export default function DriverFooter({ state, navigation }: MaterialTopTabBarProps) {
    const { t } = useTranslation();
    const { theme, isDark } = useTheme();
    const { payslipsEnabled } = useStaffPortalConfig();
    const [busAttendanceEnabled, setBusAttendanceEnabled] = React.useState(false);

    React.useEffect(() => {
        BusAttendanceService.isEnabled()
            .then(res => setBusAttendanceEnabled(res?.enabled))
            .catch(() => setBusAttendanceEnabled(false));
    }, []);

    let orderedTabs = ORDERED_TABS;
    if (!payslipsEnabled) {
        orderedTabs = orderedTabs.filter((tab) => tab !== 'payslip');
    }
    if (!busAttendanceEnabled) {
        orderedTabs = orderedTabs.filter((tab) => tab !== 'bus-attendance');
    }

    const visibleRoutes = state.routes
        .filter(route => orderedTabs.includes(route.name))
        .sort((a, b) => orderedTabs.indexOf(a.name) - orderedTabs.indexOf(b.name));

    const currentRouteName = state.routes[state.index].name;
    const activeIndex = visibleRoutes.findIndex(route => route.name === currentRouteName);
    const isFooterVisible = activeIndex !== -1;

    const totalTabs = visibleRoutes.length;
    const tabWidth = (width - 32) / (totalTabs || 1);

    const indicatorPosition = useSharedValue(0);

    useEffect(() => {
        if (activeIndex !== -1) {
            indicatorPosition.value = withSpring(activeIndex * tabWidth, {
                damping: 16,
                stiffness: 160,
            });
        }
    }, [activeIndex, tabWidth, indicatorPosition]);

    const indicatorStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: indicatorPosition.value }],
            width: tabWidth,
            opacity: withTiming(isFooterVisible ? 1 : 0, { duration: 160 }),
        };
    });

    const styles = useMemo(() => StyleSheet.create({
        container: {
            position: 'absolute',
            bottom: theme.spacing.lg,
            left: theme.spacing.md,
            right: theme.spacing.md,
            alignItems: 'center',
        },
        barWrapper: {
            flexDirection: 'row',
            width: '100%',
            height: 68,
            borderRadius: 24,
            overflow: 'hidden',
            ...Platform.select({
                ios: {
                    shadowColor: theme.colors.primaryDark,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.18,
                    shadowRadius: 16,
                },
                android: { elevation: 6 },
                default: {},
            }),
        },
        fakeGlass: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)',
        },
        barContent: {
            flexDirection: 'row',
            width: '100%',
            height: '100%',
            alignItems: 'center',
            paddingHorizontal: 0,
            borderWidth: 1,
            borderRadius: 24,
        },
        activeIndicatorContainer: {
            position: 'absolute',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 0,
        },
        activeIndicator: {
            width: '78%',
            height: 52,
            borderRadius: 18,
        },
        tabItem: {
            flex: 1,
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1,
            flexDirection: 'column',
            gap: 2,
            minWidth: 48,
        },
        iconContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            height: 26,
        },
        label: {
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.15,
        },
    }), [theme, isDark]);

    return (
        <View style={styles.container} pointerEvents="box-none">
            <View style={styles.barWrapper}>
                {ALLOW_REAL_BLUR ? (
                    <BlurView
                        intensity={80}
                        tint={isDark ? 'dark' : 'light'}
                        style={StyleSheet.absoluteFill}
                    />
                ) : (
                    <View style={styles.fakeGlass} />
                )}
                <LinearGradient
                    colors={isDark
                        ? ['rgba(30, 41, 59, 0.55)', 'rgba(15, 23, 42, 0.72)']
                        : ['rgba(255, 255, 255, 0.55)', 'rgba(248, 250, 252, 0.78)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.barContent, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)' }]}
                >
                    <Animated.View style={[styles.activeIndicatorContainer, indicatorStyle]}>
                        <LinearGradient
                            colors={[theme.colors.primary, theme.colors.primaryDark]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.activeIndicator}
                        />
                    </Animated.View>

                    {visibleRoutes.map((route) => {
                        const config = TAB_CONFIG[route.name] || { icon: 'ellipse', iconActive: 'ellipse', label: 'Tab' };
                        const isFocused = currentRouteName === route.name;

                        const onPress = () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });
                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate(route.name, route.params);
                            }
                        };

                        return (
                            <Pressable
                                key={route.key}
                                onPress={onPress}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: isFocused }}
                                accessibilityLabel={t(`driver_ui.${route.name}`, config.label)}
                                style={({ pressed }) => [
                                    styles.tabItem,
                                    Platform.OS === 'web' && { cursor: 'pointer' },
                                    pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
                                ]}
                            >
                                <View style={styles.iconContainer}>
                                    <Ionicons
                                        name={(isFocused ? config.iconActive : config.icon) as any}
                                        size={22}
                                        color={isFocused ? theme.colors.surface : theme.colors.textSecondary}
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.label,
                                        { color: isFocused ? theme.colors.surface : theme.colors.textMuted },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {t(`driver_ui.${route.name}_short`, config.label)}
                                </Text>
                            </Pressable>
                        );
                    })}
                </LinearGradient>
            </View>
        </View>
    );
}
