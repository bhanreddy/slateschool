import React, { useCallback } from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from '../utils/haptics';
import LogoLoader from './LogoLoader';

interface PremiumButtonProps {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    colors: [string, string, ...string[]]; // Gradient colors
    icon?: React.ReactNode;
    style?: ViewStyle;
    textStyle?: TextStyle;
    /** Button height — default 60; use 48 for compact modals */
    height?: number;
}

const MOTION = {
    duration: { FAST: 150 },
    easing: { SMOOTH: Easing.bezier(0.16, 1, 0.3, 1) },
    spring: { damping: 15, stiffness: 200, mass: 0.8 },
};

const PremiumButton: React.FC<PremiumButtonProps> = ({
    title,
    onPress,
    loading = false,
    disabled = false,
    colors,
    icon,
    style,
    textStyle,
    height = 60,
}) => {
    const scale = useSharedValue(1);

    const handlePressIn = useCallback(() => {
        if (!disabled && !loading) {
            scale.value = withTiming(0.97, { duration: MOTION.duration.FAST, easing: MOTION.easing.SMOOTH });
            if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        }
    }, [disabled, loading]);

    const handlePressOut = useCallback(() => {
        if (!disabled && !loading) {
            scale.value = withSpring(1, MOTION.spring);
        }
    }, [disabled, loading]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={[styles.container, style, animatedStyle]}>
            <Pressable
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || loading}
                style={[styles.touchable, Platform.OS === 'web' && ({ cursor: disabled || loading ? 'not-allowed' : 'pointer' } as any)]}
            >
                <LinearGradient
                    colors={disabled ? ['#E2E8F0', '#CBD5E1'] : colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.gradient, { height }]}
                >
                    {loading ? (
                        <LogoLoader color={disabled ? '#94A3B8' : '#FFFFFF'} />
                    ) : (
                        <>
                            <Text style={[styles.title, disabled && styles.titleDisabled, textStyle]}>
                                {title}
                            </Text>
                            {icon && icon}
                        </>
                    )}
                </LinearGradient>
            </Pressable>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    touchable: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden', // clips gradient to rounded corners
    },
    gradient: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    titleDisabled: {
        color: '#94A3B8',
    },
});

export default PremiumButton;
