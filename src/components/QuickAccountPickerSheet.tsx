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
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import type { VaultAccount } from '../services/accountVault';
import { SCHOOL_CONFIG } from '../constants/schoolConfig';
import { getVaultAccountSubtitle } from '../utils/portalRoutes';
import * as Haptics from '../utils/haptics';

const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/2922/2922506.png';

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

function ActiveAccountCard({ account }: { account: VaultAccount }) {
  const { line } = accountMeta(account);
  return (
    <View style={s.activeCard}>
      <LinearGradient
        colors={['rgba(99,102,241,0.22)', 'rgba(99,102,241,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={s.activeCardInner}>
        <View style={s.activeAvatarRing}>
          <Image source={{ uri: account.photoUrl || FALLBACK_AVATAR }} style={s.activeAvatar} />
          <View style={s.signedInBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#34D399" />
          </View>
        </View>
        <View style={s.activeCardMeta}>
          <View style={s.activeNameRow}>
            <Text style={s.activeName} numberOfLines={1}>
              {account.displayName || 'Student'}
            </Text>
            <View style={s.signedInPill}>
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
}: {
  account: VaultAccount;
  rowBusy: boolean;
  switching: boolean;
  delay: number;
  onSwitch: () => void;
}) {
  const { line } = accountMeta(account);

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300).springify()}>
      <Pressable
        style={({ pressed }) => [s.switchRow, pressed && !switching && s.switchRowPressed]}
        disabled={switching}
        onPress={onSwitch}
      >
        <Image
          source={{ uri: account.photoUrl || FALLBACK_AVATAR }}
          style={s.switchAvatar}
        />
        <View style={s.switchMeta}>
          <Text style={s.switchName} numberOfLines={1}>
            {account.displayName || 'Student'}
          </Text>
          <Text style={s.switchMetaLine} numberOfLines={2}>{line}</Text>
        </View>
        {rowBusy ? (
          <ActivityIndicator size="small" color="#A5B4FC" />
        ) : (
          <LinearGradient
            colors={['#6366F1', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.switchBtn}
          >
            <Text style={s.switchBtnText}>Switch</Text>
          </LinearGradient>
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
  const isWeb = Platform.OS === 'web';
  const isWide = width >= 520;

  const sheetMaxHeight = Math.min(Math.round(height * (isWide ? 0.68 : 0.62)), 480);
  const sheetWidth = isWide ? Math.min(width - 32, 420) : width;

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
      ? 'Add a student account to switch quickly'
      : accounts.length === 1
        ? 'Add another student to switch between profiles'
        : 'Select a student below to switch instantly';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(200)} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <Animated.View
          entering={FadeInUp.duration(360).springify().damping(22).stiffness(170)}
          style={[
            s.sheetOuter,
            isWide && s.sheetOuterWide,
            {
              paddingBottom: Math.max(insets.bottom, isWeb ? 14 : 6),
              maxHeight: sheetMaxHeight,
              width: sheetWidth,
              alignSelf: isWide ? 'center' : 'stretch',
            },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : null}
          <LinearGradient
            colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 0.4 }}
            style={s.topGloss}
            pointerEvents="none"
          />
          <View style={s.sheetTint} pointerEvents="none" />

          <View style={s.grabberWrap}>
            <View style={s.grabber} />
          </View>

          <View style={s.header}>
            <Text style={s.title}>Switch student</Text>
            <Text style={s.subtitle}>{subtitle}</Text>
            <Pressable
              style={({ pressed }) => [s.closeBtn, pressed && s.closeBtnPressed]}
              onPress={onClose}
              hitSlop={10}
            >
              <Ionicons name="close" size={17} color="rgba(255,255,255,0.72)" />
            </Pressable>
          </View>

          <ScrollView
            style={s.list}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {accounts.length === 0 ? (
              <Animated.View entering={ZoomIn.duration(300)} style={s.emptyBox}>
                <View style={s.emptyIcon}>
                  <Ionicons name="person-add-outline" size={26} color="#A5B4FC" />
                </View>
                <Text style={s.emptyTitle}>No saved accounts</Text>
                <Text style={s.emptyText}>
                  Add another student from Settings to switch between children instantly.
                </Text>
                <Pressable style={s.emptyCta} onPress={goToSettings}>
                  <Ionicons name="add-circle-outline" size={16} color="#fff" />
                  <Text style={s.emptyCtaText}>Add account</Text>
                </Pressable>
              </Animated.View>
            ) : (
              <>
                {activeAccount && (
                  <Animated.View entering={FadeInDown.duration(280)}>
                    <Text style={s.sectionLabel}>Signed in</Text>
                    <ActiveAccountCard account={activeAccount} />
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
                      />
                    ))}
                  </>
                )}

                {accounts.length === 1 && (
                  <Animated.View entering={FadeInDown.delay(100).duration(280)} style={s.singleHint}>
                    <Ionicons name="add-circle-outline" size={16} color="#A5B4FC" />
                    <Text style={s.singleHintText}>
                      Add another student in Settings to enable quick switching.
                    </Text>
                  </Animated.View>
                )}
              </>
            )}
          </ScrollView>

          <View style={s.footer}>
            <Pressable
              style={({ pressed }) => [s.settingsBtn, pressed && s.settingsBtnPressed]}
              onPress={goToSettings}
            >
              <Ionicons name="settings-outline" size={15} color="rgba(255,255,255,0.65)" />
              <Text style={s.settingsBtnText}>Manage accounts</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,7,16,0.82)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetOuter: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 22,
  },
  sheetOuterWide: {
    borderRadius: 26,
    borderBottomWidth: 1,
    marginBottom: 20,
  },
  sheetTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(10,15,30,0.62)' : 'rgba(10,15,30,0.96)',
  },
  topGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 1,
  },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: 9,
    paddingBottom: 4,
    zIndex: 2,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    zIndex: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
    paddingRight: 36,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.46)',
    marginTop: 3,
    fontWeight: '500',
    lineHeight: 18,
    paddingRight: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    transform: [{ scale: 0.96 }],
  },
  list: { flexGrow: 0, zIndex: 2 },
  listContent: { paddingHorizontal: 16, paddingBottom: 4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.38)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionLabelSpaced: {
    marginTop: 18,
  },
  activeCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.32)',
    marginBottom: 4,
  },
  activeCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  activeAvatarRing: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(129,140,248,0.5)',
    padding: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  activeAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
    backgroundColor: '#1E1042',
  },
  signedInBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: 'rgba(10,15,30,0.95)',
    borderRadius: 10,
    padding: 1,
  },
  activeCardMeta: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  activeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  signedInPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(52,211,153,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.35)',
  },
  signedInPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6EE7B7',
    letterSpacing: 0.3,
  },
  activeMetaLine: {
    fontSize: 12.5,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.52)',
    lineHeight: 17,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 12,
  },
  switchRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    transform: [{ scale: 0.985 }],
  },
  switchAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#1E1042',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  switchMeta: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  switchName: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.94)',
    letterSpacing: -0.1,
  },
  switchMetaLine: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.46)',
    lineHeight: 16,
  },
  switchBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 68,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  switchBtnText: {
    fontSize: 12,
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
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: 'rgba(99,102,241,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#6366F1',
  },
  emptyCtaText: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: '800',
  },
  singleHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.16)',
  },
  singleHintText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 17,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
    zIndex: 2,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  settingsBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  settingsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.58)',
  },
});
