import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';
import PremiumButton from '@/src/components/PremiumButton';
import { clayInset } from '@/src/theme/clayStyles';

import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Pressable,
  StatusBar, ScrollView, Platform, useWindowDimensions,
  Animated as RNAnimated,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, {
  FadeIn, FadeInDown, FadeInUp, ZoomIn,
  useSharedValue, useAnimatedStyle, withSpring, interpolateColor,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { NoticeService, Notice, CreateNoticeRequest } from '../../src/services/commonServices';
import { ClassService, ClassInfo } from '../../src/services/classService';
import { Modal } from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
import { useTranslation } from 'react-i18next';
import { t_field } from '../../src/utils/lang';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — rose clay accent (extends project clay system)
// ─────────────────────────────────────────────────────────────────────────────
const ROSE = '#EC4899';
const ROSE_DEEP = '#DB2777';
const ROSE_SOFT = '#FDF2F8';
const ROSE_MID = '#FCE7F3';
const ROSE_EDGE = '#F9A8D4';

const PRIORITY_META = {
  high: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', dot: '#EF4444', icon: 'alert-circle' as const, label: 'HIGH', hint: 'Urgent — read now' },
  medium: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', dot: '#F59E0B', icon: 'warning' as const, label: 'MEDIUM', hint: 'Important update' },
  low: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', dot: '#3B82F6', icon: 'information' as const, label: 'LOW', hint: 'FYI / soft reminder' },
  normal: { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB', dot: '#9CA3AF', icon: 'remove-circle' as const, label: 'NORMAL', hint: '' },
};

const AUDIENCE_META: Record<string, { icon: string; color: string; bg: string; soft: string; lib: 'ion' | 'fa5'; desc: string }> = {
  all: { icon: 'globe-outline', color: '#7C3AED', bg: '#7C3AED', soft: '#EDE9FE', lib: 'ion', desc: 'Everyone' },
  students: { icon: 'graduation-cap', color: '#2563EB', bg: '#2563EB', soft: '#DBEAFE', lib: 'fa5', desc: 'All students' },
  staff: { icon: 'briefcase-outline', color: '#D97706', bg: '#D97706', soft: '#FEF3C7', lib: 'ion', desc: 'Teachers & staff' },
  parents: { icon: 'people-outline', color: '#059669', bg: '#059669', soft: '#D1FAE5', lib: 'ion', desc: 'Parent portal' },
  class: { icon: 'layers-outline', color: ROSE, bg: ROSE, soft: ROSE_MID, lib: 'ion', desc: 'One class only' },
};

const TITLE_MAX = 80;
const BODY_MAX = 500;

// Soft pulse — used sparingly (pinned / high priority only)
const PulseDot = ({ color, size = 6 }: { color: string; size?: number }) => {
  const scale = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(scale, { toValue: 1.85, duration: 900, useNativeDriver: true }),
        RNAnimated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [scale]);
  return (
    <View style={{ width: size + 4, height: size + 4, justifyContent: 'center', alignItems: 'center' }}>
      <RNAnimated.View style={{
        position: 'absolute',
        width: size + 4, height: size + 4,
        borderRadius: (size + 4) / 2,
        backgroundColor: color, opacity: 0.22,
        transform: [{ scale }],
      }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
};

const AudienceIcon = ({ type, size = 12, color }: { type: string; size?: number; color: string }) => {
  const m = AUDIENCE_META[type] ?? AUDIENCE_META.all;
  if (m.lib === 'fa5') return <FontAwesome5 name={m.icon as any} size={size} color={color} />;
  return <Ionicons name={m.icon as any} size={size} color={color} />;
};

/** Springy clay toggle — UI-thread only */
function ClayToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(value ? 1 : 0, { damping: 16, stiffness: 220 });
  }, [value, p]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * 22 }] }));
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], ['rgba(148,163,184,0.35)', ROSE]),
  }));
  return (
    <Pressable onPress={() => onChange(!value)} hitSlop={10} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <Animated.View style={[{ width: 52, height: 30, borderRadius: 15, padding: 3 }, track]}>
        <Animated.View style={[{
          width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF',
          ...(Platform.OS === 'android'
            ? { elevation: 2 }
            : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 2 }),
        }, knob]} />
      </Animated.View>
    </Pressable>
  );
}

