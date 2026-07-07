import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/hooks/useAuth';
import { useTheme } from '@/src/hooks/useTheme';
import { showAlert } from '@/src/components/CustomAlert';
import { AuthService } from '@/src/services/authService';
import LogoLoader from '../src/components/LogoLoader';
import AdminHeaderCard from '@/src/components/AdminHeaderCard';

import { useLoginTheme } from '@/src/hooks/useLoginTheme';
import {
  FloatingInput,
  SignInButton,
  LoginAmbientBackground,
  LoginCardHeader,
} from '@/src/components/auth/LoginShared';

// ─── Main Screen ──────────────────────────────────────────────────────────────

const AdminLoginScreen: React.FC = () => {
  const C = useLoginTheme();
  const styles = getStyles(C);
  const router = useRouter();
  const { t } = useTranslation();
  const { toggleTheme } = useTheme();
  const { user, loading: authLoading, signIn } = useAuth();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // ── Restore saved credentials ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('admin_saved_email');
        const savedPassword = Platform.OS !== 'web'
          ? await SecureStore.getItemAsync('admin_saved_password')
          : await AsyncStorage.getItem('admin_saved_password');
        const autoLogin = await AsyncStorage.getItem('admin_auto_login');

        if (savedEmail && savedPassword) {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberMe(true);

          if (autoLogin === 'true') {
            // Silently attempt to log in using the saved credentials
            setLoading(true);
            try {
              const response = await signIn(savedEmail, savedPassword);
              // If the auto-login resolved to a non-admin role, sign out (wrong portal)
              const autoRole = response?.session?.validatedUser?.role?.code;
              if (response?.session && autoRole !== 'admin' && autoRole !== 'principal') {
                await AuthService.signOut();
              }
            } catch (err) {
              // Ignore silent login errors, let user press sign in
            } finally {
              setLoading(false);
            }
          }
        }
      } catch (_) { }
    })();
  }, []);

  if (authLoading || user) {
    return (
      <View style={styles.loadingScreen}>
        <LogoLoader size={56} color={C.accent} />
      </View>
    );
  }

  // ── Validate & login ───────────────────────────────────────────────────────
  const handleLogin = async () => {
    let hasErr = false;
    if (!email) { setEmailError('Email is required'); hasErr = true; }
    if (!password) { setPasswordError('Password is required'); hasErr = true; }
    if (hasErr) return;

    setLoading(true);
    try {
      const response = await signIn(email, password);

      if (response.error || !response.session) {
        showAlert({ type: 'error', title: 'Login Failed', message: response.error || 'Invalid credentials' });
        return;
      }

      const userRole = response.session.validatedUser.role.code;

      if (userRole === 'admin') {
        if (rememberMe) {
          await AsyncStorage.setItem('admin_saved_email', email);
          Platform.OS !== 'web'
            ? await SecureStore.setItemAsync('admin_saved_password', password)
            : await AsyncStorage.setItem('admin_saved_password', password);
          await AsyncStorage.setItem('admin_auto_login', 'true');
        } else {
          await AsyncStorage.removeItem('admin_saved_email');
          Platform.OS !== 'web'
            ? await SecureStore.deleteItemAsync('admin_saved_password')
            : await AsyncStorage.removeItem('admin_saved_password');
          await AsyncStorage.removeItem('admin_auto_login');
        }
      } else {
        showAlert({
          type: 'warning',
          title: 'Access Restricted',
          message: 'You do not have administrative privileges.',
        });
        await AuthService.signOut();
      }
    } catch (err: any) {
      showAlert({ type: 'error', title: 'Login Failed', message: err.message || 'Invalid credentials' });
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <LoginAmbientBackground />
      <StatusBar barStyle={C.isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.shell}>
            <SafeAreaView edges={['top']} style={styles.topArea}>
              <View style={styles.themeRow}>
                <View style={styles.themeToggle}>
                  <Ionicons
                    name={C.isDark ? 'moon' : 'sunny'}
                    size={14}
                    color={C.accent}
                  />
                  <Text style={styles.themeToggleText}>
                    {C.isDark ? 'Dark mode' : 'Light mode'}
                  </Text>
                  <Switch
                    value={C.isDark}
                    onValueChange={toggleTheme}
                    thumbColor="#FFFFFF"
                    trackColor={{
                      false: 'rgba(107,47,160,0.22)',
                      true: C.accentDark,
                    }}
                    style={styles.themeSwitch}
                  />
                </View>
              </View>

              <View style={styles.headerWrap}>
                <AdminHeaderCard
                  variant="login"
                  portalBadge="ADMIN"
                  tagline="Control Panel · Reports · System Access"
                />
              </View>
            </SafeAreaView>

            <View style={styles.body}>
            <Animated.View
              entering={FadeInUp.delay(80).duration(600).springify()}
              style={styles.card}
            >
              <LoginCardHeader
                portalBadge="ADMIN"
                tagline="Full system control and reporting."
                title={t('login.welcome_admin') || 'Welcome, Admin'}
                subtitle={t('login.signin_admin') || 'Sign in to the control panel'}
              />

              {/* Email */}
              <View style={styles.fieldGap}>
                <FloatingInput
                  label={'Admin Email'}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setEmailError(''); }}
                  icon="shield-outline"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  hasError={!!emailError}
                  errorText={emailError}
                  delay={200}
                />
              </View>

              {/* Password */}
              <View style={styles.fieldGap}>
                <FloatingInput
                  label={t('password') || 'Password'}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setPasswordError(''); }}
                  icon="lock-closed-outline"
                  secureTextEntry={!showPassword}
                  hasError={!!passwordError}
                  errorText={passwordError}
                  delay={280}
                  rightAction={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={19}
                        color={C.inkSoft}
                      />
                    </TouchableOpacity>
                  }
                />
              </View>

              {/* Remember me + Forgot password */}
              <Animated.View
                entering={FadeInDown.delay(360).duration(500)}
                style={styles.rememberRow}
              >
                <TouchableOpacity
                  onPress={() => setRememberMe(!rememberMe)}
                  style={styles.rememberTap}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.rememberBox,
                    rememberMe && styles.rememberBoxActive,
                  ]}>
                    {rememberMe && (
                      <Ionicons name="checkmark" size={11} color="#fff" />
                    )}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/forgot-password')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.forgotText}>
                    {t('forgotPassword') || 'Forgot password?'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Sign in button */}
              <View style={styles.btnWrap}>
                <SignInButton
                  onPress={handleLogin}
                  loading={loading}
                  label={t('signIn') || 'Sign In'}
                />
              </View>

              {/* Trust strip */}
              <Animated.View
                entering={FadeInUp.delay(600).duration(500)}
                style={styles.trustStrip}
              >
                <View style={styles.trustItem}>
                  <Ionicons name="lock-closed" size={12} color={C.accent} />
                  <Text style={styles.trustText}>256-bit encrypted</Text>
                </View>
                <View style={styles.trustItem}>
                  <Ionicons name="shield-outline" size={12} color={C.accent} />
                  <Text style={styles.trustText}>Secure login</Text>
                </View>
                <View style={styles.trustItem}>
                  <Ionicons name="server-outline" size={12} color={C.accent} />
                  <Text style={styles.trustText}>Data protected</Text>
                </View>
              </Animated.View>
            </Animated.View>

            {/* Help row */}
            <Animated.View
              entering={FadeInUp.delay(700).duration(500)}
              style={styles.helpRow}
            >
              <Ionicons name="help-circle-outline" size={14} color={C.inkGhost} />
              <Text style={styles.helpText}>
                Having trouble?{' '}
                <Text style={styles.helpLink}>Contact your school admin</Text>
              </Text>
            </Animated.View>

            {/* Footer */}
            <Animated.View
              entering={FadeInUp.delay(800).duration(400)}
              style={styles.footer}
            >
              <View style={styles.footerDivider} />
              <Text style={styles.footerText}>
                Powered by{' '}
                <Text style={styles.footerBrand}>NexSyrus</Text>
              </Text>
            </Animated.View>

          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminLoginScreen;

