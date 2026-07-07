import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from '../utils/haptics';
import { useRouter } from 'expo-router';

import MenuOverlay from './MenuOverlay';
import { SCHOOL_CONFIG } from '../constants/schoolConfig';
import { SCHOOL_NAME } from '../constants/school';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radii } from '../theme/themes';

import Animated, { SharedValue, useAnimatedStyle, interpolateColor, interpolate, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StaffHeaderProps {
    title: string;
    subtitle?: string;
    showMenuButton?: boolean;
    showProfileButton?: boolean;
    showBackButton?: boolean;
    onMenuPress?: () => void;
    onBack?: () => void;
    scrollY?: SharedValue<number>;
}

const StaffHeader: React.FC<StaffHeaderProps> = ({
    title = SCHOOL_NAME,
    subtitle,
    showMenuButton = true,
    showProfileButton = true,
    showBackButton = false,
    onMenuPress,
    onBack,
    scrollY
}) => {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const [menuVisible, setMenuVisible] = useState(false);
    const insets = useSafeAreaInsets();

    const handleMenuPress = () => {
        if (onMenuPress) {
            onMenuPress();
        } else {
            setMenuVisible(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const animatedStyle = useAnimatedStyle(() => {
        if (!scrollY) return { backgroundColor: theme.colors.background, shadowOpacity: 0.1 };

        const bgColor = interpolateColor(
            scrollY.value,
            [0, 50],
            ['rgba(255,255,255,0)', isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)']
        );
        const shadowOpacity = interpolate(
            scrollY.value,
            [0, 50],
            [0, 0.1],
            Extrapolation.CLAMP
        );
        return {
            backgroundColor: bgColor,
            shadowOpacity,
            borderBottomColor: theme.colors.borderLight,
            borderBottomWidth: interpolate(scrollY.value, [0, 50], [0, 1], Extrapolation.CLAMP)
        };
    });

    const isAbsolute = !!scrollY;
    const isWeb = Platform.OS === 'web';
    const showNavBack = showBackButton || isWeb;
    const showNavMenu = showMenuButton && (!showBackButton || isWeb);

    const runBack = () => {
        if (onBack) onBack();
        else if (router.canGoBack()) router.back();
        else router.push('/staff/dashboard' as any);
    };

    return (
        <Animated.View style={[
            styles.container,
            { paddingTop: insets.top },
            isAbsolute && styles.absoluteHeader,
            animatedStyle
        ]}>
            <View style={styles.contentRow}>
                {/* Left: native = menu on home, back on inner; web = both when menu enabled */}
                <View style={[styles.leftSection, showNavBack && showNavMenu && styles.leftSectionDual]}>
                    {showNavBack ? (
                        <Pressable
                            onPress={runBack}
                            style={[styles.iconButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.borderLight }, Platform.OS === 'web' && { cursor: 'pointer' }]}
                        >
                            <Ionicons name="arrow-back" size={20} color={theme.colors.textStrong} />
                        </Pressable>
                    ) : null}
                    {showNavMenu ? (
                        <Pressable
                            onPress={handleMenuPress}
                            style={[styles.iconButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.borderLight }, Platform.OS === 'web' && { cursor: 'pointer' }]}
                        >
                            <Feather name="menu" size={20} color={theme.colors.textStrong} />
                        </Pressable>
                    ) : null}
                </View>

                {/* Center: Branding (Clean) */}
                <View style={styles.centerSection}>
                    <Text style={[styles.title, { color: theme.colors.textStrong }]}>{title}</Text>
                    {subtitle && (
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
                    )}
                </View>

                {/* Right: Actions */}
                <View style={styles.rightSection}>
                    {showProfileButton && (
                        <Pressable
                            onPress={() => router.push('/staff/settings' as any)}
                            style={[styles.profileButton, Platform.OS === 'web' && { cursor: 'pointer' }]}
                        >
                            <View style={{
                                width: 32, height: 32, borderRadius: 16,
                                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9',
                                alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: theme.colors.border
                            }}>
                                <Ionicons name="settings-outline" size={20} color={theme.colors.textSecondary} />
                            </View>
                        </Pressable>
                    )}
                </View>
            </View>

            <MenuOverlay visible={menuVisible} onClose={() => setMenuVisible(false)} userType="staff" />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 50,
    },
    leftSection: {
        width: 80,
        alignItems: 'flex-start',
    },
    leftSectionDual: {
        width: 96,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    centerSection: {
        flex: 1,
        alignItems: 'center',
    },
    rightSection: {
        width: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: Radii.sm,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '500',
    },
    profileButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    absoluteHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    }
});

export default StaffHeader;