/** Press scale wrapper — transform only; outer view keeps flex layout intact */
function PressScale({
  onPress, children, disabled, style,
}: {
  onPress?: () => void; children: React.ReactNode; disabled?: boolean; style?: any;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[style, aStyle]}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => { if (!disabled) scale.value = withSpring(0.96, { damping: 18, stiffness: 320 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 220 }); }}
        style={style?.flex === 1 ? { flex: 1 } : undefined}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminNotices() {
  useTranslation();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const isWide = winW >= 720;

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<'all' | 'students' | 'staff' | 'parents' | 'class'>('all');
  const [priority, setPriority] = useState('medium');
  const [targetClassId, setTargetClassId] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [creating, setCreating] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const [bodyFocused, setBodyFocused] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const fabScale = useRef(new RNAnimated.Value(1)).current;
  const onFabIn = () => RNAnimated.spring(fabScale, { toValue: 0.92, useNativeDriver: true, friction: 6 }).start();
  const onFabOut = () => RNAnimated.spring(fabScale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();

  useEffect(() => { fetchNotices(); fetchClasses(); }, []);

  const fetchClasses = async () => {
    try { setClasses(await ClassService.getClasses()); } catch { /* ignore */ }
  };

  const fetchNotices = async () => {
    try {
      setLoading(true);
      setNotices(await NoticeService.getAll());
    } catch {
      alertCompat('Error', 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${Math.floor(seconds)}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
    return `${Math.floor(seconds / 31536000)}y ago`;
  };

  const filteredNotices = notices.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedNotices = [...filteredNotices].sort((a, b) =>
    (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)
  );

  const titleOk = title.trim().length > 0;
  const bodyOk = content.trim().length > 0;
  const classOk = audience !== 'class' || !!targetClassId;
  const canPublish = titleOk && bodyOk && classOk;

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setAttemptedSubmit(false);
    resetForm();
  }, []);

  const handleCreate = async () => {
    setAttemptedSubmit(true);
    if (!titleOk || !bodyOk) {
      alertCompat('Almost there', 'Add a title and body before publishing.');
      return;
    }
    if (!classOk) {
      alertCompat('Pick a class', 'Select which class should see this notice.');
      return;
    }
    try {
      setCreating(true);
      const payload: CreateNoticeRequest = {
        title: title.trim(),
        content: content.trim(),
        audience,
        priority,
        is_pinned: isPinned,
        target_class_id: audience === 'class' ? targetClassId : undefined,
      };
      await NoticeService.create(payload);
      alertCompat('Published', 'Your notice is live on the board.');
      closeModal();
      fetchNotices();
    } catch (error: any) {
      alertCompat('Error', error.response?.data?.error || 'Failed to create notice');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setContent(''); setAudience('all');
    setPriority('medium'); setTargetClassId(''); setIsPinned(false);
    setTitleFocused(false); setBodyFocused(false);
  };

  const pinnedCount = notices.filter(n => n.is_pinned).length;
  const highCount = notices.filter(n => (n.priority || '').toLowerCase() === 'high').length;

  const renderItem = useCallback(({ item, index }: { item: Notice; index: number }) => {
    const pKey = (item.priority || 'normal').toLowerCase() as keyof typeof PRIORITY_META;
    const pm = PRIORITY_META[pKey] ?? PRIORITY_META.normal;
    const am = AUDIENCE_META[item.audience] ?? AUDIENCE_META.all;
    const pinned = !!item.is_pinned;

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 55).duration(380).springify().damping(16)}>
        <PressScale>
          <View style={[styles.card, pinned && styles.cardPinned]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
              pointerEvents="none"
            />
            <View style={[styles.cardStripe, { backgroundColor: pm.dot }]} />
            <View style={styles.cardInner}>
              <View style={styles.cardTop}>
                <View style={styles.titleRow}>
                  {pinned && (
                    <View style={styles.pinBadge}>
                      <Ionicons name="pin" size={10} color={ROSE} />
                      <Text style={styles.pinText}>PINNED</Text>
                    </View>
                  )}
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {t_field(item.title, item.title_te)}
                  </Text>
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: pm.bg, borderColor: pm.border }]}>
                  {(pKey === 'high' || pinned) ? <PulseDot color={pm.dot} size={5} /> : (
                    <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: pm.dot }} />
                  )}
                  <Text style={[styles.priorityText, { color: pm.text }]}>{pm.label}</Text>
                </View>
              </View>

              <Text style={styles.cardContent} numberOfLines={2}>{t_field(item.content, item.content_te)}</Text>

              <View style={styles.cardFooter}>
                <View style={[styles.audiencePill, { backgroundColor: am.soft }]}>
                  <AudienceIcon type={item.audience} size={11} color={am.color} />
                  <Text style={[styles.audienceText, { color: am.color }]}>
                    {item.audience.charAt(0).toUpperCase() + item.audience.slice(1)}
                  </Text>
                </View>
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={11} color={theme.colors.textTertiary} style={{ marginRight: 3 }} />
                  <Text style={styles.dateText}>{formatTimeAgo(item.published_at || item.created_at)}</Text>
                </View>
              </View>
            </View>
          </View>
        </PressScale>
      </Animated.View>
    );
  }, [styles, theme.colors.textTertiary]);

  const priorityHint = PRIORITY_META[priority as keyof typeof PRIORITY_META]?.hint ?? '';
  const audienceHint = AUDIENCE_META[audience]?.desc ?? '';

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      <AdminHeader title="Notice Board" showBackButton={true} />

      {/* Search */}
      <View style={[styles.searchContainer, ds.searchBarWrapper, searchFocused && styles.searchFocused]}>
        <Ionicons
          name="search-outline" size={17}
          color={searchFocused ? ROSE : '#94A3B8'}
          style={styles.searchIcon}
        />
        <AppTextInput
          style={[ds.inputInChrome, styles.searchInput]}
          placeholder="Search notices..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn} hitSlop={8}>
            <Ionicons name="close" size={12} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      {!loading && notices.length > 0 && (
        <Animated.View entering={FadeInDown.duration(360)} style={styles.statsStrip}>
          <View style={styles.statChip}>
            <Text style={styles.statNumber}>{notices.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statChip}>
            <Text style={[styles.statNumber, { color: ROSE }]}>{pinnedCount}</Text>
            <Text style={styles.statLabel}>Pinned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statChip}>
            <Text style={[styles.statNumber, { color: '#EF4444' }]}>{highCount}</Text>
            <Text style={styles.statLabel}>Urgent</Text>
          </View>
        </Animated.View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <LogoLoader size={56} color={ROSE} />
          <Text style={styles.loadingText}>Loading notices...</Text>
        </View>
      ) : (
        <FlatList
          data={sortedNotices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchNotices}
          windowSize={7}
          maxToRenderPerBatch={8}
          initialNumToRender={8}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Animated.View entering={ZoomIn.duration(380)} style={styles.emptyIconWrap}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <Ionicons name="megaphone-outline" size={32} color={ROSE_EDGE} />
              </Animated.View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No matches' : 'Your board is quiet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `Nothing matched “${searchQuery}”`
                  : 'Share an announcement — students, staff, and parents will see it instantly.'}
              </Text>
              {!searchQuery && (
                <PressScale onPress={() => setModalVisible(true)} style={styles.emptyCta}>
                  <Text style={styles.emptyCtaText}>Post first notice</Text>
                  <Ionicons name="arrow-forward" size={14} color="#fff" />
                </PressScale>
              )}
            </View>
          }
        />
      )}

      {/* FAB — hidden while composing (one primary action) */}
      {!modalVisible && (
        <RNAnimated.View style={[styles.fabWrapper, { transform: [{ scale: fabScale }], bottom: 28 + Math.max(insets.bottom - 8, 0) }]}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setModalVisible(true)}
            onPressIn={onFabIn}
            onPressOut={onFabOut}
            activeOpacity={1}
            accessibilityLabel="Post a notice"
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.6, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <Ionicons name="megaphone" size={18} color="#fff" />
            <Text style={styles.fabLabel}>Post Notice</Text>
          </TouchableOpacity>
        </RNAnimated.View>
      )}

      {/* ══════════════════════════════════════════════════════════
          CREATE MODAL — compact single-surface composer
      ══════════════════════════════════════════════════════════ */}
      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={[styles.sheetOverlay, isWide && styles.sheetOverlayWide]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} accessibilityLabel="Dismiss" />

          <Animated.View
            entering={isWide ? ZoomIn.duration(260).springify().damping(18) : FadeInUp.duration(280).springify().damping(16)}
            style={[
              styles.sheetContent,
              isWide && styles.sheetContentWide,
              { paddingBottom: Math.max(insets.bottom, 14) },
            ]}
          >
            <LinearGradient
              colors={isDark ? ['rgba(236,72,153,0.10)', 'transparent'] : ['rgba(253,242,248,0.95)', 'rgba(255,255,255,0)']}
              style={styles.sheetAura}
              pointerEvents="none"
            />

            {!isWide && <View style={styles.sheetHandle} />}

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <View style={styles.sheetIconBadge}>
                  <Ionicons name="megaphone" size={17} color={ROSE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Post a Notice</Text>
                  <Text style={styles.sheetSubtitle}>{audienceHint} · {priorityHint}</Text>
                </View>
              </View>
              <PressScale onPress={closeModal} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={isDark ? '#CBD5E1' : '#475569'} />
              </PressScale>
            </View>

            <ScrollView
              style={styles.sheetScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetScroll}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {/* Title */}
              <View style={styles.fieldBlock}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { marginBottom: 0 }]}>Headline</Text>
                  <Text style={[styles.charCount, { marginBottom: 0 }, title.length > TITLE_MAX * 0.9 && { color: ROSE }]}>
                    {title.length}/{TITLE_MAX}
                  </Text>
                </View>
                <View style={[styles.inputFrame, clayInset(isDark, titleFocused) as any, titleFocused && styles.inputFocused]}>
                  <AppTextInput
                    style={styles.input}
                    placeholder="What’s happening?"
                    placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                    value={title}
                    onChangeText={(t) => setTitle(t.slice(0, TITLE_MAX))}
                    onFocus={() => setTitleFocused(true)}
                    onBlur={() => setTitleFocused(false)}
                    returnKeyType="next"
                  />
                </View>
                {attemptedSubmit && !titleOk && (
                  <Text style={styles.fieldError}>Add a headline so people can scan the board</Text>
                )}
              </View>

              {/* Body */}
              <View style={styles.fieldBlock}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { marginBottom: 0 }]}>Details</Text>
                  <Text style={[styles.charCount, { marginBottom: 0 }, content.length > BODY_MAX * 0.9 && { color: ROSE }]}>
                    {content.length}/{BODY_MAX}
                  </Text>
                </View>
                <View style={[styles.inputFrame, styles.textAreaFrame, clayInset(isDark, bodyFocused) as any, bodyFocused && styles.inputFocused]}>
                  <AppTextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Who, what, when…"
                    placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                    value={content}
                    onChangeText={(t) => setContent(t.slice(0, BODY_MAX))}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    onFocus={() => setBodyFocused(true)}
                    onBlur={() => setBodyFocused(false)}
                  />
                </View>
                {attemptedSubmit && !bodyOk && (
                  <Text style={styles.fieldError}>Add a short body with the key details</Text>
                )}
              </View>

              <View style={styles.divider} />

              {/* Audience — equal-width segmented row */}
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Audience</Text>
                <View style={styles.audienceTrack}>
                  {(['all', 'students', 'staff', 'parents', 'class'] as const).map((a) => {
                    const active = audience === a;
                    const label = a === 'all' ? 'All'
                      : a === 'students' ? 'Students'
                      : a === 'staff' ? 'Staff'
                      : a === 'parents' ? 'Parents'
                      : 'Class';
                    return (
                      <PressScale key={a} onPress={() => setAudience(a)} style={styles.audienceSeg}>
                        <View style={[styles.audienceChip, active && styles.audienceChipActive]}>
                          <AudienceIcon type={a} size={14} color={active ? '#fff' : '#64748B'} />
                          <Text
                            style={[styles.chipText, active && styles.chipTextActive]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.85}
                          >
                            {label}
                          </Text>
                        </View>
                      </PressScale>
                    );
                  })}
                </View>

                {audience === 'class' && (
                  <Animated.View entering={FadeInDown.duration(220)} style={{ marginTop: 10 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classRow}>
                      {classes.map((c) => {
                        const active = targetClassId === c.id;
                        return (
                          <PressScale key={c.id} onPress={() => setTargetClassId(c.id)}>
                            <View style={[styles.classChip, active && styles.classChipActive]}>
                              <Text style={[styles.classChipText, active && styles.classChipTextActive]}>
                                {c.name}
                              </Text>
                            </View>
                          </PressScale>
                        );
                      })}
                    </ScrollView>
                    {attemptedSubmit && !classOk && (
                      <Text style={styles.fieldError}>Pick a class to continue</Text>
                    )}
                  </Animated.View>
                )}
              </View>

              {/* Priority — rose selected state (brand-consistent); color dots carry meaning */}
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Priority</Text>
                <View style={styles.priorityTrack}>
                  {(['low', 'medium', 'high'] as const).map((p) => {
                    const pm = PRIORITY_META[p];
                    const active = priority === p;
                    return (
                      <PressScale key={p} onPress={() => setPriority(p)} style={styles.prioritySeg}>
                        <View style={[styles.priorityChip, active && styles.priorityChipActive]}>
                          <View style={[styles.priorityDot, { backgroundColor: active ? '#fff' : pm.dot }]} />
                          <Text style={[
                            styles.priorityChipText,
                            active && styles.priorityChipTextActive,
                          ]}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </Text>
                        </View>
                      </PressScale>
                    );
                  })}
                </View>
              </View>

              {/* Pin — compact inline row */}
              <Pressable
                onPress={() => setIsPinned(!isPinned)}
                style={[styles.pinRow, isPinned && styles.pinRowActive]}
              >
                <View style={styles.pinRowLeft}>
                  <View style={[styles.pinIconBox, isPinned && styles.pinIconBoxActive]}>
                    <Ionicons name="pin" size={14} color={isPinned ? '#fff' : '#94A3B8'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pinLabel}>Pin to top</Text>
                    <Text style={styles.pinSubLabel}>Stays above other notices</Text>
                  </View>
                </View>
                <ClayToggle value={isPinned} onChange={setIsPinned} />
              </Pressable>
            </ScrollView>

            <View style={styles.stickyFooter}>
              {!canPublish && attemptedSubmit && (
                <Animated.View entering={FadeIn.duration(160)} style={styles.footerHint}>
                  <Ionicons name="information-circle" size={14} color={ROSE} />
                  <Text style={styles.footerHintText}>
                    {!titleOk ? 'Add a headline' : !bodyOk ? 'Add details' : 'Pick a class'}
                  </Text>
                </Animated.View>
              )}
              <PremiumButton
                title={creating ? 'Publishing…' : 'Publish Notice'}
                onPress={handleCreate}
                loading={creating}
                disabled={creating}
                height={48}
                colors={canPublish ? [ROSE, ROSE_DEEP] : ['#F9A8D4', '#F472B6']}
                icon={!creating ? <Ionicons name="send" size={14} color="#fff" style={{ marginLeft: 8 }} /> : undefined}
                style={!canPublish ? { ...styles.publishBtn, opacity: 0.72 } : styles.publishBtn}
              />
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const getStyles = (theme: Theme, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 14, fontSize: 13, color: theme.colors.textSecondary, letterSpacing: 0.2 },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: isDark ? theme.colors.card : '#fff',
    marginHorizontal: 20, marginTop: 16,
    paddingHorizontal: 14, borderRadius: 16, height: 50,
    borderWidth: 1.5, borderColor: isDark ? theme.colors.border : '#E2E8F0',
    ...(Platform.OS === 'android'
      ? { elevation: 2 }
      : { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }),
  },
  searchFocused: {
    borderColor: ROSE_EDGE,
    ...(Platform.OS === 'ios'
      ? { shadowColor: ROSE, shadowOpacity: 0.16, shadowRadius: 12 }
      : { elevation: 4 }),
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textStrong, fontWeight: '500' },
  clearBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#94A3B8', justifyContent: 'center', alignItems: 'center',
  },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: isDark ? theme.colors.card : '#fff',
    marginHorizontal: 20, marginTop: 12,
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 10,
    borderWidth: 1, borderColor: isDark ? theme.colors.border : 'rgba(148,163,184,0.18)',
    alignItems: 'center',
    ...(Platform.OS === 'android' ? { elevation: 2 } : {
      shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8,
    }),
  },
  statChip: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: isDark ? theme.colors.border : '#E2E8F0' },
  statNumber: { fontSize: 20, fontWeight: '800', color: theme.colors.textStrong, letterSpacing: -0.6 },
  statLabel: {
    fontSize: 10, color: theme.colors.textTertiary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 3,
  },

  listContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 120 },

  card: {
    backgroundColor: isDark ? theme.colors.card : '#fff',
    borderRadius: 22, marginBottom: 12,
    flexDirection: 'row', overflow: 'hidden',
    borderWidth: 1, borderColor: isDark ? theme.colors.border : 'rgba(148,163,184,0.16)',
    borderBottomWidth: 1.5, borderBottomColor: isDark ? theme.colors.border : 'rgba(100,116,139,0.14)',
    ...(Platform.OS === 'android' ? { elevation: 3 } : {
      shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 12,
    }),
  },
  cardPinned: {
    borderColor: ROSE_EDGE,
    borderBottomColor: ROSE_EDGE,
    ...(Platform.OS === 'ios'
      ? { shadowColor: ROSE, shadowOpacity: 0.14, shadowRadius: 14 }
      : { elevation: 4 }),
  },
  cardStripe: { width: 4 },
  cardInner: { flex: 1, padding: 16 },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 8, gap: 8,
  },
  titleRow: { flex: 1 },
  pinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: ROSE_MID, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 8, alignSelf: 'flex-start', marginBottom: 6,
  },
  pinText: { fontSize: 9, fontWeight: '800', color: ROSE, letterSpacing: 0.7 },
  cardTitle: {
    fontSize: 15, fontWeight: '700', color: theme.colors.textStrong, letterSpacing: -0.3, lineHeight: 21,
  },
  priorityBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, flexShrink: 0,
  },
  priorityText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  cardContent: {
    fontSize: 13, color: theme.colors.textSecondary,
    lineHeight: 19, marginBottom: 12,
  },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  audiencePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  audienceText: { fontSize: 11, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 11, color: theme.colors.textTertiary, fontWeight: '500' },

  emptyContainer: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 28 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: ROSE_SOFT,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1, borderColor: ROSE_EDGE,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textStrong, letterSpacing: -0.4 },
  emptySubtitle: {
    fontSize: 14, color: theme.colors.textSecondary, marginTop: 8,
    textAlign: 'center', lineHeight: 21, maxWidth: 300,
  },
  emptyCta: {
    marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: ROSE, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 16, overflow: 'hidden',
  },
  emptyCtaText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  fabWrapper: { position: 'absolute', right: 18 },
  fab: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: ROSE,
    paddingVertical: 15, paddingHorizontal: 22,
    borderRadius: 28, gap: 8, overflow: 'hidden',
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.12)',
    ...(Platform.OS === 'android' ? { elevation: 8 } : {
      shadowColor: ROSE, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.38, shadowRadius: 16,
    }),
  },
  fabLabel: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },

  // ── Sheet ─────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  sheetOverlayWide: {
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  sheetContent: {
    backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10,
    maxHeight: '90%',
    width: '100%',
    overflow: 'hidden',
    ...(Platform.OS === 'android' ? { elevation: 16 } : {
      shadowColor: '#0F172A', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.22, shadowRadius: 28,
    }),
  },
  sheetContentWide: {
    maxWidth: 480, maxHeight: '84%',
    borderRadius: 28,
  },
  sheetAura: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 100,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(148,163,184,0.4)',
    alignSelf: 'center', marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14, gap: 10,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  sheetIconBadge: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: ROSE_MID,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: ROSE_EDGE,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textStrong, letterSpacing: -0.4 },
  sheetSubtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: isDark ? theme.colors.background : '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  sheetScrollView: { flexGrow: 0, flexShrink: 1 },
  sheetScroll: { paddingBottom: 8 },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: isDark ? theme.colors.border : '#E2E8F0',
    marginVertical: 4, marginBottom: 14,
  },

  fieldBlock: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  label: {
    fontSize: 11, fontWeight: '700', color: theme.colors.textTertiary,
    letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 7, paddingLeft: 1,
  },
  charCount: { fontSize: 11, fontWeight: '600', color: theme.colors.textTertiary, marginBottom: 7 },
  inputFrame: {
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    overflow: 'hidden',
    backgroundColor: isDark ? '#121824' : '#F1F5F9',
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(148,163,184,0.2)',
  },
  inputFocused: {
    borderColor: ROSE_EDGE,
    backgroundColor: isDark ? '#0F172A' : '#FFFBFE',
  },
  textAreaFrame: { paddingVertical: 12 },
  input: {
    fontSize: 15, color: theme.colors.textStrong, fontWeight: '500',
    backgroundColor: 'transparent', borderWidth: 0, padding: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  textArea: { minHeight: 80, textAlignVertical: 'top', lineHeight: 22 },
  fieldError: {
    fontSize: 12, color: ROSE, marginTop: 6, fontWeight: '600', paddingLeft: 2,
  },

  audienceTrack: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F1F5F9',
    borderRadius: 14, padding: 4, gap: 4,
  },
  audienceSeg: { flex: 1, minWidth: 0 },
  audienceChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 11,
  },
  audienceChipActive: {
    backgroundColor: ROSE,
    ...(Platform.OS === 'android' ? { elevation: 2 } : {
      shadowColor: ROSE, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.28, shadowRadius: 4,
    }),
  },
  chipText: {
    fontSize: 11, color: '#64748B', fontWeight: '600',
    textAlign: 'center', lineHeight: 13,
    ...(Platform.OS === 'web' ? { whiteSpace: 'nowrap' as any } : {}),
  },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  classRow: { gap: 8, paddingVertical: 2 },
  classChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: isDark ? theme.colors.background : '#F1F5F9',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  classChipActive: { backgroundColor: ROSE, borderColor: ROSE },
  classChipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  classChipTextActive: { color: '#fff', fontWeight: '700' },

  priorityTrack: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F1F5F9',
    borderRadius: 14, padding: 4,
  },
  prioritySeg: { flex: 1, minWidth: 0 },
  priorityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 11,
  },
  priorityChipActive: {
    backgroundColor: ROSE,
    ...(Platform.OS === 'android' ? { elevation: 2 } : {
      shadowColor: ROSE, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.28, shadowRadius: 4,
    }),
  },
  priorityDot: { width: 7, height: 7, borderRadius: 3.5 },
  priorityChipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  priorityChipTextActive: { color: '#fff', fontWeight: '700' },

  pinRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: isDark ? theme.colors.background : '#F8FAFC',
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1.5, borderColor: isDark ? theme.colors.border : '#E2E8F0',
    marginBottom: 4,
  },
  pinRowActive: { backgroundColor: ROSE_SOFT, borderColor: ROSE_EDGE },
  pinRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 },
  pinIconBox: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: isDark ? theme.colors.card : '#E2E8F0',
    justifyContent: 'center', alignItems: 'center',
  },
  pinIconBoxActive: { backgroundColor: ROSE },
  pinLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textStrong },
  pinSubLabel: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },

  stickyFooter: {
    paddingTop: 12, paddingBottom: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: isDark ? theme.colors.border : '#E2E8F0',
  },
  footerHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 8, paddingHorizontal: 2,
  },
  footerHintText: { fontSize: 12, color: ROSE, fontWeight: '600' },
  publishBtn: {
    borderRadius: 14, overflow: 'hidden',
    ...(Platform.OS === 'android' ? { elevation: 4 } : {
      shadowColor: ROSE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10,
    }),
  },
});
