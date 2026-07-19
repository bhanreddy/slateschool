import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import type { VaultAccount } from '../services/accountVault';
import { SCHOOL_CONFIG, schoolColorWithAlpha } from '../constants/schoolConfig';
import { getVaultAccountSubtitle } from '../utils/portalRoutes';
import { useTheme } from '../hooks/useTheme';
import { clay, clayCard } from '../theme/clayStyles';
import * as Haptics from '../utils/haptics';

const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/2922/2922506.png';

function clayPuck(isDark: boolean, tint?: string): object {
  if (Platform.OS === 'web') {
    const drop = tint
      ? schoolColorWithAlpha(tint, isDark ? 0.42 : 0.28)
      : isDark
        ? 'rgba(0,0,0,0.55)'
        : 'rgba(148,163,184,0.42)';
    const light = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.95)';
    const innerHi = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.95)';
    const innerLo = tint
      ? schoolColorWithAlpha(tint, isDark ? 0.35 : 0.18)
      : isDark
        ? 'rgba(0,0,0,0.45)'
        : 'rgba(148,163,184,0.22)';
    return {
      boxShadow: `4px 5px 12px ${drop}, -3px -3px 10px ${light}, inset 1.5px 1.5px 3px ${innerHi}, inset -2px -2px 4px ${innerLo}`,
    };
  }
  return {
    shadowColor: tint || (isDark ? '#000' : '#94A3B8'),
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.4 : 0.22,
    shadowRadius: 6,
    elevation: 3,
  };
}

function clayRow(isDark: boolean, accent?: string): object {
  if (Platform.OS === 'web') {
    const drop = accent
      ? schoolColorWithAlpha(accent, isDark ? 0.38 : 0.26)
      : isDark
        ? 'rgba(0,0,0,0.5)'
        : 'rgba(148,163,184,0.38)';
    const light = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.92)';
    const innerHi = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
    const innerLo = accent
      ? schoolColorWithAlpha(accent, isDark ? 0.28 : 0.14)
      : isDark
        ? 'rgba(0,0,0,0.35)'
        : 'rgba(148,163,184,0.18)';
    return {
      boxShadow: `6px 7px 16px ${drop}, -5px -5px 14px ${light}, inset 2px 2px 4px ${innerHi}, inset -2px -3px 5px ${innerLo}`,
    };
  }
  return {
    shadowColor: accent || (isDark ? '#000' : '#64748B'),
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.35 : 0.14,
    shadowRadius: 8,
    elevation: 3,
    borderBottomWidth: 1.5,
    borderBottomColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(148,163,184,0.22)',
  };
}

function clayInsetSoft(isDark: boolean): object {
  if (Platform.OS === 'web') {
    const lo = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(148,163,184,0.4)';
    const hi = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)';
    return {
      boxShadow: `inset 3px 3px 6px ${lo}, inset -2px -2px 5px ${hi}`,
    };
  }
  return {
    borderWidth: 1,
    borderColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(148,163,184,0.28)',
  };
}

interface Props {
  visible: boolean;
  accounts: VaultAccount[];
  activeId: string | null;
  switching: boolean;
  busyUserId?: string | null;
  onClose: () => void;
  onSelect: (userId: string) => void;
}

function accountMeta(acct: VaultAccount) {
  const line = getVaultAccountSubtitle(acct);
  const schoolName = acct.schoolName || SCHOOL_CONFIG.name;
  return { classLabel: line, schoolName, line: `${line} · ${schoolName}` };
}

function ActiveAccountCard({
  account,
  isDark,
  primary,
  styles: s,
}: {
  account: VaultAccount;
  isDark: boolean;
  primary: string;
  styles: ReturnType<typeof getStyles>;
}) {
  const { line } = accountMeta(account);
  return (
    <View style={[s.activeCard, clayRow(isDark, primary)]}>
      <View style={s.activeCardInner}>
        <View style={[s.activeAvatarRing, clayPuck(isDark, primary)]}>
          <Image source={{ uri: account.photoUrl || FALLBACK_AVATAR }} style={s.activeAvatar} />
          <View style={[s.signedInBadge, clayPuck(isDark, '#10B981')]}>
            <Ionicons name="checkmark" size={11} color="#fff" />
          </View>
        </View>
        <View style={s.activeCardMeta}>
          <View style={s.activeNameRow}>
            <Text style={s.activeName} numberOfLines={1}>
              {account.displayName || 'Account'}
            </Text>
            <View style={[s.signedInPill, clayPuck(isDark, '#10B981')]}>
              <Text style={s.signedInPillText}>Signed in</Text>
            </View>
          </View>
          <Text style={s.activeMetaLine} numberOfLines={2}>{line}</Text>
        </View>
      </View>
    </View>
  );
}