// ─── Stylesheet ───────────────────────────────────────────────────────────────

const getStyles = (C: ReturnType<typeof useLoginTheme>) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    ...Platform.select({
      web: {
        justifyContent: 'center',
        minHeight: '100%',
        paddingVertical: 32,
      } as any,
    }),
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 8 : 12,
    paddingBottom: 36,
  },
  topArea: {
    width: '100%',
  },
  themeRow: {
    alignItems: 'flex-end',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 34,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 999,
    backgroundColor: C.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: C.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(107,47,160,0.10)',
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.inkSoft,
  },
  themeSwitch: {
    transform: [{ scale: 0.72 }],
  },
  headerWrap: {
    paddingBottom: 12,
    width: '100%',
    ...Platform.select({
      web: { alignItems: 'center' } as any,
    }),
  },

  body: {
    width: '100%',
    paddingBottom: 28,
  },

  card: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 24,
    paddingTop: 20,
    borderWidth: 1,
    borderColor: C.isDark ? 'rgba(255,255,255,0.08)' : C.borderNeutral,
    overflow: 'hidden',
    ...C.shadow.lg,
    shadowColor: C.isDark ? '#000' : C.shadow.color,
    ...Platform.select({
      web: {
        width: '100%',
        boxShadow: C.isDark
          ? '0 24px 52px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,255,255,0.05)'
          : '0 18px 44px rgba(107,47,160,0.12)',
      } as any,
    }),
  },

  // ── Input ─────────────────────────────────────────────────────────────────
  fieldGap: {
    marginBottom: 16,
  },
  inputOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 58,
    paddingHorizontal: 14,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  inputIconWrap: {
    width: 28,
    alignItems: 'center',
    marginRight: 4,
  },
  inputLabelArea: {
    flex: 1,
    height: 58,
    justifyContent: 'center',
    paddingTop: 14,
  },
  floatingLabel: {
    position: 'absolute',
    left: 0,
    fontSize: 14,
    fontWeight: '500',
    transformOrigin: 'left',
  },
  textInput: {
    fontSize: 15,
    color: C.ink,
    fontWeight: '500',
    paddingVertical: 0,
    height: 26,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  inputRightSlot: {
    paddingLeft: 8,
  },
  errorLabel: {
    fontSize: 11,
    color: C.error,
    marginTop: 5,
    marginLeft: 14,
    fontWeight: '500',
  },

  // ── Remember / Forgot row ─────────────────────────────────────────────────
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
    marginTop: 4,
  },
  rememberTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rememberBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.borderNeutral,
    backgroundColor: C.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberBoxActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  rememberText: {
    fontSize: 13,
    color: C.inkSoft,
    fontWeight: '500',
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
  },

  // ── Sign In Button ────────────────────────────────────────────────────────
  btnWrap: {
    marginBottom: 20,
  },
  btnTouch: {
    borderRadius: 16,
    overflow: 'hidden',
    ...C.shadow.md,
    shadowColor: C.accentDeep,
  },
  btnGradient: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  btnArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Trust strip ───────────────────────────────────────────────────────────
  trustStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(107,47,160,0.10)',
    backgroundColor: C.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(107,47,160,0.05)',
  },
  trustText: {
    fontSize: 11,
    color: C.inkSoft,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Help + Footer ─────────────────────────────────────────────────────────
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 20,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: C.inkGhost,
    fontWeight: '400',
  },
  helpLink: {
    color: C.accent,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  footerDivider: {
    width: 36,
    height: 1,
    backgroundColor: C.borderNeutral,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 11,
    color: C.inkGhost,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '400',
  },
  footerBrand: {
    fontWeight: '700',
    color: C.inkSoft,
    letterSpacing: 1.2,
  },
});