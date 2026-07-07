import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

interface DashboardHeroProps {
    /** Uppercase eyebrow shown in the date pill, e.g. "TUESDAY, 7 JULY 2026" */
    eyebrow: string;
    /** Greeting word, e.g. "Hello" or "Good Afternoon" */
    greeting: string;
    name: string;
    subtitle?: string;
    /** The profile card (AdminHeaderCard) rendered on the right / below. Omit for a greeting-only panel. */
    card?: React.ReactNode;
    /** Fixed card width when laid out as a row (wide screens) */
    cardWidth?: number;
    /** Stack greeting above card instead of side by side */
    stacks?: boolean;
}

const LIGHT = {
    panel: ['rgba(255,255,255,0.94)', 'rgba(245,247,255,0.97)', 'rgba(238,242,255,0.82)'],
    border: 'rgba(99,102,241,0.14)',
    orb: 'rgba(129,140,248,0.16)',
    pillBg: 'rgba(99,102,241,0.09)',
    pillBorder: 'rgba(99,102,241,0.18)',
    accent: '#6366F1',
    title: '#0F172A',
    name: '#4F46E5',
    subtitle: 'rgba(15,23,42,0.55)',
} as const;

const DARK = {
    panel: ['rgba(99,102,241,0.16)', 'rgba(20,24,36,0.66)', 'rgba(99,102,241,0.08)'],
    border: 'rgba(255,255,255,0.08)',
    orb: 'rgba(129,140,248,0.18)',
    pillBg: 'rgba(99,102,241,0.16)',
    pillBorder: 'rgba(129,140,248,0.28)',
    accent: '#A5B4FC',
    title: '#F8FAFC',
    name: '#A5B4FC',
    subtitle: 'rgba(255,255,255,0.6)',
} as const;

const DashboardHero: React.FC<DashboardHeroProps> = ({
    eyebrow,
    greeting,
    name,
    subtitle,
    card,
    cardWidth,
    stacks = false,
}) => {
    const { isDark } = useTheme();
    const c = isDark ? DARK : LIGHT;

    return (
        <Animated.View entering={FadeInDown.duration(420)} style={styles.root}>
            <LinearGradient
                colors={c.panel as [string, string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.panel, { borderColor: c.border }]}
            >
                <View style={[styles.orb, { backgroundColor: c.orb }]} pointerEvents="none" />
                <View style={[styles.row, stacks && styles.rowStacked]}>
                    <View style={[styles.copy, !stacks && styles.copyRow]}>
                        <View style={[styles.pill, { backgroundColor: c.pillBg, borderColor: c.pillBorder }]}>
                            <View style={[styles.pillDot, { backgroundColor: c.accent }]} />
                            <Text style={[styles.eyebrow, { color: c.accent }]} numberOfLines={1}>
                                {eyebrow}
                            </Text>
                        </View>
                        <Text style={[styles.greeting, { color: c.title }]} numberOfLines={2}>
                            {greeting}, <Text style={{ color: c.name }}>{name}</Text> 👋
                        </Text>
                        {!!subtitle && (
                            <Text style={[styles.subtitle, { color: c.subtitle }]}>{subtitle}</Text>
                        )}
                    </View>
                    {card != null && (
                        <View style={{ width: stacks ? '100%' : cardWidth, flexShrink: 0 }}>{card}</View>
                    )}
                </View>
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    root: { width: '100%' },
    panel: {
        borderRadius: 28,
        borderWidth: 1,
        padding: 22,
        overflow: 'hidden',
        ...Platform.select({
            web: { boxShadow: '0 18px 45px rgba(79,70,229,0.10)' } as any,
            default: {
                shadowColor: '#4F46E5',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.1,
                shadowRadius: 24,
                elevation: 4,
            },
        }),
    },
    orb: { position: 'absolute', right: -60, top: -70, width: 180, height: 180, borderRadius: 90 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 24 },
    rowStacked: { flexDirection: 'column', alignItems: 'stretch' },
    copy: { minWidth: 0, zIndex: 2 },
    copyRow: { flex: 1 },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        maxWidth: '100%',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
        marginBottom: 12,
    },
    pillDot: { width: 5, height: 5, borderRadius: 2.5 },
    eyebrow: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.6 },
    greeting: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, lineHeight: 32 },
    subtitle: { fontSize: 14, fontWeight: '500', marginTop: 6 },
});

export default DashboardHero;