function SwitchAccountRow({
  account,
  rowBusy,
  switching,
  delay,
  onSwitch,
  isDark,
  primary,
  styles: s,
}: {
  account: VaultAccount;
  rowBusy: boolean;
  switching: boolean;
  delay: number;
  onSwitch: () => void;
  isDark: boolean;
  primary: string;
  styles: ReturnType<typeof getStyles>;
}) {
  const { line } = accountMeta(account);

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)} style={s.switchRowOuter}>
      <Pressable
        style={({ pressed }) => [
          s.switchRow,
          clayRow(isDark),
          pressed && !switching && s.switchRowPressed,
        ]}
        disabled={switching}
        onPress={onSwitch}
      >
        <View style={[s.switchAvatarRing, clayPuck(isDark)]}>
          <Image
            source={{ uri: account.photoUrl || FALLBACK_AVATAR }}
            style={s.switchAvatar}
          />
        </View>
        <View style={s.switchMeta}>
          <Text style={s.switchName} numberOfLines={1}>
            {account.displayName || 'Account'}
          </Text>
          <Text style={s.switchMetaLine} numberOfLines={2}>{line}</Text>
        </View>
        {rowBusy ? (
          <ActivityIndicator size="small" color={primary} />
        ) : (
          <View style={[s.switchBtnOuter, clayPuck(isDark, primary)]}>
            <LinearGradient
              colors={[primary, schoolColorWithAlpha(primary, 0.85)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.switchBtn}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.28)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <Text style={s.switchBtnText}>Switch</Text>
            </LinearGradient>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function QuickAccountPickerSheet({
  visible,
  accounts,
  activeId,
  switching,
  busyUserId,
  onClose,
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const primary = theme.colors.primary as string;
  const s = useMemo(() => getStyles(isDark, primary), [isDark, primary]);
  const isWeb = Platform.OS === 'web';
  const isWide = width >= 520;

  const sheetMaxHeight = Math.min(Math.round(height * (isWide ? 0.68 : 0.62)), 500);
  const sheetWidth = isWide ? Math.min(width - 32, 440) : width;

  const activeAccount = useMemo(
    () => accounts.find((a) => a.userId === activeId) ?? null,
    [accounts, activeId]
  );
  const otherAccounts = useMemo(
    () => accounts.filter((a) => a.userId !== activeId),
    [accounts, activeId]
  );

  const goToSettings = () => {
    Haptics.selectionAsync();
    onClose();
    router.push('/Screen/settings');
  };

  const handleSwitch = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void onSelect(userId);
  };

  const subtitle =
    accounts.length === 0
      ? 'Add an account to switch quickly'
      : accounts.length === 1
        ? 'Add another account to switch between profiles'
        : 'Select an account below to switch instantly';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(200)} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <Animated.View
          entering={FadeInUp.duration(340).springify().damping(22).stiffness(170)}
          style={[
            s.sheetOuter,
            clay(isDark, 'lg'),
            isWide && s.sheetOuterWide,
            {
              paddingBottom: Math.max(insets.bottom, isWeb ? 16 : 8),
              maxHeight: sheetMaxHeight,
              width: sheetWidth,
              alignSelf: isWide ? 'center' : 'stretch',
            },
          ]}
        >
          <LinearGradient
            colors={
              isDark
                ? [schoolColorWithAlpha(primary, 0.2), 'transparent']
                : [schoolColorWithAlpha(primary, 0.12), 'rgba(255,255,255,0.4)', 'transparent']
            }
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 0.5 }}
            style={s.sheetSheen}
            pointerEvents="none"
          />

          <View style={[s.grabber, clayInsetSoft(isDark)]} />

          <View style={s.header}>
            <View style={[s.headerIconOuter, clayPuck(isDark, primary)]}>
              <LinearGradient
                colors={
                  isDark
                    ? [schoolColorWithAlpha(primary, 0.55), schoolColorWithAlpha(primary, 0.25)]
                    : ['#FFFFFF', schoolColorWithAlpha(primary, 0.16)]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.headerIconFill}
              >
                <Ionicons name="people" size={18} color={primary} />
              </LinearGradient>
            </View>
            <View style={s.headerText}>
              <Text style={s.title}>Switch Account</Text>
              <Text style={s.subtitle}>{subtitle}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                s.closeBtn,
                clayPuck(isDark),
                pressed && s.closeBtnPressed,
              ]}
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={17} color={isDark ? '#9CA3AF' : '#64748B'} />
            </Pressable>
          </View>

          <ScrollView
            style={s.list}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {accounts.length === 0 ? (
              <Animated.View entering={ZoomIn.duration(300)} style={[s.emptyBox, clayCard(isDark, 'sm')]}>
                <View style={[s.emptyIcon, clayPuck(isDark, primary)]}>
                  <Ionicons name="person-add-outline" size={24} color={primary} />
                </View>
                <Text style={s.emptyTitle}>No saved accounts</Text>
                <Text style={s.emptyText}>
                  Add another account from Settings to switch between profiles instantly.
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    s.emptyCtaOuter,
                    clayPuck(isDark, primary),
                    pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                  ]}
                  onPress={goToSettings}
                >
                  <LinearGradient
                    colors={[primary, schoolColorWithAlpha(primary, 0.85)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.emptyCta}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#fff" />
                    <Text style={s.emptyCtaText}>Add account</Text>
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            ) : (
              <>
                {activeAccount && (
                  <Animated.View entering={FadeInDown.duration(280)}>
                    <Text style={s.sectionLabel}>Signed in</Text>
                    <ActiveAccountCard
                      account={activeAccount}
                      isDark={isDark}
                      primary={primary}
                      styles={s}
                    />
                  </Animated.View>
                )}

                {otherAccounts.length > 0 && (
                  <>
                    <Animated.View entering={FadeInDown.delay(60).duration(280)}>
                      <Text style={[s.sectionLabel, s.sectionLabelSpaced]}>Switch to</Text>
                    </Animated.View>
                    {otherAccounts.map((acct, idx) => (
                      <SwitchAccountRow
                        key={acct.userId}
                        account={acct}
                        rowBusy={switching && busyUserId === acct.userId}
                        switching={switching}
                        delay={80 + idx * 50}
                        onSwitch={() => handleSwitch(acct.userId)}
                        isDark={isDark}
                        primary={primary}
                        styles={s}
                      />
                    ))}
                  </>
                )}

                {accounts.length === 1 && (
                  <Animated.View
                    entering={FadeInDown.delay(100).duration(280)}
                    style={[s.singleHint, clayRow(isDark, primary)]}
                  >
                    <View style={[s.singleHintIcon, clayPuck(isDark, primary)]}>
                      <Ionicons name="add-circle-outline" size={16} color={primary} />
                    </View>
                    <Text style={s.singleHintText}>
                      Add another account in Settings to enable quick switching.
                    </Text>
                  </Animated.View>
                )}
              </>
            )}
          </ScrollView>

          <View style={s.footer}>
            <Pressable
              style={({ pressed }) => [
                s.settingsBtn,
                clay(isDark, 'sm'),
                pressed && s.settingsBtnPressed,
              ]}
              onPress={goToSettings}
            >
              <Ionicons name="settings-outline" size={15} color={isDark ? '#94A3B8' : '#64748B'} />
              <Text style={s.settingsBtnText}>Manage accounts</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const getStyles = (isDark: boolean, primary: string) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(2,6,23,0.72)' : 'rgba(15,23,42,0.52)',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    sheetOuter: {
      backgroundColor: isDark ? '#121826' : '#E7EBF4',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
      paddingTop: 12,
    },
    sheetOuterWide: {
      borderRadius: 28,
      borderBottomWidth: 1,
      marginBottom: 20,
    },
    sheetSheen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 130,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
    },
    grabber: {
      alignSelf: 'center',
      width: 44,
      height: 6,
      borderRadius: 4,
      backgroundColor: isDark ? '#1E293B' : '#D5DCE8',
      marginBottom: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 18,
      paddingBottom: 14,
      gap: 12,
    },
    headerIconOuter: {
      width: 44,
      height: 44,
      borderRadius: 16,
      marginTop: 1,
      backgroundColor: isDark ? '#1E293B' : '#F4F7FD',
    },
    headerIconFill: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      overflow: 'hidden',
    },
    headerText: { flex: 1, minWidth: 0, paddingRight: 8 },
    title: {
      fontSize: 21,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#2A3142',
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: 12.5,
      color: isDark ? '#94A3B8' : '#6B7590',
      marginTop: 3,
      fontWeight: '500',
      lineHeight: 17,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 14,
      backgroundColor: isDark ? '#1E293B' : '#F4F7FD',
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeBtnPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.94 }],
    },
    list: { flexGrow: 0 },
    listContent: { paddingHorizontal: 16, paddingBottom: 6 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: isDark ? '#64748B' : '#94A3B8',
      letterSpacing: 0.85,
      textTransform: 'uppercase',
      marginBottom: 10,
      marginLeft: 2,
    },
    sectionLabelSpaced: {
      marginTop: 18,
    },
    activeCard: {
      borderRadius: 22,
      marginBottom: 4,
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.22) : schoolColorWithAlpha(primary, 0.12),
      borderWidth: 1,
      borderColor: isDark ? schoolColorWithAlpha(primary, 0.4) : schoolColorWithAlpha(primary, 0.28),
    },
    activeCardInner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 13,
    },
    activeAvatarRing: {
      width: 54,
      height: 54,
      borderRadius: 27,
      padding: 3,
      backgroundColor: primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    activeAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#E5E7EB',
    },
    signedInBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#10B981',
      justifyContent: 'center',
      alignItems: 'center',
    },
    activeCardMeta: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    activeNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    activeName: {
      fontSize: 16,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#2A3142',
      letterSpacing: -0.2,
      flexShrink: 1,
    },
    signedInPill: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 9,
      backgroundColor: '#10B981',
    },
    signedInPillText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.35,
    },
    activeMetaLine: {
      fontSize: 12.5,
      fontWeight: '500',
      color: isDark ? '#94A3B8' : '#6B7590',
      lineHeight: 17,
    },
    switchRowOuter: {
      marginBottom: 10,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 13,
      borderRadius: 22,
      backgroundColor: isDark ? '#1A2332' : '#F4F7FD',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
      gap: 12,
    },
    switchRowPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    switchAvatarRing: {
      width: 48,
      height: 48,
      borderRadius: 24,
      padding: 2,
      backgroundColor: isDark ? '#243044' : '#EEF2F7',
      justifyContent: 'center',
      alignItems: 'center',
    },
    switchAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#E5E7EB',
    },
    switchMeta: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    switchName: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : '#2A3142',
      letterSpacing: -0.1,
    },
    switchMetaLine: {
      fontSize: 12,
      fontWeight: '500',
      color: isDark ? '#94A3B8' : '#6B7590',
      lineHeight: 16,
    },
    switchBtnOuter: {
      borderRadius: 14,
      backgroundColor: primary,
    },
    switchBtn: {
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 14,
      minWidth: 72,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderBottomWidth: 1.5,
      borderBottomColor: 'rgba(0,0,0,0.16)',
    },
    switchBtnText: {
      fontSize: 12.5,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.2,
    },
    emptyBox: {
      alignItems: 'center',
      paddingVertical: 28,
      paddingHorizontal: 18,
      gap: 8,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 20,
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.2) : '#F4F7FD',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    emptyTitle: {
      color: isDark ? '#F1F5F9' : '#2A3142',
      fontSize: 16,
      fontWeight: '800',
    },
    emptyText: {
      color: isDark ? '#94A3B8' : '#6B7590',
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'center',
      lineHeight: 19,
    },
    emptyCtaOuter: {
      marginTop: 10,
      borderRadius: 14,
      backgroundColor: primary,
    },
    emptyCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      overflow: 'hidden',
    },
    emptyCtaText: {
      color: '#fff',
      fontSize: 13.5,
      fontWeight: '800',
    },
    singleHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderRadius: 18,
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.14) : schoolColorWithAlpha(primary, 0.08),
      borderWidth: 1,
      borderColor: isDark ? schoolColorWithAlpha(primary, 0.3) : schoolColorWithAlpha(primary, 0.2),
    },
    singleHintIcon: {
      width: 32,
      height: 32,
      borderRadius: 12,
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.22) : '#F4F7FD',
      alignItems: 'center',
      justifyContent: 'center',
    },
    singleHintText: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: '500',
      color: isDark ? '#94A3B8' : '#6B7590',
      lineHeight: 17,
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 4,
    },
    settingsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 16,
      backgroundColor: isDark ? '#1A2332' : '#F4F7FD',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
    },
    settingsBtnPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.985 }],
    },
    settingsBtnText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: isDark ? '#CBD5E1' : '#475569',
    },
  });
