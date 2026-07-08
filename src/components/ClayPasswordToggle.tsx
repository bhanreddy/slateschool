import React from 'react';
import { Platform, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ADMIN_THEME } from '@/src/constants/adminTheme';

// Fixed coral palette — reads as an action control, distinct from field lavender.
const TOGGLE = {
  coral: ADMIN_THEME.colors.secondary,
  coralSoft: '#FFF0ED',
  coralSoftDark: '#3D2220',
  coralMid: '#E8927C',
  coralDeep: '#C45E4C',
};

function clayToggleBtn(isDark: boolean, active: boolean): ViewStyle {
  if (Platform.OS === 'web') {
    const drop = active
      ? (isDark ? 'rgba(196, 94, 76, 0.45)' : 'rgba(245, 121, 100, 0.28)')
      : (isDark ? 'rgba(61, 34, 32, 0.55)' : 'rgba(245, 121, 100, 0.16)');
    const light = isDark ? 'rgba(245, 121, 100, 0.07)' : 'rgba(255, 255, 255, 0.90)';
    const innerHi = isDark ? 'rgba(245, 121, 100, 0.14)' : 'rgba(255, 255, 255, 0.92)';
    const innerLo = isDark ? 'rgba(30, 15, 12, 0.40)' : 'rgba(245, 121, 100, 0.12)';
    return {
      boxShadow:
        `3px 3px 9px ${drop}, -2px -2px 7px ${light}, ` +
        `inset 1px 1px 2px ${innerHi}, inset -1px -1px 2px ${innerLo}`,
    } as ViewStyle;
  }
  return {
    shadowColor: active ? TOGGLE.coralDeep : (isDark ? '#3D2220' : TOGGLE.coral),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.38 : 0.20,
    shadowRadius: 7,
    elevation: 3,
  };
}

type ClayPasswordToggleProps = {
  visible: boolean;
  onToggle: () => void;
  isDark: boolean;
  /** @deprecated Toggle uses fixed brand coral; kept for API compat */
  accentColor?: string;
};

export default function ClayPasswordToggle({
  visible,
  onToggle,
  isDark,
}: ClayPasswordToggleProps) {
  const iconColor = visible
    ? (isDark ? '#FFF5F2' : '#FFFFFF')
    : (isDark ? TOGGLE.coralMid : TOGGLE.coralDeep);
  const bg = visible
    ? (isDark ? TOGGLE.coralDeep : TOGGLE.coral)
    : (isDark ? TOGGLE.coralSoftDark : TOGGLE.coralSoft);
  const border = visible
    ? (isDark ? TOGGLE.coralMid : TOGGLE.coralDeep)
    : (isDark ? 'rgba(245, 121, 100, 0.28)' : 'rgba(245, 121, 100, 0.32)');

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={({ pressed }) => [
        styles.btn,
        clayToggleBtn(isDark, visible),
        { backgroundColor: bg, borderColor: border },
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={
          visible
            ? [isDark ? TOGGLE.coralMid + 'CC' : '#FFFFFF55', 'transparent']
            : [isDark ? 'rgba(245,121,100,0.14)' : 'rgba(255,255,255,0.75)', 'transparent']
        }
        style={styles.gloss}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <Ionicons
        name={visible ? 'eye-off-outline' : 'eye-outline'}
        size={16}
        color={iconColor}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginLeft: 4,
  },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 16,
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.94 }],
  },
});
