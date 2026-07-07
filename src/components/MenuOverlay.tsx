import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dimensions,
    Modal,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useFeatures } from '../hooks/useFeatures';
import type { FeatureKey } from '../config/featureFlags';
import { AuthService } from '../services/authService';
import * as Haptics from '../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.82;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ─── Color themes ─── */
const THEMES = {
    student: {
        accent: '#0D9488',
        accentLight: '#CCFBF1',
        accentGradient: ['#0D9488', '#14B8A6'] as [string, string],
        roleBg: '#ECFDF5',
        roleText: '#065F46',
        roleBorder: '#A7F3D0',
    },
    staff: {
        accent: '#4F46E5',
        accentLight: '#EEF2FF',
        accentGradient: ['#4F46E5', '#818CF8'] as [string, string],
        roleBg: '#EEF2FF',
        roleText: '#3730A3',
        roleBorder: '#C7D2FE',
    },
    driver: {
        accent: '#EC4899',
        accentLight: '#FDF2F8',
        accentGradient: ['#EC4899', '#F472B6'] as [string, string],
        roleBg: '#FDF2F8',
        roleText: '#9D174D',
        roleBorder: '#FBCFE8',
    },
};

interface Props {
    visible: boolean;
    onClose: () => void;
    userType?: 'student' | 'staff' | 'driver';
}

interface MenuItem {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    link: string;
    accent?: string;
    /** Feature-flag key gating this drawer item (student items only). */
    feature?: FeatureKey;
}

/* ─── Individual Menu Item with press animation ─── */
const MenuItemCard: React.FC<{ item: MenuItem; onPress: () => void }> = ({ item, onPress }) => {
    const scale = useSharedValue(1);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Pressable
            onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 300 }); }}
            onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); }}
            onPress={onPress}
            style={Platform.OS === 'web' && { cursor: 'pointer' }}
        >
            <Animated.View style={[styles.menuCard, animStyle]}>
                <View style={[styles.accentBar, { backgroundColor: item.accent || '#4F46E5' }]} />
                <View style={[styles.menuIconBox, { backgroundColor: `${item.accent}15` }]}>
                    <Ionicons name={item.icon} size={20} color={item.accent || '#4F46E5'} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </Animated.View>
        </Pressable>
    );
};

