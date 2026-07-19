import { Platform } from 'react-native';

export function clay(isDark: boolean, raised: 'sm' | 'md' | 'lg' = 'md'): any {
  const spread = raised === 'lg' ? 30 : raised === 'sm' ? 12 : 20;
  const dy = raised === 'lg' ? 12 : raised === 'sm' ? 6 : 10;
  if (Platform.OS === 'web') {
    const drop = isDark ? 'rgba(0,0,0,0.65)' : 'rgba(148,163,184,0.45)';
    const light = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.9)';
    const innerHi = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)';
    const innerLo = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(148,163,184,0.2)';
    return {
      boxShadow:
        `${dy}px ${dy}px ${spread}px ${drop}, ` +
        `-${dy}px -${dy}px ${spread}px ${light}, ` +
        `inset 2px 2px 4px ${innerHi}, ` +
        `inset -2px -2px 4px ${innerLo}`,
    };
  }
  return {
    elevation: raised === 'lg' ? 10 : 4,
    shadowColor: isDark ? '#000' : '#475569',
    shadowOffset: { width: dy, height: dy },
    shadowOpacity: isDark ? 0.4 : 0.15,
    shadowRadius: spread,
  };
}

export function clayCard(isDark: boolean, raised: 'sm' | 'md' | 'lg' = 'md'): any {
  return {
    backgroundColor: isDark ? '#1A2332' : '#EFF2F9',
    borderRadius: raised === 'lg' ? 32 : 24, // Softer, rounder corners
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
    ...clay(isDark, raised),
  };
}

export function clayInset(isDark: boolean, isFocused: boolean = false): any {
  if (Platform.OS === 'web') {
    // Soft recessed field — light inset only (heavy 5/10px cavities looked broken)
    const bgColor = isDark ? '#121824' : '#F1F5F9';
    const innerLo = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(148,163,184,0.22)';
    const innerHi = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.75)';
    const focusRing = isFocused
      ? `, 0 0 0 2px ${isDark ? 'rgba(236,72,153,0.35)' : 'rgba(236,72,153,0.28)'}`
      : '';

    return {
      boxShadow: `inset 1.5px 1.5px 3px ${innerLo}, inset -1px -1px 2px ${innerHi}${focusRing}`,
      backgroundColor: bgColor,
      borderWidth: 1,
      borderColor: isFocused
        ? (isDark ? 'rgba(236,72,153,0.45)' : 'rgba(244,114,182,0.55)')
        : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(148,163,184,0.22)'),
      transition: 'box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
    };
  }

  return {
    borderWidth: 1.5,
    borderColor: isFocused
      ? (isDark ? '#F472B6' : '#EC4899')
      : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.28)'),
    backgroundColor: isDark ? '#121824' : '#F1F5F9',
  };
}
