/**
 * LoginShared — Reusable UI primitives shared across every login screen.
 *
 * Exports:
 *   • DecorRing   — translucent decorative circle for the hero background
 *   • FloatingInput — text input with an animated floating label
 *   • LoginAmbientBackground — theme-aware ambient backdrop for auth screens
 *   • LoginCardHeader — consistent portal badge, title, and subtitle block
 *   • SignInButton  — gradient call-to-action button
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import type { TextInputProps } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useLoginTheme, type LoginTheme } from '@/src/hooks/useLoginTheme';

// ─── DecorRing ────────────────────────────────────────────────────────────────

interface DecorRingProps {
  size: number;
  x: number;
  y: number;
  color: string;
  borderWidth?: number;
}

export const DecorRing: React.FC<DecorRingProps> = ({
  size,
  x,
  y,
  color,
  borderWidth: bw,
}) => (
  <View
    style={{
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: size / 2,
      left: x,
      top: y,
      ...(bw
        ? { borderWidth: bw, borderColor: color }
        : { backgroundColor: color }),
    }}
    pointerEvents="none"
  />
);

// ─── FloatingInput ────────────────────────────────────────────────────────────

interface FloatingInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  hasError?: boolean;
  errorText?: string;
  delay?: number;
  rightAction?: React.ReactNode;
}

export const FloatingInput: React.FC<FloatingInputProps> = ({
  label,
  value,
  onChangeText,
  icon,
  hasError,
  errorText,
  delay = 0,
  rightAction,
  ...rest
}) => {
  const C = useLoginTheme();
  const s = makeInputStyles(C);

  const focused = useRef(false);
  const anim = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    if (value) anim.value = withTiming(1, { duration: 200 });
  }, [anim, value]);

  const handleFocus = () => {
    focused.current = true;
    anim.value = withTiming(1, { duration: 200 });
  };

  const handleBlur = () => {
    focused.current = false;
    if (!value) anim.value = withTiming(0, { duration: 200 });
  };

  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: anim.value === 1 ? -12 : 0 },
      { scale: anim.value === 1 ? 0.78 : 1 },
    ],
    color: interpolateColor(
      anim.value,
      [0, 1],
      [C.inkSoft, hasError ? C.error : C.accent],
    ),
  }));

  const borderColor = hasError
    ? C.error
    : focused.current
    ? C.accent
    : C.borderNeutral;

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)}>
      <View
        style={[
          s.inputOuter,
          {
            borderColor,
            backgroundColor: C.surfaceAlt,
            shadowOpacity: focused.current ? 0.08 : 0,
          },
        ]}
      >
        <View style={s.inputIconWrap}>
          <Ionicons
            name={icon}
            size={18}
            color={hasError ? C.error : C.inkSoft}
          />
        </View>
        <View style={s.inputLabelArea}>
          <Animated.Text style={[s.floatingLabel, labelStyle]}>
            {label}
          </Animated.Text>
          <TextInput
            style={s.textInput}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholderTextColor={C.inkGhost}
            {...rest}
          />
        </View>
        {rightAction && <View style={s.inputRightSlot}>{rightAction}</View>}
      </View>
      {hasError && errorText ? (
        <Text style={s.errorLabel}>{errorText}</Text>
      ) : null}
    </Animated.View>
  );
};

const makeInputStyles = (C: LoginTheme) =>
  StyleSheet.create({
    inputOuter: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1.5,
      minHeight: 58,
      paddingHorizontal: 14,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
    },
    inputIconWrap: {
      width: 28,
      alignItems: 'center',
      marginRight: 4,
    },
    inputLabelArea: {
      flex: 1,
      height: 58,
      justifyContent: 'center',
      paddingTop: 14,
    },
    floatingLabel: {
      position: 'absolute',
      left: 0,
      fontSize: 14,
      fontWeight: '500',
      transformOrigin: 'left',
    },
    textInput: {
      fontSize: 15,
      color: C.ink,
      fontWeight: '500',
      paddingVertical: 0,
      height: 26,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    inputRightSlot: {
      paddingLeft: 8,
    },
    errorLabel: {
      fontSize: 11,
      color: C.error,
      marginTop: 5,
      marginLeft: 14,
      fontWeight: '500',
    },
  });

// ─── Ambient Background ───────────────────────────────────────────────────────

export const LoginAmbientBackground: React.FC = () => {
  const C = useLoginTheme();

  return (
    <View style={ambientStyles.wrap} pointerEvents="none">
      <LinearGradient
        colors={
          C.isDark
            ? ['#000000', '#0B0612', '#000000']
            : ['#FFFFFF', '#FBF7FF', '#FFF7ED']
        }
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          ambientStyles.orb,
          ambientStyles.orbTop,
          { backgroundColor: C.isDark ? 'rgba(181,126,220,0.16)' : 'rgba(107,47,160,0.10)' },
        ]}
      />
      <View
        style={[
          ambientStyles.orb,
          ambientStyles.orbBottom,
          { backgroundColor: C.isDark ? 'rgba(255,213,79,0.09)' : 'rgba(245,146,27,0.13)' },
        ]}
      />
      <View
        style={[
          ambientStyles.gridWash,
          { borderColor: C.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(107,47,160,0.05)' },
        ]}
      />
    </View>
  );
};

const ambientStyles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
  },
  orbTop: {
    top: -180,
    right: -120,
  },
  orbBottom: {
    bottom: -210,
    left: -120,
  },
  gridWash: {
    position: 'absolute',
    top: 96,
    left: '8%',
    right: '8%',
    bottom: 48,
    borderWidth: 1,
    borderRadius: 32,
    opacity: 0.8,
  },
});

// ─── LoginCardHeader ──────────────────────────────────────────────────────────

interface LoginCardHeaderProps {
  portalBadge: string;
  tagline?: string;
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export const LoginCardHeader: React.FC<LoginCardHeaderProps> = ({
  portalBadge,
  tagline,
  title,
  subtitle,
  icon = 'shield-checkmark',
}) => {
  const C = useLoginTheme();
  const s = makeHeaderStyles(C);

  return (
    <View style={s.wrap}>
      <View style={s.badgeRow}>
        <View style={s.badge}>
          <Ionicons name={icon} size={13} color={C.accentDark} />
          <Text style={s.badgeText}>{portalBadge}</Text>
        </View>
        {tagline ? (
          <Text style={s.tagline} numberOfLines={1}>
            {tagline}
          </Text>
        ) : null}
      </View>

      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}

      <View style={s.divider} />
    </View>
  );
};

const makeHeaderStyles = (C: LoginTheme) =>
  StyleSheet.create({
    wrap: {
      marginBottom: 22,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: C.accentGlow,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: C.accentBorder,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: C.accentDark,
      letterSpacing: 0.8,
    },
    tagline: {
      flex: 1,
      fontSize: 12,
      color: C.inkSoft,
      fontWeight: '600',
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: C.ink,
      letterSpacing: -0.6,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: C.inkSoft,
      fontWeight: '500',
    },
    divider: {
      height: 1,
      backgroundColor: C.isDark ? 'rgba(255,255,255,0.08)' : C.borderNeutral,
      marginTop: 20,
    },
  });

// ─── SignInButton ─────────────────────────────────────────────────────────────

interface SignInButtonProps {
  onPress: () => void;
  loading?: boolean;
  label?: string;
}

export const SignInButton: React.FC<SignInButtonProps> = ({
  onPress,
  loading,
  label = 'Sign In',
}) => {
  const C = useLoginTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={loading}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        ...C.shadow.md,
        shadowColor: C.accentDeep,
      }}
    >
      <LinearGradient
        colors={[C.accent, C.accentDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={btnStyles.gradient}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Text style={btnStyles.label}>{label}</Text>
            <View style={btnStyles.arrow}>
              <Ionicons name="arrow-forward" size={15} color="#fff" />
            </View>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const btnStyles = StyleSheet.create({
  gradient: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