/* ─── Main Component ─── */
const MenuOverlay: React.FC<Props> = ({ visible, onClose, userType = 'student' }) => {
    const { t } = useTranslation();
    const router = useRouter();
    const { user, signOut } = useAuth();
    const theme = THEMES[userType];

    const translateX = useSharedValue(-DRAWER_WIDTH);
    const backdropOpacity = useSharedValue(0);

    /* ── Menu items ── */
    const studentMenuItems: MenuItem[] = [
        { key: 'dcgd', label: 'DCGD', icon: 'ribbon-outline', link: '/Screen/dcgd', accent: '#0D9488', feature: 'menu.dcgd' },
        { key: 'ai_doubt', label: 'AI Doubt Assist', icon: 'chatbubble-ellipses-outline', link: '/Screen/aiChat', accent: '#6366F1', feature: 'menu.ai_doubt_assist' },
        { key: 'insurance', label: 'Insurance', icon: 'shield-checkmark-outline', link: '/Screen/insurance', accent: '#10B981', feature: 'menu.insurance' },
        { key: 'money_science', label: 'Money Science', icon: 'cash-outline', link: '/Screen/moneyScience', accent: '#8B5CF6', feature: 'menu.money_science' },
        { key: 'girl_safety', label: 'Girl Safety', icon: 'shield-checkmark-outline', link: '/girl-safety', accent: '#7C3AED', feature: 'menu.girl_safety' },
    ];

    const staffMenuItems: MenuItem[] = [
        { key: 'attendance', label: 'Mark Attendance', icon: 'checkbox-outline', link: '/staff/manage-students', accent: '#4F46E5' },
        { key: 'timetable', label: 'My Timetable', icon: 'calendar-outline', link: '/staff/timetable', accent: '#0EA5E9' },
        { key: 'upload_marks', label: 'Upload Marks', icon: 'cloud-upload-outline', link: '/staff/results', accent: '#8B5CF6' },
        { key: 'leaves', label: 'Apply Leave', icon: 'document-text-outline', link: '/staff/leaves', accent: '#F59E0B' },
        { key: 'profile', label: 'Staff Profile', icon: 'person-outline', link: '/staff/profile', accent: '#10B981' },
    ];

    const driverMenuItems: MenuItem[] = [
        { key: 'route', label: 'My Route', icon: 'navigate-outline', link: '/driver/dashboard', accent: '#EC4899' },
        { key: 'students', label: 'Students', icon: 'people-outline', link: '/driver/students', accent: '#6366F1' },
        { key: 'profile', label: 'Driver Profile', icon: 'person-outline', link: '/driver/profile', accent: '#10B981' },
    ];

    const { isEnabled } = useFeatures();
    const baseItems = userType === 'driver' ? driverMenuItems : userType === 'staff' ? staffMenuItems : studentMenuItems;
    // Feature flags apply to student items only (staff/driver items carry no `feature`).
    const itemsToRender = baseItems.filter((it) => !it.feature || isEnabled(it.feature));

    /* ── Animations ── */
    useEffect(() => {
        if (visible) {
            translateX.value = withSpring(0, { damping: 15, stiffness: 170, mass: 0.8 });
            backdropOpacity.value = withTiming(1, { duration: 400 });
        } else {
            translateX.value = withTiming(-DRAWER_WIDTH, { duration: 280 });
            backdropOpacity.value = withTiming(0, { duration: 250 });
        }
    }, [visible]);

    const closeDrawer = useCallback(() => {
        translateX.value = withTiming(-DRAWER_WIDTH, { duration: 280 });
        backdropOpacity.value = withTiming(0, { duration: 250 });
        setTimeout(onClose, 300);
    }, [onClose]);

    /* ── Swipe gesture ── */
    const panGesture = Gesture.Pan()
        .activeOffsetX(-20)
        .onUpdate((e) => {
            if (e.translationX < 0) {
                translateX.value = e.translationX;
            }
        })
        .onEnd((e) => {
            if (e.translationX < -80 || e.velocityX < -500) {
                translateX.value = withTiming(-DRAWER_WIDTH, { duration: 250 });
                backdropOpacity.value = withTiming(0, { duration: 220 });
                runOnJS(onClose)();
            } else {
                translateX.value = withSpring(0, { damping: 15, stiffness: 170, mass: 0.8 });
            }
        });

    /* ── Animated styles ── */
    const drawerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(backdropOpacity.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    }));

    /* ── Handlers ── */
    const handlePress = (link: string) => {
        console.debug('[MenuOverlay] handlePress start', { link });
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            closeDrawer();
            setTimeout(() => {
                try {
                    router.push(link as Href);
                    console.debug('[MenuOverlay] handlePress end', { link });
                } catch (e) {
                    console.error('Button action failed:', e);
                }
            }, 300);
        } catch (e) {
            console.error('Button action failed:', e);
        }
    };

    const handleLogout = async () => {
        console.debug('[MenuOverlay] handleLogout start');
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            closeDrawer();
            setTimeout(async () => {
                try {
                    // Clear the auto_login flag for the current portal
                    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                    const autoLoginKey = userType === 'staff' ? 'staff_auto_login'
                        : userType === 'driver' ? 'driver_auto_login'
                        : 'student_auto_login';
                    await AsyncStorage.removeItem(autoLoginKey);
                    await signOut();
                    router.replace('/welcome');
                    console.debug('[MenuOverlay] handleLogout end');
                } catch (e) {
                    console.error('Button action failed:', e);
                }
            }, 300);
        } catch (e) {
            console.error('Button action failed:', e);
        }
    };

    if (!visible) return null;

    const displayName = user?.displayName || (userType === 'staff' ? 'Staff Member' : 'Student');
    const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
            <GestureHandlerRootView style={StyleSheet.absoluteFill}>
                <StatusBar barStyle="light-content" />

                {/* Dimmed backdrop */}
                <Animated.View style={[styles.backdrop, backdropStyle]}>
                    <Pressable
                        style={[StyleSheet.absoluteFill, Platform.OS === 'web' && { cursor: 'pointer' }]}
                        onPress={closeDrawer}
                    />
                </Animated.View>

                {/* Drawer panel */}
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.drawer, drawerStyle]}>
                        <SafeAreaView style={styles.drawerInner} edges={['top', 'bottom']}>

                            {/* ── Profile Header ── */}
                            <View style={styles.profileSection}>
                                <View style={styles.avatarRow}>
                                    <LinearGradient
                                        colors={theme.accentGradient}
                                        style={styles.avatarRing}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <View style={styles.avatarInner}>
                                            <Text style={[styles.avatarText, { color: theme.accent }]}>{initials}</Text>
                                        </View>
                                    </LinearGradient>
                                    <View style={styles.profileInfo}>
                                        <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
                                        <View style={[styles.roleBadge, {
                                            backgroundColor: theme.roleBg,
                                            borderColor: theme.roleBorder,
                                        }]}>
                                            <Text style={[styles.roleText, { color: theme.roleText }]}>
                                                {userType === 'driver' ? 'Driver' : userType === 'staff' ? 'Staff' : 'Student'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.headerDivider} />
                            </View>

                            {/* ── Menu Items ── */}
                            <View style={styles.menuList}>
                                {itemsToRender.map((item) => (
                                    <MenuItemCard
                                        key={item.key}
                                        item={item}
                                        onPress={() => handlePress(item.link)}
                                    />
                                ))}
                            </View>

                            {/* ── Spacer ── */}
                            <View style={{ flex: 1 }} />

                            {/* ── Logout Button ── */}
                            <Pressable
                                style={[styles.logoutButton, Platform.OS === 'web' && { cursor: 'pointer' }]}
                                onPress={handleLogout}
                            >
                                <View style={styles.logoutIconBox}>
                                    <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                                </View>
                                <Text style={styles.logoutText}>Logout</Text>
                                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                            </Pressable>

                            {/* ── Close Button ── */}
                            <Pressable
                                style={[styles.closeButton, Platform.OS === 'web' && { cursor: 'pointer' }]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    closeDrawer();
                                }}
                            >
                                <Ionicons name="close" size={22} color="#64748B" />
                            </Pressable>

                        </SafeAreaView>
                    </Animated.View>
                </GestureDetector>
            </GestureHandlerRootView>
        </Modal>
    );
};

