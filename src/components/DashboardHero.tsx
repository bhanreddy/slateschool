import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { SCHOOL_CONFIG, schoolTheme } from '../constants/schoolConfig';

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
    /** Optional icon in the date pill for portal theming */
    eyebrowIcon?: keyof typeof Ionicons.glyphMap;
    /** Use school brand tints instead of default indigo */
    useSchoolBranding?: boolean;
}

const CLAY_RADIUS = 28;

function clayRim(top: string, bottom: string, side?: string, width = 1.5): ViewStyle {
    return {
        borderWidth: width,
        borderTopColor: top,
        borderLeftColor: top,
        borderRightColor: side ?? top,
        borderBottomColor: bottom,
    };
}

const DashboardHero: React.FC<DashboardHeroProps> = ({
    eyebrow,
    greeting,
    name,
    subtitle,
    card,
    cardWidth,
    stacks = false,
    eyebrowIcon,
    useSchoolBranding = false,
}) => {
    const { isDark } = useTheme();
    const schoolAccent = SCHOOL_CONFIG.theme.accent ?? '#0D8ECF';
    const schoolPrimary = schoolTheme.light.colors.primary ?? '#665990';

    const clay = useMemo(() => {
        if (isDark) {
            const brandAccent = useSchoolBranding ? '#93C5FD' : '#A5B4FC';
            const brandName = useSchoolBranding ? '#C4B5FD' : '#A5B4FC';
            return {
                base: ['#16121F', '#1E1830', '#261E3C'] as [string, string, string],
                rimTop: 'rgba(255,255,255,0.14)',
                rimSide: 'rgba(255,255,255,0.06)',
                rimBottom: 'rgba(0,0,0,0.40)',
                innerGlow: 'rgba(255,255,255,0.05)',
                innerShadow: 'rgba(0,0,0,0.42)',
                specular: 'rgba(255,255,255,0.16)',
                specularOpacity: 0.35,
                shadow: '#000000',
                shadowOpacity: 0.45,
                orb: useSchoolBranding ? `${schoolPrimary}22` : 'rgba(129,140,248,0.18)',
                pillBg: useSchoolBranding ? `${schoolAccent}22` : 'rgba(99,102,241,0.16)',
                pillTop: 'rgba(255,255,255,0.14)',
                pillBottom: 'rgba(0,0,0,0.28)',
                pillBorder: useSchoolBranding ? `${schoolAccent}40` : 'rgba(129,140,248,0.28)',
                accent: brandAccent,
                title: '#F8FAFC',
                name: brandName,
                subtitle: 'rgba(255,255,255,0.6)',
            };
        }

        const brandAccent = useSchoolBranding ? schoolAccent : '#6366F1';
        const brandName = useSchoolBranding ? schoolPrimary : '#4F46E5';
        return {
            base: ['#FBF9FF', '#F4EEFC', '#EBE3F7'] as [string, string, string],
            rimTop: 'rgba(255,255,255,0.95)',
            rimSide: 'rgba(255,255,255,0.50)',
            rimBottom: 'rgba(107,47,160,0.10)',
            innerGlow: 'rgba(255,255,255,0.65)',
            innerShadow: 'rgba(107,47,160,0.07)',
            specular: 'rgba(255,255,255,0.90)',
            specularOpacity: 0.95,
            shadow: '#C4B5FD',
            shadowOpacity: 0.22,
            orb: useSchoolBranding ? `${schoolPrimary}14` : 'rgba(167,139,250,0.16)',
            pillBg: useSchoolBranding ? `${schoolAccent}12` : 'rgba(255,255,255,0.72)',
            pillTop: 'rgba(255,255,255,0.98)',
            pillBottom: 'rgba(107,47,160,0.08)',
            pillBorder: useSchoolBranding ? `${schoolAccent}28` : 'rgba(167,139,250,0.22)',
            accent: brandAccent,
            title: '#2A1848',
            name: brandName,
            subtitle: 'rgba(42,24,72,0.55)',
        };
    }, [isDark, schoolAccent, schoolPrimary, useSchoolBranding]);

    const styles = useMemo(
        () =>
            StyleSheet.create({
                root: { width: '100%' },
                outerGlow: {
                    width: '100%',
                    borderRadius: CLAY_RADIUS,
                    ...Platform.select({
                        web: {
                            boxShadow: isDark
                                ? '10px 14px 28px rgba(0,0,0,0.45), -6px -6px 18px rgba(255,255,255,0.03), inset 2px 2px 5px rgba(255,255,255,0.06), inset -2px -3px 6px rgba(0,0,0,0.35)'
                                : '10px 14px 28px rgba(196,181,253,0.35), -6px -8px 20px rgba(255,255,255,0.85), inset 2px 2px 6px rgba(255,255,255,0.9), inset -3px -4px 8px rgba(107,47,160,0.08)',
                        } as any,
                        ios: {
                            shadowColor: clay.shadow,
                            shadowOffset: { width: 0, height: 12 },
                            shadowOpacity: clay.shadowOpacity,
                            shadowRadius: 22,
                        },
                        android: { elevation: isDark ? 6 : 5 },
                        default: {
                            shadowColor: clay.shadow,
                            shadowOffset: { width: 0, height: 12 },
                            shadowOpacity: clay.shadowOpacity,
                            shadowRadius: 22,
                        },
                    }),
                },
                panelShell: {
                    width: '100%',
                    borderRadius: CLAY_RADIUS,
                    overflow: 'hidden',
                    ...clayRim(clay.rimTop, clay.rimBottom, clay.rimSide, 1.5),
                },
                orb: {
                    position: 'absolute',
                    right: -60,
                    top: -70,
                    width: 180,
                    height: 180,
                    borderRadius: 90,
                    backgroundColor: clay.orb,
                },
                schoolOrb: { position: 'absolute', left: 12, bottom: 8, opacity: 0.9 },
                topGloss: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '48%',
                },
                innerBottomShadow: {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: '55%',
                },
                specularStreak: {
                    position: 'absolute',
                    top: 10,
                    left: 24,
                    width: 72,
                    height: 3,
                    borderRadius: 99,
                    backgroundColor: clay.specular,
                    opacity: clay.specularOpacity,
                    zIndex: 3,
                },
                content: {
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    zIndex: 2,
                },
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
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    marginBottom: 12,
                    backgroundColor: clay.pillBg,
                    ...clayRim(clay.pillTop, clay.pillBottom, clay.rimSide, 1),
                    ...Platform.select({
                        ios: {
                            shadowColor: clay.shadow,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.12,
                            shadowRadius: 4,
                        },
                        android: { elevation: 1 },
                        web: {
                            boxShadow: isDark
                                ? '2px 3px 6px rgba(0,0,0,0.35), inset 1px 1px 2px rgba(255,255,255,0.08)'
                                : '3px 4px 8px rgba(196,181,253,0.28), inset 1px 1px 3px rgba(255,255,255,0.95)',
                        } as any,
                    }),
                },
                pillDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: clay.accent },
                eyebrow: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.6, color: clay.accent },
                greeting: {
                    fontSize: 26,
                    fontWeight: '800',
                    letterSpacing: -0.6,
                    lineHeight: 32,
                    color: clay.title,
                },
                subtitle: {
                    fontSize: 14,
                    fontWeight: '500',
                    marginTop: 6,
                    color: clay.subtitle,
                },
                cardSlot: { flexShrink: 0 },
            }),
        [clay, isDark],
    );

    return (
        <Animated.View entering={FadeInDown.duration(420)} style={styles.root}>
            <View style={styles.outerGlow}>
                <View style={styles.panelShell}>
                    <LinearGradient
                        colors={[...clay.base]}
                        locations={[0, 0.5, 1]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />

                    <View style={styles.orb} pointerEvents="none" />
                    {useSchoolBranding && (
                        <View style={styles.schoolOrb} pointerEvents="none">
                            <Ionicons
                                name="library-outline"
                                size={52}
                                color={isDark ? 'rgba(255,255,255,0.04)' : `${schoolPrimary}12`}
                            />
                        </View>
                    )}

                    <LinearGradient
                        colors={[clay.innerGlow, 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={styles.topGloss}
                        pointerEvents="none"
                    />
                    <LinearGradient
                        colors={['transparent', clay.innerShadow]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={styles.innerBottomShadow}
                        pointerEvents="none"
                    />
                    <View style={styles.specularStreak} pointerEvents="none" />

                    <View style={styles.content}>
                        <View style={[styles.row, stacks && styles.rowStacked]}>
                            <View style={[styles.copy, !stacks && styles.copyRow]}>
                                <View style={styles.pill}>
                                    {eyebrowIcon ? (
                                        <Ionicons name={eyebrowIcon} size={11} color={clay.accent} />
                                    ) : (
                                        <View style={styles.pillDot} />
                                    )}
                                    <Text style={styles.eyebrow} numberOfLines={1}>
                                        {eyebrow}
                                    </Text>
                                </View>
                                <Text style={styles.greeting} numberOfLines={2}>
                                    {greeting}, <Text style={{ color: clay.name }}>{name}</Text> 👋
                                </Text>
                                {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                            </View>
                            {card != null && (
                                <View
                                    style={[
                                        styles.cardSlot,
                                        { width: stacks ? '100%' : cardWidth },
                                    ]}
                                >
                                    {card}
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

export default DashboardHero;
