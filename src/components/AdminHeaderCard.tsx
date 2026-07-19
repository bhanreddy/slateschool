import React, { useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    Pressable,
    Platform,
    ViewStyle,
    useWindowDimensions,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withSequence,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { SCHOOL_CONFIG } from '../constants/schoolConfig';
import { useTheme } from '../hooks/useTheme';
import { useQuickAccountSwitch } from '../hooks/useQuickAccountSwitch';
import QuickAccountPickerSheet from './QuickAccountPickerSheet';

const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/4333/4333609.png';
const SCHOOL_IMAGE = require('../../assets/images/schoolImage.png');
const SCHOOL_ASPECT = 16 / 9;

/** Faint school-themed icons layered behind card content */
function SchoolDecorIcons({
    isDark,
    accent,
    gold,
    compact,
}: {
    isDark: boolean;
    accent: string;
    gold: string;
    compact?: boolean;
}) {
    const iconColor = isDark ? 'rgba(255,255,255,0.11)' : `${accent}30`;
    const goldSoft = isDark ? `${gold}44` : `${gold}55`;
    return (
        <>
            <View style={{ position: 'absolute', top: compact ? 8 : 14, right: 14 }} pointerEvents="none">
                <Ionicons name="school-outline" size={compact ? 22 : 30} color={iconColor} />
            </View>
            <View style={{ position: 'absolute', top: compact ? 38 : 48, right: 52 }} pointerEvents="none">
                <Ionicons name="book-outline" size={14} color={iconColor} />
            </View>
            <View style={{ position: 'absolute', bottom: 20, right: 36 }} pointerEvents="none">
                <Ionicons name="pencil" size={13} color={goldSoft} />
            </View>
            <View style={{ position: 'absolute', bottom: 16, left: '42%' }} pointerEvents="none">
                <MaterialCommunityIcons name="certificate-outline" size={16} color={iconColor} />
            </View>
        </>
    );
}

const DOUBLE_TAP_MS = 320;
const LONG_PRESS_MS = 450;
const CLAY_RADIUS = 32;
const SCHOOL_IMAGE_RADIUS = 18;

const PRESS_SPRING = { damping: 15, stiffness: 240 }; // Snappier premium physics

interface AdminHeaderCardProps {
    displayName?: string;
    photoUrl?: string | null;
    roleLabel?: string;
    staffCode?: string | null;
    onAccountSwitched?: () => void | Promise<void>;
    /** Login screens: same clay card, school branding instead of user profile */
    variant?: 'profile' | 'login';
    portalBadge?: string;
    tagline?: string;
    /** Student home: greeting already shows name+class, so drop them here and keep a tight badge strip */
    compact?: boolean;
    /** In compact mode, keep the role line (when the greeting shows a date/name but not the role, e.g. accounts) */
    compactRole?: boolean;
    /** Nested inside DashboardHero — drop outer margin/elevation so the parent clay shell owns depth */
    embedded?: boolean;
    /** Driver / on-duty surfaces: strip decorative chrome, keep identity + account switch */
    dense?: boolean;
}

// Enhanced clay rim generator with thicker, smoother highlight distribution
function clayRim(top: string, bottom: string, side?: string, width = 1.5): ViewStyle {
    return {
        borderWidth: width,
        borderTopColor: top,
        borderLeftColor: top,
        borderRightColor: side ?? top,
        borderBottomColor: bottom,
    };
}

const AdminHeaderCard: React.FC<AdminHeaderCardProps> = ({
    displayName,
    photoUrl,
    roleLabel = 'Administrator',
    staffCode,
    onAccountSwitched,
    variant = 'profile',
    portalBadge = 'ADMIN',
    tagline,
    compact = false,
    compactRole = false,
    embedded = false,
    dense = false,
}) => {
    const isLogin = variant === 'login';
    const { t } = useTranslation();
    const { theme, isDark } = useTheme();
    const { width: screenW } = useWindowDimensions();
    const isWide = screenW >= 768;

    const schoolImageStyle = useMemo(() => {
        if (isLogin) {
            const imgW = isWide ? 190 : Math.min(screenW * 0.34, 168);
            return {
                width: imgW,
                height: imgW / SCHOOL_ASPECT,
                right: 10,
                bottom: -6,
            };
        }
        const imgW = isWide ? Math.min(screenW * 0.38, 420) : screenW * 0.52;
        return {
            width: imgW,
            height: imgW / SCHOOL_ASPECT,
            right: isWide ? -imgW * 0.08 : -imgW * 0.06,
            bottom: isWide ? -12 : -16,
        };
    }, [isLogin, isWide, screenW]);

    const lastTapRef = useRef(0);
    const longPressTriggeredRef = useRef(false);
    const cardScale = useSharedValue(1);
    const avatarScale = useSharedValue(1);
    const [busyUserId, setBusyUserId] = React.useState<string | null>(null);

    const {
        accounts,
        activeId,
        sheetOpen,
        switching,
        switchToNext,
        switchTo,
        openSheet,
        closeSheet,
    } = useQuickAccountSwitch(onAccountSwitched);

    const accent = SCHOOL_CONFIG.theme.ribbonGradient[1] || '#6B2FA0';
    const gold = SCHOOL_CONFIG.theme.accent;
    const schoolCerulean = SCHOOL_CONFIG.theme.accent ?? '#0D8ECF';
    const ribbonStart = SCHOOL_CONFIG.theme.ribbonGradient[0] ?? accent;

    const clay = useMemo(
        () =>
            isDark
                ? {
                      base: ['#16121F', '#1E1830', '#261E3C'] as [string, string, string],
                      baseMid: '#221A32',
                      baseDeep: '#1A1428',
                      accent: theme.colors.primaryLight,
                      specular: 'rgba(255,255,255,0.16)',
                      innerGlow: 'rgba(255,255,255,0.05)',
                      innerShadow: 'rgba(0,0,0,0.42)',
                      rimTop: 'rgba(255,255,255,0.14)',
                      rimSide: 'rgba(255,255,255,0.06)',
                      rimBottom: 'rgba(0,0,0,0.40)',
                      shadow: '#000000',
                      title: theme.colors.textStrong,
                      subtitle: theme.colors.textSecondary,
                      pillBg: 'rgba(255,255,255,0.08)',
                      pillTop: 'rgba(255,255,255,0.14)',
                      pillBottom: 'rgba(0,0,0,0.28)',
                      orbA: 'rgba(107,47,160,0.22)',
                      orbB: `${schoolCerulean}18`,
                      orbC: `${gold}12`,
                      gold,
                      avatarRing: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)'] as [string, string],
                      avatarInner: 'rgba(0,0,0,0.28)',
                      logoWrap: 'rgba(255,255,255,0.10)',
                      schoolImageOpacity: 0.58,
                      specularOpacity: 0.35,
                      shadowOpacity: 0.45,
                  }
                : {
                      base: ['#FBF9FF', '#F4EEFC', '#EBE3F7'] as [string, string, string],
                      baseMid: '#F0E8FA',
                      baseDeep: '#F4EEFC',
                      accent,
                      specular: 'rgba(255,255,255,0.90)',
                      innerGlow: 'rgba(255,255,255,0.65)',
                      innerShadow: 'rgba(107,47,160,0.07)',
                      rimTop: 'rgba(255,255,255,0.95)',
                      rimSide: 'rgba(255,255,255,0.50)',
                      rimBottom: 'rgba(107,47,160,0.10)',
                      shadow: '#C4B5FD',
                      title: '#2A1848',
                      subtitle: 'rgba(42,24,72,0.58)',
                      pillBg: 'rgba(255,255,255,0.75)',
                      pillTop: 'rgba(255,255,255,0.98)',
                      pillBottom: 'rgba(107,47,160,0.08)',
                      orbA: 'rgba(167,139,250,0.14)',
                      orbB: `${schoolCerulean}16`,
                      orbC: `${gold}14`,
                      gold,
                      avatarRing: ['rgba(255,255,255,0.85)', 'rgba(235,227,247,0.55)'] as [string, string],
                      avatarInner: 'rgba(107,47,160,0.06)',
                      logoWrap: 'rgba(255,255,255,0.85)',
                      schoolImageOpacity: 0.88,
                      specularOpacity: 0.95,
                      shadowOpacity: 0.22,
                  },
        [accent, gold, isDark, schoolCerulean, theme.colors.primaryLight, theme.colors.textSecondary, theme.colors.textStrong],
    );

    const cardAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
    }));

    const avatarAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: avatarScale.value }],
    }));

    const playSwitchAnimation = useCallback(() => {
        avatarScale.value = withSequence(
            withTiming(0.9, { duration: 80 }),
            withSpring(1.06, PRESS_SPRING),
            withSpring(1, PRESS_SPRING),
        );
    }, [avatarScale]);

    const handleAvatarPress = useCallback(() => {
        if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
        }
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
            lastTapRef.current = 0;
            void (async () => {
                setBusyUserId(activeId);
                const switched = await switchToNext();
                if (switched) playSwitchAnimation();
                setBusyUserId(null);
            })();
        } else {
            lastTapRef.current = now;
            avatarScale.value = withSequence(
                withTiming(0.94, { duration: 70 }),
                withSpring(1, PRESS_SPRING),
            );
        }
    }, [activeId, avatarScale, playSwitchAnimation, switchToNext]);

    const handleCardPressIn = useCallback(() => {
        cardScale.value = withSpring(0.975, PRESS_SPRING);
    }, [cardScale]);

    const handleCardPressOut = useCallback(() => {
        cardScale.value = withSpring(1, PRESS_SPRING);
    }, [cardScale]);

    const handleLongPress = useCallback(() => {
        longPressTriggeredRef.current = true;
        openSheet();
    }, [openSheet]);

    const handleSelectAccount = useCallback(
        async (userId: string) => {
            setBusyUserId(userId);
            const ok = await switchTo(userId);
            if (ok) playSwitchAnimation();
            setBusyUserId(null);
        },
        [playSwitchAnimation, switchTo],
    );

    const avatarUri = photoUrl || FALLBACK_AVATAR;
    const accountCount = accounts.length;
    const schoolName = t('schoolRibbon.brandName', { defaultValue: SCHOOL_CONFIG.name });
    const resolvedName = displayName ?? schoolName;
    const resolvedRole = isLogin ? (tagline ?? roleLabel) : roleLabel;
    const badgeLabel = portalBadge ?? 'ADMIN';

    const styles = useMemo(
        () =>
            StyleSheet.create({
                wrapper: {
                    marginTop: embedded ? 0 : theme.spacing.md,
                    paddingHorizontal: embedded ? 0 : 4,
                    width: '100%',
                },
                outerGlow: {
                    width: '100%',
                    borderRadius: CLAY_RADIUS,
                    ...(embedded
                        ? Platform.select({
                              web: {
                                  boxShadow: isDark
                                      ? '4px 6px 14px rgba(0,0,0,0.35), inset 2px 2px 4px rgba(255,255,255,0.06), inset -2px -3px 6px rgba(0,0,0,0.3)'
                                      : '4px 8px 16px rgba(196,181,253,0.28), inset 2px 2px 5px rgba(255,255,255,0.9), inset -2px -3px 6px rgba(107,47,160,0.08)',
                              } as any,
                              ios: {
                                  shadowColor: clay.shadow,
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: clay.shadowOpacity * 0.7,
                                  shadowRadius: 10,
                              },
                              android: { elevation: 2 },
                              default: {
                                  shadowColor: clay.shadow,
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: clay.shadowOpacity * 0.7,
                                  shadowRadius: 10,
                              },
                          })
                        : Platform.select({
                              web: {
                                  boxShadow: isDark
                                      ? '10px 14px 28px rgba(0,0,0,0.45), -6px -6px 18px rgba(255,255,255,0.03), inset 2px 2px 5px rgba(255,255,255,0.06), inset -2px -3px 6px rgba(0,0,0,0.35)'
                                      : '10px 14px 28px rgba(196,181,253,0.35), -6px -8px 20px rgba(255,255,255,0.85), inset 2px 2px 6px rgba(255,255,255,0.9), inset -3px -4px 8px rgba(107,47,160,0.08)',
                              } as any,
                              ios: {
                                  shadowColor: clay.shadow,
                                  shadowOffset: { width: 0, height: 10 },
                                  shadowOpacity: clay.shadowOpacity,
                                  shadowRadius: 24,
                              },
                              android: { elevation: isDark ? 6 : 5 },
                              default: {
                                  shadowColor: clay.shadow,
                                  shadowOffset: { width: 0, height: 10 },
                                  shadowOpacity: clay.shadowOpacity,
                                  shadowRadius: 24,
                              },
                          })),
                },
                cardShell: {
                    width: '100%',
                    borderRadius: CLAY_RADIUS,
                    overflow: 'hidden',
                    ...clayRim(clay.rimTop, clay.rimBottom, clay.rimSide, 1.5),
                },
                orb: { position: 'absolute', borderRadius: 999 },
                orbA: {
                    width: 140,
                    height: 140,
                    backgroundColor: clay.orbA,
                    top: -44,
                    left: '18%',
                },
                orbB: {
                    width: 90,
                    height: 90,
                    backgroundColor: clay.orbB,
                    bottom: -26,
                    left: 36,
                },
                orbC: {
                    width: 56,
                    height: 56,
                    backgroundColor: clay.orbC,
                    top: 28,
                    right: 72,
                },
                // Molded inner bottom shadow
                innerBottomShadow: {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: '60%',
                },
                // Inflated top specular reflection
                topGloss: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '45%',
                },
                // Concentrated light bounce
                specularStreak: {
                    position: 'absolute',
                    top: 9,
                    left: 28,
                    width: 64,
                    height: 3,
                    borderRadius: 99,
                    backgroundColor: clay.specular,
                    opacity: clay.specularOpacity,
                },
                schoolAtmosphere: {
                    ...StyleSheet.absoluteFillObject,
                    overflow: 'hidden',
                    borderRadius: CLAY_RADIUS,
                },
                schoolImageClip: {
                    position: 'absolute',
                    overflow: 'hidden',
                    borderRadius: SCHOOL_IMAGE_RADIUS,
                    ...clayRim(clay.pillTop, clay.pillBottom, clay.rimSide, 1),
                },
                schoolImage: {
                    width: '100%',
                    height: '100%',
                    opacity: isLogin ? clay.schoolImageOpacity * 0.55 : clay.schoolImageOpacity,
                    resizeMode: 'cover',
                },
                schoolColorWash: {
                    ...StyleSheet.absoluteFillObject,
                },
                schoolDissolveH: {
                    ...StyleSheet.absoluteFillObject,
                },
                schoolDissolveTop: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '38%',
                },
                schoolDissolveBottom: {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: '42%',
                },
                schoolDissolveRight: {
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: isLogin ? '42%' : '22%',
                },
                content: {
                    paddingHorizontal: 22,
                    paddingVertical: 18,
                    zIndex: 2,
                    minHeight: isLogin ? (isWide ? 118 : 108) : isWide ? 104 : 92,
                    justifyContent: 'center',
                    ...(isLogin ? { paddingRight: 28 } : null),
                },
                contentDense: {
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    minHeight: 72,
                },
                topRow: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12,
                },
                schoolBadge: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
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
                    }),
                },
                schoolLogoWrap: {
                    width: 22,
                    height: 22,
                    borderRadius: 8,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: clay.logoWrap,
                    ...clayRim(clay.pillTop, clay.pillBottom, clay.rimSide, 0.5),
                },
                schoolLogo: { width: 14, height: 14, resizeMode: 'contain' },
                schoolName: {
                    marginLeft: 8,
                    fontSize: 10,
                    fontWeight: '800',
                    color: clay.accent,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    flexShrink: 1,
                },
                schoolAccentRibbon: {
                    position: 'absolute',
                    top: 10,
                    left: 28,
                    right: 28,
                    height: 3,
                    borderRadius: 99,
                    zIndex: 4,
                },
                profileRow: { flexDirection: 'row', alignItems: 'center' },
                profileRowDense: { gap: 12 },
                nameDense: { fontSize: 17, marginBottom: 2 },
                avatarPressable: { borderRadius: 22 },
                // 3D puffy ring container for avatar
                avatarRing: {
                    width: 60,
                    height: 60,
                    borderRadius: 22,
                    padding: 3,
                    backgroundColor: clay.pillBg,
                    ...clayRim(clay.pillTop, clay.pillBottom, clay.rimSide, 1.5),
                },
                avatarInner: {
                    flex: 1,
                    borderRadius: 18,
                    overflow: 'hidden',
                    backgroundColor: clay.avatarInner,
                },
                avatar: { width: '100%', height: '100%' },
                logoAvatar: { width: '62%', height: '62%', resizeMode: 'contain', alignSelf: 'center', marginTop: '19%' },
                onlineDot: {
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    backgroundColor: '#10B981',
                    borderWidth: 2.5,
                    borderColor: clay.baseMid,
                },
                switchBadge: {
                    position: 'absolute',
                    top: -5,
                    right: -6,
                    minWidth: 19,
                    height: 19,
                    borderRadius: 10,
                    paddingHorizontal: 4,
                    backgroundColor: clay.accent,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...clayRim('rgba(255,255,255,0.35)', 'rgba(0,0,0,0.12)', undefined, 1),
                },
                switchBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900', marginLeft: 1 },
                info: { flex: 1, marginLeft: 16, minWidth: 0 },
                name: {
                    fontSize: isWide ? 20 : 18,
                    fontWeight: '800',
                    color: clay.title,
                    letterSpacing: -0.2,
                },
                roleRow: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 3,
                    gap: 8,
                },
                loginRoleBlock: {
                    marginTop: 6,
                    gap: 6,
                    alignSelf: 'stretch',
                },
                role: {
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    fontWeight: '600',
                    color: clay.subtitle,
                },
                roleCompact: {
                    fontSize: 13,
                    fontWeight: '600',
                    color: clay.subtitle,
                    marginTop: 3,
                },
                loginTagline: {
                    fontSize: 13,
                    fontWeight: '600',
                    color: clay.subtitle,
                    lineHeight: 18,
                    paddingRight: 4,
                },
                crownPill: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                    backgroundColor: `${gold}20`,
                    ...clayRim(`${gold}45`, `${gold}12`, clay.rimSide, 0.5),
                    flexShrink: 0,
                },
                crownPillLogin: {
                    alignSelf: 'flex-start',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                },
                crownText: {
                    fontSize: 8.5,
                    fontWeight: '900',
                    color: gold,
                    letterSpacing: 0.5,
                },
                crownTextLogin: {
                    fontSize: 9.5,
                    letterSpacing: 0.8,
                },
                chipsRow: {
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    marginTop: 10,
                    gap: 8,
                },
                chipsRowCompact: { marginTop: 0 },
                chip: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 12,
                    backgroundColor: clay.pillBg,
                    ...clayRim(clay.pillTop, clay.pillBottom, clay.rimSide, 1),
                },
                chipText: {
                    marginLeft: 6,
                    fontSize: 10.5,
                    fontWeight: '700',
                    color: clay.title,
                },
                switchHint: {
                    marginTop: 8,
                    fontSize: 10,
                    fontWeight: '600',
                    color: clay.subtitle,
                },
            }),
        [clay, embedded, gold, isDark, isLogin, isWide, theme],
    );

    return (
        <>
            <Animated.View entering={FadeInDown.duration(520).springify()} style={styles.wrapper}>
                <Animated.View style={[styles.outerGlow, cardAnimatedStyle]}>
                    <View style={styles.cardShell}>
                        {/* Primary Base Background Gradient */}
                        <LinearGradient
                            colors={[...clay.base]}
                            locations={[0, 0.5, 1]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />

                        {/* Volumetric Depth Elements */}
                        <View style={[styles.orb, styles.orbA]} pointerEvents="none" />
                        <View style={[styles.orb, styles.orbB]} pointerEvents="none" />
                        <View style={[styles.orb, styles.orbC]} pointerEvents="none" />

                        {/* School-brand accent ribbon */}
                        {!isLogin && (
                            <LinearGradient
                                colors={[gold, schoolCerulean, ribbonStart]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.schoolAccentRibbon}
                                pointerEvents="none"
                            />
                        )}

                        {/* Claymorphic Bottom Inset Shadow */}
                        <LinearGradient
                            colors={['transparent', clay.innerShadow]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.innerBottomShadow}
                            pointerEvents="none"
                        />

                        {/* Claymorphic Top Inset Glow/Reflection */}
                        <LinearGradient
                            colors={[clay.innerGlow, 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.topGloss}
                            pointerEvents="none"
                        />

                        {/* Strong Specular Highlight Point */}
                        <View style={styles.specularStreak} pointerEvents="none" />

                        {/* School illustration — atmospheric dissolve across full card */}
                        {!dense && (
                        <View style={styles.schoolAtmosphere} pointerEvents="none">
                            <SchoolDecorIcons isDark={isDark} accent={schoolCerulean} gold={gold} compact={compact} />
                            <View style={[styles.schoolImageClip, schoolImageStyle]}>
                                <Image source={SCHOOL_IMAGE} style={styles.schoolImage} />
                            </View>

                            {/* Soft tint — merge illustration into pastel clay */}
                            <LinearGradient
                                colors={[
                                    `${clay.baseDeep}00`,
                                    `${clay.baseMid}88`,
                                    `${clay.base[2]}99`,
                                ]}
                                locations={[0.2, 0.65, 1]}
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                style={styles.schoolColorWash}
                            />

                            <LinearGradient
                                colors={[
                                    clay.base[0],
                                    clay.base[0],
                                    `${clay.base[0]}F5`,
                                    `${clay.baseMid}DD`,
                                    `${clay.baseMid}99`,
                                    `${clay.base[2]}55`,
                                    'transparent',
                                ]}
                                locations={[0, 0.18, 0.32, 0.48, 0.62, 0.78, 1]}
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                style={styles.schoolDissolveH}
                            />

                            <LinearGradient
                                colors={[clay.base[0], `${clay.base[0]}BB`, 'transparent']}
                                locations={[0, 0.35, 1]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                                style={styles.schoolDissolveTop}
                            />

                            <LinearGradient
                                colors={['transparent', `${clay.base[2]}DD`, clay.base[2]]}
                                locations={[0, 0.55, 1]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                                style={styles.schoolDissolveBottom}
                            />

                            <LinearGradient
                                colors={['transparent', clay.base[1]]}
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                style={styles.schoolDissolveRight}
                            />
                        </View>
                        )}

                        {/* Card Content Shell */}
                        <Pressable
                            style={[styles.content, dense && styles.contentDense]}
                            delayLongPress={LONG_PRESS_MS}
                            onLongPress={isLogin ? undefined : handleLongPress}
                            onPressIn={isLogin ? undefined : handleCardPressIn}
                            onPressOut={isLogin ? undefined : handleCardPressOut}
                            android_disableSound
                            disabled={isLogin}
                            accessibilityHint={!isLogin && accountCount > 1 ? 'Hold to switch accounts, double-tap photo for next account' : undefined}
                        >
                            {!isLogin && !dense && (
                                <View style={styles.topRow}>
                                    <View style={styles.schoolBadge}>
                                        <View style={styles.schoolLogoWrap}>
                                            <Image source={SCHOOL_CONFIG.logo} style={styles.schoolLogo} />
                                        </View>
                                        <MaterialCommunityIcons name="school" size={11} color={gold} style={{ marginLeft: 6 }} />
                                        <Text style={styles.schoolName} numberOfLines={1}>
                                            {t('schoolRibbon.brandName', {
                                                defaultValue: SCHOOL_CONFIG.name,
                                            })}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            <View style={[styles.profileRow, dense && styles.profileRowDense]}>
                                {isLogin ? (
                                    <View style={styles.avatarPressable}>
                                        <LinearGradient
                                            colors={clay.avatarRing}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.avatarRing}
                                        >
                                            <View style={styles.avatarInner}>
                                                <Image source={SCHOOL_CONFIG.logo} style={styles.logoAvatar} />
                                            </View>
                                        </LinearGradient>
                                    </View>
                                ) : (
                                    <Pressable
                                        onPress={handleAvatarPress}
                                        onLongPress={handleLongPress}
                                        delayLongPress={LONG_PRESS_MS}
                                        style={styles.avatarPressable}
                                        hitSlop={6}
                                    >
                                        <Animated.View style={avatarAnimatedStyle}>
                                            <LinearGradient
                                                colors={clay.avatarRing}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={styles.avatarRing}
                                            >
                                                <View style={styles.avatarInner}>
                                                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                                                </View>
                                            </LinearGradient>
                                            {accountCount > 0 && (
                                                <View style={styles.switchBadge}>
                                                    <Ionicons name="swap-horizontal" size={10} color="#fff" />
                                                    {accountCount > 1 && (
                                                        <Text style={styles.switchBadgeText}>{accountCount}</Text>
                                                    )}
                                                </View>
                                            )}
                                            <View style={styles.onlineDot} />
                                        </Animated.View>
                                    </Pressable>
                                )}

                                <View style={styles.info}>
                                    {(!compact || dense) && (
                                        <Text style={[styles.name, dense && styles.nameDense]} numberOfLines={isLogin ? 2 : 1}>
                                            {resolvedName}
                                        </Text>
                                    )}
                                    {isLogin ? (
                                        <View style={styles.loginRoleBlock}>
                                            <View style={[styles.crownPill, styles.crownPillLogin]}>
                                                <FontAwesome5 name="crown" size={8} color={gold} />
                                                <Text style={[styles.crownText, styles.crownTextLogin]}>
                                                    {badgeLabel}
                                                </Text>
                                            </View>
                                            <Text style={styles.loginTagline}>{resolvedRole}</Text>
                                        </View>
                                    ) : compact && !dense ? (
                                        compactRole && resolvedRole ? (
                                            <Text style={styles.roleCompact} numberOfLines={1}>
                                                {resolvedRole}
                                            </Text>
                                        ) : null
                                    ) : (
                                        <View style={styles.roleRow}>
                                            <Text style={styles.role} numberOfLines={1}>
                                                {resolvedRole}
                                            </Text>
                                            <View style={styles.crownPill}>
                                                <FontAwesome5 name="crown" size={7.5} color={gold} />
                                                <Text style={styles.crownText}>{badgeLabel}</Text>
                                            </View>
                                        </View>
                                    )}

                                    <View style={[styles.chipsRow, compact && !compactRole && !dense && styles.chipsRowCompact]}>
                                        {compact && !dense && (
                                            <View style={styles.crownPill}>
                                                <FontAwesome5 name="crown" size={7.5} color={gold} />
                                                <Text style={styles.crownText}>{badgeLabel}</Text>
                                            </View>
                                        )}
                                        {!isLogin && staffCode && (
                                            <View style={styles.chip}>
                                                <FontAwesome5 name="id-badge" size={9.5} color={clay.accent} />
                                                <Text style={styles.chipText}>{staffCode}</Text>
                                            </View>
                                        )}
                                        <View style={styles.chip}>
                                            <Ionicons name="shield-checkmark" size={12} color={gold} />
                                            <Text style={styles.chipText}>Verified</Text>
                                        </View>
                                    </View>

                                    {!isLogin && accountCount > 1 && !dense && (
                                        <Text style={styles.switchHint}>
                                            Hold to switch · double-tap photo
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </Pressable>
                    </View>
                </Animated.View>
            </Animated.View>

            {!isLogin && (
                <QuickAccountPickerSheet
                    visible={sheetOpen}
                    accounts={accounts}
                    activeId={activeId}
                    switching={switching}
                    busyUserId={busyUserId}
                    onClose={closeSheet}
                    onSelect={handleSelectAccount}
                />
            )}
        </>
    );
};

export default AdminHeaderCard;