export default MenuOverlay;

/* ======================= STYLES ======================= */

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },

    drawer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: DRAWER_WIDTH,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderTopRightRadius: 28,
        borderBottomRightRadius: 28,
        shadowColor: '#0F172A',
        shadowOffset: { width: 8, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 20,
    },

    drawerInner: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
    },

    /* ── Profile Header ── */
    profileSection: {
        marginBottom: 8,
    },

    avatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        gap: 14,
    },

    avatarRing: {
        width: 52,
        height: 52,
        borderRadius: 26,
        padding: 2.5,
    },

    avatarInner: {
        flex: 1,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },

    avatarText: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    profileInfo: {
        flex: 1,
        gap: 6,
    },

    profileName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: 0.2,
    },

    roleBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 20,
        borderWidth: 1,
    },

    roleText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },

    headerDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginTop: 4,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
    },

    /* ── Menu Items ── */
    menuList: {
        gap: 10,
        paddingTop: 8,
    },

    menuCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        gap: 12,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },

    accentBar: {
        width: 3,
        height: 28,
        borderRadius: 2,
    },

    menuIconBox: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },

    menuLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
        letterSpacing: 0.1,
    },

    /* ── Logout ── */
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        borderRadius: 16,
        padding: 14,
        gap: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#FECACA',
    },

    logoutIconBox: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
    },

    logoutText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#DC2626',
        letterSpacing: 0.1,
    },

    /* ── Close Button ── */
    closeButton: {
        alignSelf: 'center',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
});
