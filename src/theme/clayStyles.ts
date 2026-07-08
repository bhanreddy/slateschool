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
    // For a true "pressed in" look, background should match the parent or be very slightly darker.
    const bgColor = isDark ? '#121824' : '#E2E8F0';
    // Deep, sharper shadows for a recessed input cavity (increased depth by 40-50%)
    const innerLo = isDark ? 'rgba(0,0,0,0.75)' : 'rgba(148,163,184,0.55)';
    const innerHi = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)';

    // Focus adds an outer glowing ring, no border
    const focusGlow = isFocused
      ? `, 0 0 0 3px ${isDark ? 'rgba(99,102,241,0.25)' : 'rgba(79,70,229,0.2)'}`
      : '';

    return {
      // Deeper 5px inset with 10px blur for realistic deep cut-out look
      boxShadow: `inset 5px 5px 10px ${innerLo}, inset -5px -5px 10px ${innerHi}${focusGlow}`,
      backgroundColor: bgColor,
      borderWidth: 0,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  }

  return {
    borderWidth: 1,
    borderColor: isFocused
      ? (isDark ? '#6366F1' : '#4F46E5')
      : (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(148,163,184,0.3)'),
    backgroundColor: isDark ? '#121824' : '#E2E8F0',
  };
}
