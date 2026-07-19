import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { alertCompat } from '../utils/crossPlatformAlert';
import * as accountVault from '../services/accountVault';
import type { VaultAccount } from '../services/accountVault';
import {
  getHomeRouteForRole,
  getVaultAccountSubtitle,
} from '../utils/portalRoutes';
import {
  ensureFreshAccessTokens,
  getUnreadCountsForAllVaultedAccounts,
  removeVaultedAccount,
} from '../services/pushFanout';
import ClayPasswordToggle from './ClayPasswordToggle';
import { clay, clayCard, clayInset } from '../theme/clayStyles';
import { schoolColorWithAlpha } from '../constants/schoolConfig';

const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/2922/2922506.png';

/** Small raised clay puck (avatar rings, icon buttons, chips). */
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

/** Soft embossed clay for list rows — lighter than clay('sm') so stacks don't mud. */
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

/** Pressed-in clay chip / grabber. */
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
  onClose: () => void;
}

/**
 * AccountSwitcherSheet — direct multi-login switcher (no admin setup).
 *
 * Each saved account uses its own email & password (parent login, staff login, etc.).
 * Tap to switch instantly, or add another login you already have.
 */
export default function AccountSwitcherSheet({ visible, onClose }: Props) {
  const { switchAccount, addAccount, signOut } = useAuth();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [accounts, setAccounts] = useState<VaultAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [addMode, setAddMode] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const primary = theme.colors.primary as string;

  const load = useCallback(async (refreshTokens = true) => {
    setLoading(true);
    try {
      if (refreshTokens) {
        await ensureFreshAccessTokens().catch(() => {});
      }
      const [accs, active] = await Promise.all([
        accountVault.listAccounts(),
        accountVault.getActiveAccountId(),
      ]);
      setAccounts(accs);
      setActiveId(active);
    } catch {
      /* vault read failures shouldn't crash the sheet */
    } finally {
      setLoading(false);
    }
    getUnreadCountsForAllVaultedAccounts()
      .then(setCounts)
      .catch(() => { /* badges simply don't show */ });
  }, []);

  useEffect(() => {
    if (visible) {
      setAddMode(false);
      setAddEmail('');
      setAddPassword('');
      setShowAddPassword(false);
      setAddError(null);
      setFocusedField(null);
      load();
    }
  }, [visible, load]);

  const onSwitch = async (userId: string) => {
    if (busyId) return;
    if (userId === activeId) {
      onClose();
      return;
    }
    setBusyId(userId);
    try {
      const res = await switchAccount(userId);
      if (res?.error) {
        alertCompat('Could not switch', res.error);
        return;
      }
      if (res?.session?.validatedUser?.role?.code) {
        router.replace(getHomeRouteForRole(res.session.validatedUser.role.code) as any);
      }
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  const onAdd = async () => {
    if (addBusy) return;
    if (!addEmail.trim() || !addPassword) {
      setAddError('Enter both email and password.');
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      const res = await addAccount(addEmail.trim(), addPassword);
      if (res?.error) {
        setAddError(res.error);
        return;
      }
      if (res?.session) {
        await switchAccount(res.session.validatedUser.userId);
        router.replace(getHomeRouteForRole(res.session.validatedUser.role?.code) as any);
        onClose();
      }
    } catch (e: any) {
      setAddError(e?.message || 'Could not add this account.');
    } finally {
      setAddBusy(false);
    }
  };

  const onRemove = (acct: VaultAccount) => {
    if (busyId) return;
    const isActive = acct.userId === activeId;
    const name = acct.displayName || 'this account';
    alertCompat(
      isActive ? 'Log out' : 'Remove account',
      isActive
        ? `Log out of ${name}? You can add it back later.`
        : `Remove ${name} from this device? You can add it again later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isActive ? 'Log out' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusyId(acct.userId);
            try {
              if (isActive) {
                onClose();
                await signOut();
                router.replace('/welcome');
              } else {
                await removeVaultedAccount(acct.userId);
                await load();
              }
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const s = getStyles(theme.colors, isDark, primary);
  const sheetMinHeight = Math.min(Math.round(height * 0.52), 540);
  const sheetMaxHeight = Math.round(height * 0.88);
  const iconMuted = isDark ? '#64748B' : '#94A3B8';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={s.backdrop}>
        <Pressable style={s.backdropPress} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.kav}
          pointerEvents="box-none"
        >
          <View
            style={[
              s.sheet,
              clay(isDark, 'lg'),
              { paddingBottom: 20 + insets.bottom, minHeight: sheetMinHeight, maxHeight: sheetMaxHeight },
            ]}
          >
            {/* Outer clay sheet — sheen only (no overflow clip so shadows survive) */}
            <LinearGradient
              colors={
                isDark
                  ? [schoolColorWithAlpha(primary, 0.18), 'transparent']
                  : [schoolColorWithAlpha(primary, 0.1), 'rgba(255,255,255,0.35)', 'transparent']
              }
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.85, y: 0.5 }}
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
              <View style={{ flex: 1 }}>
                <Text style={s.title}>Switch account</Text>
                <Text style={s.subtitle}>
                  {accounts.length > 0
                    ? 'Each login stays on this device — switch anytime with one tap'
                    : 'Add a parent or staff login you already use'}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  s.closeBtn,
                  clayPuck(isDark),
                  pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
                ]}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={17} color={isDark ? '#9CA3AF' : '#64748B'} />
              </Pressable>
            </View>

            {loading ? (
              <View style={s.loadingBox}>
                <ActivityIndicator color={primary} />
              </View>
            ) : (
              <ScrollView
                style={s.list}
                contentContainerStyle={s.listContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {accounts.map((acct, idx) => {
                  const isActive = acct.userId === activeId;
                  const unread = counts[acct.userId] ?? 0;
                  const rowBusy = busyId === acct.userId;
                  return (
                    <Animated.View
                      key={acct.userId}
                      entering={FadeInDown.delay(36 * idx).duration(300)}
                      style={s.rowOuter}
                    >
                      <Pressable
                        style={({ pressed }) => [
                          s.row,
                          isActive ? s.rowActive : s.rowIdle,
                          clayRow(isDark, isActive ? primary : undefined),
                          pressed && s.rowPressed,
                        ]}
                        disabled={!!busyId}
                        onPress={() => onSwitch(acct.userId)}
                      >
                        <View style={[s.avatarRing, clayPuck(isDark, isActive ? primary : undefined), isActive && s.avatarRingActive]}>
                          <Image source={{ uri: acct.photoUrl || FALLBACK_AVATAR }} style={s.avatar} />
                          {unread > 0 && (
                            <View style={[s.avatarBadge, clayPuck(isDark, '#EF4444')]}>
                              <Text style={s.avatarBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                            </View>
                          )}
                        </View>

                        <View style={s.rowMeta}>
                          <Text style={s.rowName} numberOfLines={1}>
                            {acct.displayName || 'Account'}
                          </Text>
                          <View style={s.rowSubLine}>
                            {isActive && (
                              <View style={[s.activeTag, clayPuck(isDark, primary)]}>
                                <Text style={s.activeTagText}>Active</Text>
                              </View>
                            )}
                            <Text style={s.rowSubMuted} numberOfLines={1}>
                              {getVaultAccountSubtitle(acct)}
                            </Text>
                            {unread > 0 && (
                              <Text style={s.rowSubMuted} numberOfLines={1}>
                                {' · '}{unread > 99 ? '99+' : unread} unread
                              </Text>
                            )}
                          </View>
                        </View>

                        {rowBusy ? (
                          <ActivityIndicator size="small" color={primary} />
                        ) : (
                          <View style={s.rowRight}>
                            {isActive ? (
                              <View style={[s.checkWrap, clayPuck(isDark, primary)]}>
                                <Ionicons name="checkmark" size={14} color="#fff" />
                              </View>
                            ) : (
                              <View style={[s.chevronPuck, clayPuck(isDark)]}>
                                <Ionicons name="chevron-forward" size={14} color={isDark ? '#94A3B8' : '#94A3B8'} />
                              </View>
                            )}
                            <Pressable
                              style={({ pressed }) => [
                                s.actionBtn,
                                isActive ? s.actionBtnDanger : s.actionBtnNeutral,
                                clayPuck(isDark, isActive ? '#EF4444' : undefined),
                                pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
                              ]}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              onPress={() => onRemove(acct)}
                              disabled={!!busyId}
                            >
                              <Ionicons
                                name={isActive ? 'log-out-outline' : 'close'}
                                size={15}
                                color={isActive ? '#EF4444' : (isDark ? '#94A3B8' : '#64748B')}
                              />
                            </Pressable>
                          </View>
                        )}
                      </Pressable>
                    </Animated.View>
                  );
                })}

                {!addMode ? (
                  <Pressable
                    style={({ pressed }) => [
                      s.addRow,
                      clayRow(isDark, primary),
                      pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
                    ]}
                    disabled={!!busyId}
                    onPress={() => setAddMode(true)}
                  >
                    <View style={[s.addIcon, clayPuck(isDark, primary)]}>
                      <Ionicons name="add" size={22} color={primary} />
                    </View>
                    <View style={s.rowMeta}>
                      <Text style={[s.rowName, { color: primary }]}>Add account</Text>
                      <Text style={s.rowSubMuted}>Use that login&apos;s email & password (parent or staff)</Text>
                    </View>
                    <View style={[s.chevronPuck, clayPuck(isDark, primary)]}>
                      <Ionicons name="chevron-forward" size={14} color={primary} />
                    </View>
                  </Pressable>
                ) : (
                  <Animated.View entering={FadeInDown.duration(260)} style={[s.addForm, clayCard(isDark, 'md')]}>
                    <View style={s.addFormHeader}>
                      <View style={[s.addFormBadge, clayPuck(isDark, primary)]}>
                        <Ionicons name="person-add-outline" size={14} color={primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.addFormTitle}>Add another login</Text>
                        <Text style={s.addFormHint}>
                          Enter the email and password for your other account. No admin setup needed.
                        </Text>
                      </View>
                    </View>

                    <View style={[s.inputOuter, clay(isDark, 'sm')]}>
                      <View style={[s.inputInner, clayInset(isDark, focusedField === 'email')]}>
                        <Ionicons
                          name="mail-outline"
                          size={16}
                          color={focusedField === 'email' ? primary : iconMuted}
                        />
                        <TextInput
                          style={s.input}
                          placeholder="Email"
                          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          autoCorrect={false}
                          value={addEmail}
                          onChangeText={setAddEmail}
                          editable={!addBusy}
                          onFocus={() => setFocusedField('email')}
                          onBlur={() => setFocusedField((f) => (f === 'email' ? null : f))}
                        />
                      </View>
                    </View>

                    <View style={[s.inputOuter, clay(isDark, 'sm'), { marginBottom: 0 }]}>
                      <View style={[s.inputInner, clayInset(isDark, focusedField === 'password')]}>
                        <Ionicons
                          name="lock-closed-outline"
                          size={16}
                          color={focusedField === 'password' ? primary : iconMuted}
                        />
                        <TextInput
                          style={s.input}
                          placeholder="Password"
                          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                          secureTextEntry={!showAddPassword}
                          value={addPassword}
                          onChangeText={setAddPassword}
                          editable={!addBusy}
                          onSubmitEditing={onAdd}
                          onFocus={() => setFocusedField('password')}
                          onBlur={() => setFocusedField((f) => (f === 'password' ? null : f))}
                        />
                        <ClayPasswordToggle
                          visible={showAddPassword}
                          onToggle={() => setShowAddPassword((v) => !v)}
                          isDark={isDark}
                        />
                      </View>
                    </View>

                    {addError ? <Text style={s.errorText}>{addError}</Text> : null}

                    <View style={s.addActions}>
                      <Pressable
                        style={({ pressed }) => [
                          s.btn,
                          s.btnGhost,
                          clay(isDark, 'sm'),
                          pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                        ]}
                        onPress={() => {
                          setAddMode(false);
                          setShowAddPassword(false);
                          setFocusedField(null);
                        }}
                        disabled={addBusy}
                      >
                        <Text style={s.btnGhostText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          s.btnPrimaryOuter,
                          clayPuck(isDark, primary),
                          pressed && !addBusy && { opacity: 0.92, transform: [{ scale: 0.97 }] },
                          addBusy && { opacity: 0.7 },
                        ]}
                        onPress={onAdd}
                        disabled={addBusy}
                      >
                        <View style={[s.btn, s.btnPrimary]}>
                          <LinearGradient
                            colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={s.btnPrimarySheen}
                            pointerEvents="none"
                          />
                          {addBusy ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={s.btnPrimaryText}>Log in &amp; add</Text>
                          )}
                        </View>
                      </Pressable>
                    </View>
                  </Animated.View>
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const getStyles = (colors: any, isDark: boolean, primary: string) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(2,6,23,0.72)' : 'rgba(15,23,42,0.52)',
      justifyContent: 'flex-end',
    },
    backdropPress: { ...StyleSheet.absoluteFillObject },
    kav: { width: '100%' },
    sheet: {
      width: '100%',
      maxWidth: 540,
      alignSelf: 'center',
      // Soft clay base — slightly darker than row fills so raised cards pop
      backgroundColor: isDark ? '#121826' : '#E7EBF4',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      borderBottomLeftRadius: Platform.OS === 'web' ? 28 : 0,
      borderBottomRightRadius: Platform.OS === 'web' ? 28 : 0,
      paddingHorizontal: 18,
      paddingTop: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
      marginBottom: Platform.OS === 'web' ? 18 : 0,
    },
    sheetSheen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 140,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
    },
    grabber: {
      alignSelf: 'center',
      width: 44,
      height: 6,
      borderRadius: 4,
      backgroundColor: isDark ? '#1E293B' : '#D5DCE8',
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 14,
      paddingHorizontal: 2,
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
      marginLeft: 2,
    },
    loadingBox: { flex: 1, paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
    list: { flexGrow: 0 },
    listContent: { paddingTop: 2, paddingBottom: 12, paddingHorizontal: 2 },

    rowOuter: {
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 13,
      borderRadius: 22,
      // No overflow:hidden — clay dual shadows must paint outside
    },
    rowIdle: {
      backgroundColor: isDark ? '#1A2332' : '#F4F7FD',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
    },
    rowActive: {
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.22) : schoolColorWithAlpha(primary, 0.12),
      borderWidth: 1,
      borderColor: isDark ? schoolColorWithAlpha(primary, 0.4) : schoolColorWithAlpha(primary, 0.28),
    },
    rowPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    avatarRing: {
      width: 54,
      height: 54,
      borderRadius: 27,
      padding: 3,
      marginRight: 13,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#243044' : '#EEF2F7',
    },
    avatarRingActive: {
      backgroundColor: primary,
      padding: 3,
    },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E7EB' },
    avatarBadge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: '#EF4444',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    rowMeta: { flex: 1, minWidth: 0 },
    rowName: {
      fontSize: 15.5,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : '#2A3142',
      letterSpacing: -0.2,
    },
    rowSubLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4, flexWrap: 'wrap' },
    activeTag: {
      backgroundColor: primary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    activeTagText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.45,
      textTransform: 'uppercase',
    },
    rowSubMuted: { fontSize: 12.5, color: isDark ? '#94A3B8' : '#6B7590', fontWeight: '500' },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chevronPuck: {
      width: 28,
      height: 28,
      borderRadius: 12,
      backgroundColor: isDark ? '#1E293B' : '#EEF2F7',
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionBtn: {
      width: 32,
      height: 32,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionBtnNeutral: {
      backgroundColor: isDark ? '#1E293B' : '#EEF2F7',
    },
    actionBtnDanger: {
      backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : '#FEE2E2',
    },

    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 13,
      marginTop: 2,
      marginBottom: 4,
      borderRadius: 22,
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.14) : schoolColorWithAlpha(primary, 0.08),
      borderWidth: 1,
      borderColor: isDark ? schoolColorWithAlpha(primary, 0.35) : schoolColorWithAlpha(primary, 0.22),
    },
    addIcon: {
      width: 54,
      height: 54,
      borderRadius: 27,
      marginRight: 13,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.2) : '#F4F7FD',
    },

    addForm: {
      paddingVertical: 18,
      paddingHorizontal: 16,
      marginTop: 8,
    },
    addFormHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      marginBottom: 16,
    },
    addFormBadge: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.25) : schoolColorWithAlpha(primary, 0.12),
    },
    addFormTitle: {
      fontSize: 14.5,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#2A3142',
      letterSpacing: -0.2,
      marginBottom: 3,
    },
    addFormHint: {
      fontSize: 12,
      color: isDark ? '#94A3B8' : '#6B7590',
      fontWeight: '500',
      lineHeight: 16,
    },
    inputOuter: {
      borderRadius: 18,
      padding: 6,
      marginBottom: 12,
      backgroundColor: isDark ? '#1A2332' : '#EFF2F9',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)',
    },
    inputInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'web' ? 12 : 11,
      borderRadius: 13,
    },
    input: {
      flex: 1,
      fontSize: 14.5,
      fontWeight: '600',
      color: isDark ? '#F1F5F9' : '#2A3142',
      letterSpacing: -0.15,
      paddingVertical: 2,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
    },
    errorText: {
      color: '#DC2626',
      fontSize: 12.5,
      marginTop: 10,
      marginLeft: 2,
      fontWeight: '600',
    },
    addActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
    btn: {
      flex: 1,
      paddingVertical: 15,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnGhost: {
      backgroundColor: isDark ? '#1A2332' : '#F4F7FD',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
    },
    btnGhostText: { fontSize: 14.5, fontWeight: '700', color: isDark ? '#F1F5F9' : '#2A3142' },
    btnPrimaryOuter: {
      flex: 1,
      borderRadius: 16,
      backgroundColor: primary,
    },
    btnPrimary: {
      backgroundColor: primary,
      borderBottomWidth: 1.5,
      borderBottomColor: 'rgba(0,0,0,0.18)',
      overflow: 'hidden',
    },
    btnPrimarySheen: {
      ...StyleSheet.absoluteFillObject,
    },
    btnPrimaryText: { fontSize: 14.5, fontWeight: '800', color: '#fff', letterSpacing: 0.15 },
  });
