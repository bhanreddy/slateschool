import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppTextInput from '../components/AppTextInput';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import KeyboardAwareScreen from '@/components/keyboard/KeyboardAwareScreen';
import { alertCompat } from '../utils/crossPlatformAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import AdminHeader from '../components/AdminHeader';
import { UpiSettingsService } from '../services/upiSettingsService';
import { APIError } from '../services/apiClient';
import * as Haptics from '../utils/haptics';
import { styles as themeStyles } from '@/src/theme/styles';

/** Mode B hybrid: dark glass surfaces + clay amber CTA (finance accent). */
const T = {
  bg: '#0B0D12',
  glass: 'rgba(255,255,255,0.07)',
  glassStrong: 'rgba(255,255,255,0.11)',
  border: 'rgba(255,255,255,0.14)',
  borderSoft: 'rgba(255,255,255,0.08)',
  text: '#F4F6FB',
  textMuted: 'rgba(244,246,251,0.62)',
  textDim: 'rgba(244,246,251,0.42)',
  accent: '#F5A623',
  accentSoft: 'rgba(245,166,35,0.14)',
  accentBorder: 'rgba(245,166,35,0.35)',
  success: '#34D399',
  successSoft: 'rgba(52,211,153,0.12)',
  successBorder: 'rgba(52,211,153,0.35)',
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.12)',
  dangerBorder: 'rgba(248,113,113,0.4)',
  radius: { card: 22, field: 16, btn: 16, chip: 999 },
} as const;

function validUpiShape(s: string): boolean {
  const t = s.trim();
  if (!t.includes('@')) return false;
  const at = t.lastIndexOf('@');
  return at > 0 && at < t.length - 1 && !/\s/.test(t);
}

function PressScale({
  children,
  onPress,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) s.value = withTiming(0.97, { duration: 90 });
      }}
      onPressOut={() => {
        s.value = withTiming(1, { duration: 120 });
      }}
      onPress={onPress}
      hitSlop={8}
      style={Platform.OS === 'web' ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as object) : undefined}
    >
      <Animated.View style={[style, a, disabled && { opacity: 0.45 }]}>{children}</Animated.View>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  trailing,
  maxLength,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  trailing?: React.ReactNode;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const focus = useSharedValue(0);
  const border = useAnimatedStyle(() => ({
    borderColor: error
      ? T.danger
      : interpolateColor(focus.value, [0, 1], [T.borderSoft, T.accent]),
  }));

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.fieldShell, border]}>
        <AppTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.textDim}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
          maxLength={maxLength}
          onFocus={() => {
            focus.value = withTiming(1, { duration: 150 });
          }}
          onBlur={() => {
            focus.value = withTiming(0, { duration: 150 });
          }}
          style={[themeStyles.inputInChrome, styles.input]}
        />
        {trailing ? <View style={styles.fieldTrailing}>{trailing}</View> : null}
      </Animated.View>
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

function SkeletonBlock({ h, w, r = 12 }: { h: number; w?: number | string; r?: number }) {
  return (
    <View
      style={{
        height: h,
        width: w as number | undefined,
        alignSelf: w ? undefined : 'stretch',
        borderRadius: r,
        backgroundColor: 'rgba(255,255,255,0.06)',
        marginBottom: 12,
      }}
    />
  );
}

/**
 * Admin-only: configure school UPI VPA + payee display name for fee QR.
 * Full UPI ID is shown so staff can verify the saved VPA.
 */
export default function UPISettingsScreen() {
  const mounted = useRef(true);
  const saveOkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [baseline, setBaseline] = useState({ upi_id: '', display_name: '' });
  const [upiTouched, setUpiTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    return () => {
      mounted.current = false;
      if (saveOkTimer.current) clearTimeout(saveOkTimer.current);
    };
  }, []);

  const load = useCallback(async () => {
    if (mounted.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await UpiSettingsService.get();
      if (mounted.current) {
        const next = {
          upi_id: data.upi_id ?? '',
          display_name: data.display_name ?? '',
        };
        setUpiId(next.upi_id);
        setDisplayName(next.display_name);
        setBaseline(next);
        setUpiTouched(false);
        setNameTouched(false);
        setSaveOk(false);
        setSaveError(null);
      }
    } catch (e) {
      const msg = e instanceof APIError ? e.message : 'Could not load UPI settings.';
      if (mounted.current) setError(msg);
      console.error('Button action failed:', e);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upiValid = useMemo(() => validUpiShape(upiId), [upiId]);
  const nameValid = useMemo(() => {
    const t = displayName.trim();
    return t.length > 0 && t.length <= 80;
  }, [displayName]);

  const dirty = useMemo(() => {
    return upiId.trim() !== baseline.upi_id.trim() || displayName.trim() !== baseline.display_name.trim();
  }, [upiId, displayName, baseline]);

  const canSave = upiValid && nameValid && dirty && !saving;

  const upiError = useMemo(() => {
    if (!upiTouched || !upiId.trim()) return null;
    if (!upiValid) return 'Include @ with text on both sides, e.g. schoolname@okaxis';
    return null;
  }, [upiTouched, upiId, upiValid]);

  const nameError = useMemo(() => {
    if (!nameTouched) return null;
    if (!displayName.trim()) return 'Add the name parents will see in their UPI app';
    if (displayName.trim().length > 80) return 'Keep the display name under 80 characters';
    return null;
  }, [nameTouched, displayName]);

  const isConfigured = Boolean(baseline.upi_id && baseline.display_name);

  const onSave = async () => {
    setUpiTouched(true);
    setNameTouched(true);
    if (!upiValid || !nameValid) {
      const hint = 'Enter a valid UPI ID (must contain @) and a display name.';
      setSaveError(hint);
      alertCompat('Check fields', hint);
      return;
    }
    if (!dirty) return;

    setSaving(true);
    setSaveError(null);
    setError(null);
    setSaveOk(false);
    try {
      await UpiSettingsService.put({
        upi_id: upiId.trim(),
        display_name: displayName.trim(),
      });
      if (mounted.current) {
        setSaveError(null);
        setSaveOk(true);
        setBaseline({ upi_id: upiId.trim(), display_name: displayName.trim() });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (saveOkTimer.current) clearTimeout(saveOkTimer.current);
        saveOkTimer.current = setTimeout(() => {
          if (mounted.current) setSaveOk(false);
        }, 3200);
      }
    } catch (e) {
      const msg = e instanceof APIError ? e.message : 'Save failed.';
      if (mounted.current) {
        setSaveError(msg);
        setError(msg);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      console.error('Button action failed:', e);
      alertCompat('Error', msg);
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const previewName = displayName.trim() || 'Payee name';
  const previewVpa = upiId.trim() || 'yourschool@upi';

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={['#0F1219', '#0B0D12', '#0E1016']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.blob, styles.blobTeal]} />
        <View style={[styles.blob, styles.blobAmber]} />
      </View>

      <AdminHeader title="UPI fee settings" showBackButton />

      <KeyboardAwareScreen
        variant="scroll"
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bottomOffset={28}
      >
        <Animated.View entering={FadeInDown.duration(280)} style={styles.hero}>
          <LinearGradient
            colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.heroTop}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="qr-code-outline" size={24} color={T.accent} />
            </View>
            <View
              style={[
                styles.statusChip,
                isConfigured ? styles.statusChipOn : styles.statusChipOff,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isConfigured ? T.success : T.textDim },
                ]}
              />
              <Text style={styles.statusChipText}>
                {isConfigured ? 'Configured' : 'Not set yet'}
              </Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>School UPI ID</Text>
          <Text style={styles.heroSub}>
            Parents scan a QR to pay fees to this VPA. Changes apply to every new collect-fee QR.
          </Text>
        </Animated.View>

        {loading ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.card}>
            <SkeletonBlock h={18} w={120} />
            <SkeletonBlock h={52} r={16} />
            <SkeletonBlock h={14} w={180} />
            <View style={{ height: 12 }} />
            <SkeletonBlock h={18} w={160} />
            <SkeletonBlock h={52} r={16} />
            <View style={{ height: 20 }} />
            <SkeletonBlock h={52} r={16} />
          </Animated.View>
        ) : (
          <>
            {error ? (
              <Animated.View entering={FadeInDown.delay(40).duration(260)}>
                <Pressable
                  onPress={() => {
                    void load();
                  }}
                  style={[styles.errorBanner, Platform.OS === 'web' && { cursor: 'pointer' }]}
                >
                  <Ionicons name="warning-outline" size={18} color="#FCA5A5" />
                  <View style={styles.errorCopy}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Text style={styles.retry}>Tap to retry</Text>
                  </View>
                </Pressable>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(60).duration(300)} style={styles.card}>
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />

              <Field
                label="UPI ID (VPA)"
                value={upiId}
                onChangeText={(t) => {
                  setSaveError(null);
                  setSaveOk(false);
                  setUpiTouched(true);
                  setUpiId(t);
                }}
                placeholder="e.g. yourschool@okaxis"
                hint={!upiError ? 'Must include @ — basic VPA shape check only.' : undefined}
                error={upiError}
                trailing={
                  upiId.trim().length > 0 ? (
                    <Ionicons
                      name={upiValid ? 'checkmark-circle' : 'close-circle'}
                      size={20}
                      color={upiValid ? T.success : T.danger}
                    />
                  ) : null
                }
              />

              <Field
                label="Account holder display name"
                value={displayName}
                onChangeText={(t) => {
                  setSaveError(null);
                  setSaveOk(false);
                  setNameTouched(true);
                  setDisplayName(t);
                }}
                placeholder="Shown as payee name in UPI apps"
                hint={!nameError ? `${displayName.trim().length}/80 · Shown on payment screens` : undefined}
                error={nameError}
                maxLength={80}
                autoCapitalize="words"
              />

              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>How parents will see it</Text>
                <View style={styles.previewRow}>
                  <View style={styles.previewIcon}>
                    <Ionicons name="phone-portrait-outline" size={18} color={T.accent} />
                  </View>
                  <View style={styles.previewCopy}>
                    <Text style={styles.previewName} numberOfLines={1}>
                      {previewName}
                    </Text>
                    <Text style={styles.previewVpa} numberOfLines={1}>
                      {previewVpa}
                    </Text>
                  </View>
                  <View style={styles.previewQrHint}>
                    <Ionicons name="qr-code" size={22} color={T.textDim} />
                  </View>
                </View>
              </View>

              <PressScale onPress={onSave} disabled={!canSave} style={styles.saveOuter}>
                <LinearGradient
                  colors={canSave ? ['#E8900C', T.accent] : ['#3A3F4A', '#2A2E36']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveGrad}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  {saving ? (
                    <ActivityIndicator color="#0B0D12" />
                  ) : (
                    <View style={styles.saveInner}>
                      <Ionicons
                        name={dirty ? 'shield-checkmark-outline' : 'checkmark-done-outline'}
                        size={18}
                        color={canSave ? '#0B0D12' : T.textDim}
                      />
                      <Text style={[styles.saveText, !canSave && styles.saveTextMuted]}>
                        {dirty ? 'Save UPI settings' : 'All changes saved'}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </PressScale>

              {saveError ? (
                <Animated.View entering={FadeIn.duration(200)} style={styles.saveErrorBox}>
                  <Ionicons name="alert-circle" size={16} color={T.danger} />
                  <Text style={styles.saveErrorText}>{saveError}</Text>
                </Animated.View>
              ) : null}

              {saveOk ? (
                <Animated.View
                  entering={FadeIn.duration(220)}
                  exiting={FadeOut.duration(180)}
                  style={styles.saveOkBox}
                >
                  <Ionicons name="checkmark-circle" size={16} color={T.success} />
                  <Text style={styles.saveOkText}>
                    Saved. New fee QRs will use this UPI ID.
                  </Text>
                </Animated.View>
              ) : null}
            </Animated.View>
          </>
        )}

        <Animated.View entering={FadeInDown.delay(120).duration(280)}>
          <Text style={styles.footerNote}>
            Admins and principals can edit these values. Accounts staff use them when generating payment QRs.
          </Text>
        </Animated.View>
      </KeyboardAwareScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  flex: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingBottom: 48, paddingHorizontal: 18 },

  blob: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 280,
  },
  blobTeal: {
    top: -70,
    right: -90,
    backgroundColor: '#0D9488',
    opacity: 0.16,
  },
  blobAmber: {
    bottom: 80,
    left: -100,
    backgroundColor: '#F59E0B',
    opacity: 0.12,
  },

  hero: {
    marginTop: 14,
    marginBottom: 18,
    borderRadius: T.radius.card,
    padding: 20,
    backgroundColor: T.glass,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: T.border,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: T.accentSoft,
    borderWidth: 1,
    borderColor: T.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: T.radius.chip,
    borderWidth: 1,
  },
  statusChipOn: {
    backgroundColor: T.successSoft,
    borderColor: T.successBorder,
  },
  statusChipOff: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: T.borderSoft,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.text,
    letterSpacing: 0.2,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: T.text,
    letterSpacing: -0.4,
  },
  heroSub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: T.textMuted,
  },

  card: {
    borderRadius: T.radius.card,
    padding: 20,
    backgroundColor: T.glassStrong,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: T.border,
    overflow: 'hidden',
  },

  fieldBlock: { marginBottom: 18 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: T.textMuted,
    marginBottom: 8,
    letterSpacing: 0.15,
  },
  fieldShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: T.radius.field,
    borderWidth: 1.5,
    borderColor: T.borderSoft,
    paddingRight: 12,
    minHeight: 52,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: T.text,
  },
  fieldTrailing: { marginLeft: 4 },
  hint: { marginTop: 8, fontSize: 12, color: T.textDim, lineHeight: 17 },
  fieldError: { marginTop: 8, fontSize: 12, color: T.danger, lineHeight: 17, fontWeight: '500' },

  previewCard: {
    marginTop: 4,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: T.borderSoft,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: T.textDim,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: T.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCopy: { flex: 1, minWidth: 0 },
  previewName: {
    fontSize: 15,
    fontWeight: '700',
    color: T.text,
    letterSpacing: -0.2,
  },
  previewVpa: {
    marginTop: 2,
    fontSize: 13,
    color: T.textMuted,
  },
  previewQrHint: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveOuter: {
    marginTop: 20,
    borderRadius: T.radius.btn,
    overflow: 'hidden',
    ...(Platform.OS === 'android'
      ? { elevation: 4 }
      : {
          shadowColor: T.accent,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.28,
          shadowRadius: 14,
        }),
  },
  saveGrad: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: T.radius.btn,
    overflow: 'hidden',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  saveInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B0D12',
    letterSpacing: 0.15,
  },
  saveTextMuted: { color: T.textDim },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: T.dangerSoft,
    borderWidth: 1,
    borderColor: T.dangerBorder,
    marginBottom: 14,
  },
  errorCopy: { flex: 1 },
  errorText: { color: '#FECACA', fontSize: 13, lineHeight: 19 },
  retry: { marginTop: 4, fontSize: 12, color: T.accent, fontWeight: '700' },

  saveErrorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: T.dangerSoft,
    borderWidth: 1,
    borderColor: T.dangerBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveErrorText: { flex: 1, color: '#FECACA', fontSize: 13, lineHeight: 19 },
  saveOkBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: T.successSoft,
    borderWidth: 1,
    borderColor: T.successBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveOkText: { flex: 1, color: '#A7F3D0', fontSize: 13, lineHeight: 19, fontWeight: '500' },

  footerNote: {
    marginTop: 22,
    fontSize: 12,
    color: T.textDim,
    lineHeight: 18,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
});
