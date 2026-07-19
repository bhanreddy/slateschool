/**
 * MessengerScreen — shared directory-style messenger for admin & teacher portals.
 * Mode A: clay world + glass accents. Soft, tactile, premium.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, Platform, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

import ScreenLayout from '@/src/components/ScreenLayout';
import { Surfaces, Spacing, Radii, Shadows, Typography } from '@/src/theme/themes';
import { useConversations, useEligibleRecipients, useMessageUserId, useSupportContact } from '@/src/hooks/useMessages';
import {
  MessagesService,
  type Conversation,
  type GroupMode,
  type MessengerRole,
  type Recipient,
} from '@/src/services/messagesService';
import ChatThread from './ChatThread';
import { Avatar, ConversationRow, PinnedSupportCard, PressScale, RecipientRow } from './parts';

export interface DirectoryTab {
  key: string;
  label: string;
  roles: MessengerRole[];
}

interface Props {
  title: string;
  directoryTabs: DirectoryTab[];
  pinAdminInDirectory?: boolean;
  canCreateGroup?: boolean;
  renderHeader?: (opts: { onBack: () => void; onCreateGroup: () => void }) => React.ReactNode;
}

const ACCENT = '#4F46E5';
const ACCENT_SOFT = '#EEF2FF';
const INK = '#0F172A';
const MUTED = '#64748B';
const CLAY_BG = '#E9EDF6';

const SPRING = { damping: 18, stiffness: 180, mass: 0.7 };

const tabIcon = (key: string): keyof typeof Ionicons.glyphMap => {
  if (key === 'chats') return 'chatbubbles';
  if (key === 'teachers') return 'school-outline';
  if (key === 'students') return 'people-outline';
  if (key === 'directory') return 'people-outline';
  return 'ellipse-outline';
};

const rank = (r: Recipient, pinAdmin?: boolean) =>
  pinAdmin && r.role === 'admin' ? 0 : 1;

function AmbientCanvas() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.blobA} />
      <View style={styles.blobB} />
      <View style={styles.blobC} />
    </View>
  );
}

export default function MessengerScreen({ title, directoryTabs, pinAdminInDirectory, canCreateGroup, renderHeader }: Props) {
  const { t } = useTranslation();
  const messageUserId = useMessageUserId();
  const router = useRouter();

  const [view, setView] = useState<'list' | 'thread' | 'group'>('list');
  const [tab, setTab] = useState<string>('chats');
  const [search, setSearch] = useState('');
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [activeRecipient, setActiveRecipient] = useState<Recipient | null>(null);

  const [groupName, setGroupName] = useState('');
  const [groupMode, setGroupMode] = useState<GroupMode>('chat');
  const [selected, setSelected] = useState<Record<string, Recipient>>({});
  const [creating, setCreating] = useState(false);

  const { data: conversations, refetch: refetchConvos, loading: loadingConvos } = useConversations();
  const { data: recipients } = useEligibleRecipients();
  const { data: support } = useSupportContact();
  const supportConversation = useMemo(
    () => support ? conversations?.find((c) => c.other_user_id === support.user_id && c.pair_type === 'support') || null : null,
    [support, conversations],
  );
  const regularConversations = useMemo(
    () => (conversations || []).filter((c) => c.pair_type !== 'support'),
    [conversations],
  );
  const unreadTotal = useMemo(
    () =>
      regularConversations.reduce((n, c) => n + (c.unread_count || 0), 0) +
      (supportConversation?.unread_count || 0),
    [regularConversations, supportConversation],
  );

  const activeDirTab = directoryTabs.find((d) => d.key === tab);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return regularConversations;
    return regularConversations.filter((c) => {
      const hay = [
        c.other_user_name,
        c.group_name,
        c.student_name,
        c.last_message_preview,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [regularConversations, search]);

  const directoryList = useMemo(() => {
    if (!activeDirTab || !recipients) return [];
    const q = search.trim().toLowerCase();
    const sorted = recipients
      .filter((r) => activeDirTab.roles.includes(r.role))
      .filter((r) => !q || r.display_name.toLowerCase().includes(q) || (r.student_name || '').toLowerCase().includes(q))
      .sort(
        (a, b) => rank(a, pinAdminInDirectory) - rank(b, pinAdminInDirectory) || a.display_name.localeCompare(b.display_name),
      );
    let adminKept = false;
    return sorted.filter((r) => {
      if (r.role === 'admin') {
        if (adminKept) return false;
        adminKept = true;
      }
      return true;
    });
  }, [activeDirTab, recipients, search, pinAdminInDirectory]);

  const groupCandidates = useMemo(() => {
    if (!recipients) return [];
    const q = search.trim().toLowerCase();
    const seen = new Set<string>();
    return recipients
      .filter((r) => r.role !== 'admin')
      .filter((r) => {
        if (seen.has(r.user_id)) return false;
        seen.add(r.user_id);
        return true;
      })
      .filter((r) => !q || r.display_name.toLowerCase().includes(q))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [recipients, search]);

  const openConversation = useCallback((c: Conversation) => {
    setActiveConv(c);
    setActiveRecipient(null);
    setView('thread');
  }, []);

  const openRecipient = useCallback((r: Recipient) => {
    setActiveRecipient(r);
    setActiveConv(null);
    setView('thread');
  }, []);

  const openSupport = useCallback(() => {
    if (!support) return;
    if (supportConversation) openConversation(supportConversation);
    else openRecipient(support);
  }, [support, supportConversation, openConversation, openRecipient]);

  const handleBack = () => {
    if (view === 'thread' || view === 'group') {
      setView('list');
      setActiveConv(null);
      setActiveRecipient(null);
      setSearch('');
      refetchConvos();
    } else {
      router.back();
    }
  };

  const selectedCount = Object.keys(selected).length;

  const toggleMember = (r: Recipient) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[r.user_id]) delete next[r.user_id];
      else next[r.user_id] = r;
      return next;
    });

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedCount === 0 || creating) return;
    setCreating(true);
    try {
      const conv = await MessagesService.createGroup({
        group_name: groupName.trim(),
        group_mode: groupMode,
        member_user_ids: Object.keys(selected),
      });
      setGroupName('');
      setSelected({});
      setSearch('');
      refetchConvos();
      openConversation(conv);
    } catch (err) {
      console.warn('Failed to create group', err);
    } finally {
      setCreating(false);
    }
  };

  const openGroupCreate = () => { setSearch(''); setView('group'); };
  const showingChats = tab === 'chats';
  const allTabs = useMemo(
    () => [{ key: 'chats', label: t('messages.tab_chats', 'Chats') }, ...directoryTabs],
    [directoryTabs, t],
  );

  const firstDirectoryKey = directoryTabs[0]?.key || 'directory';
  const openCompose = useCallback(() => {
    setSearch('');
    setTab(firstDirectoryKey);
  }, [firstDirectoryKey]);

  // Sliding clay pill for tabs (translateX only — width set from layout)
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const pillX = useSharedValue(0);
  const activeTabLayout = tabLayouts[tab];
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  const onTabLayout = useCallback((key: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setTabLayouts((prev) => {
      if (prev[key]?.x === x && prev[key]?.width === width) return prev;
      return { ...prev, [key]: { x, width } };
    });
  }, []);

  useEffect(() => {
    if (!activeTabLayout) return;
    pillX.value = withSpring(activeTabLayout.x, SPRING);
  }, [activeTabLayout, pillX]);

  const searchPlaceholder = showingChats
    ? t('messages.search_chats', 'Search conversations…')
    : t('messages.search_recipient', 'Search by name...');

  // ─── Thread ──────────────────────────────────────────────────────────────────
  if (view === 'thread') {
    return (
      <ScreenLayout style={{ backgroundColor: CLAY_BG }}>
        <ChatThread
          conversation={activeConv}
          recipient={activeRecipient}
          currentUserId={messageUserId}
          conversations={conversations || []}
          onBack={handleBack}
          onConversationCreated={(c) => setActiveConv(c)}
        />
      </ScreenLayout>
    );
  }

  // ─── Group create ─────────────────────────────────────────────────────────────
  if (view === 'group') {
    const canCreate = !!groupName.trim() && selectedCount > 0 && !creating;
    return (
      <ScreenLayout style={{ backgroundColor: CLAY_BG }}>
        <Animated.View entering={FadeInDown.duration(280)} style={{ flex: 1 }}>
          <View style={styles.groupHeader}>
            <PressScale onPress={handleBack} style={styles.clayIconBtn}>
              <Ionicons name="arrow-back" size={22} color={INK} />
            </PressScale>
            <View style={{ flex: 1 }}>
              <Text style={styles.groupHeaderTitle}>{t('messages.new_group', 'New Group')}</Text>
              <Text style={styles.groupHeaderSub}>
                {selectedCount > 0
                  ? `${selectedCount} ${t('messages.selected', 'selected')}`
                  : t('messages.add_members_hint', 'Name it, pick members, create')}
              </Text>
            </View>
            <PressScale
              onPress={handleCreateGroup}
              disabled={!canCreate}
              style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
            >
              <LinearGradient
                colors={canCreate ? ['#6366F1', '#4F46E5'] : ['#CBD5E1', '#94A3B8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.createBtnGrad}
              >
                <Text style={styles.createBtnText}>{creating ? '…' : t('messages.create', 'Create')}</Text>
              </LinearGradient>
            </PressScale>
          </View>

          <FlatList
            data={groupCandidates}
            keyExtractor={(r: Recipient) => r.user_id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.sm }}>
                <View style={styles.clayField}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <Ionicons name="people" size={18} color={ACCENT} style={{ marginRight: 10 }} />
                  <TextInput
                    value={groupName}
                    onChangeText={setGroupName}
                    placeholder={t('messages.group_name', 'Group name')}
                    placeholderTextColor="#94A3B8"
                    style={styles.groupNameInput}
                    maxLength={120}
                  />
                </View>

                <View style={styles.modeRow}>
                  {(['chat', 'broadcast'] as GroupMode[]).map((m) => {
                    const active = groupMode === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setGroupMode(m)}
                        style={[styles.modeChip, active && styles.modeChipActive]}
                      >
                        <Ionicons
                          name={m === 'chat' ? 'chatbubbles' : 'megaphone'}
                          size={15}
                          color={active ? ACCENT : MUTED}
                        />
                        <Text style={[styles.modeChipText, active && { color: ACCENT }]}>
                          {m === 'chat' ? t('messages.mode_chat', 'Group chat') : t('messages.mode_broadcast', 'Broadcast')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.searchBar}>
                  <Ionicons name="search" size={18} color="#94A3B8" />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t('messages.search_members', 'Search teachers or students...')}
                    placeholderTextColor="#94A3B8"
                    style={styles.searchInput}
                  />
                  {!!search && (
                    <Pressable onPress={() => setSearch('')} hitSlop={10}>
                      <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                    </Pressable>
                  )}
                </View>

                <Text style={styles.sectionLabel}>
                  {selectedCount > 0
                    ? `${selectedCount} ${t('messages.selected', 'selected')}`
                    : t('messages.add_members', 'Add members')}
                </Text>
              </View>
            }
            renderItem={({ item }: { item: Recipient }) => {
              const isSel = !!selected[item.user_id];
              return (
                <Pressable onPress={() => toggleMember(item)} style={[styles.memberRow, isSel && styles.memberRowSel]}>
                  <Avatar name={item.display_name} size={42} role={item.role} uri={item.photo_url} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text numberOfLines={1} style={styles.memberName}>{item.display_name}</Text>
                    <Text style={styles.memberSub}>
                      {item.role === 'teacher' || item.role === 'staff'
                        ? t('roles.teacher_singular', 'Teacher')
                        : t('roles.student_singular', 'Student')}
                    </Text>
                  </View>
                  <View style={[styles.checkRing, isSel && styles.checkRingOn]}>
                    {isSel ? (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
            contentContainerStyle={{ paddingBottom: 48 }}
          />
        </Animated.View>
      </ScreenLayout>
    );
  }

  // ─── List (Chats + directory tabs) ────────────────────────────────────────────
  return (
    <ScreenLayout style={{ backgroundColor: CLAY_BG }}>
      <AmbientCanvas />
      <Animated.View entering={FadeInDown.duration(280)} exiting={FadeOut.duration(150)} style={{ flex: 1 }}>
        {renderHeader ? (
          renderHeader({ onBack: handleBack, onCreateGroup: openGroupCreate })
        ) : (
          <View style={styles.header}>
            <PressScale onPress={handleBack} style={styles.clayIconBtn}>
              <Ionicons name="arrow-back" size={22} color={INK} />
            </PressScale>
            <View style={{ flex: 1, marginLeft: 4 }}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSub}>
                {unreadTotal > 0
                  ? `${unreadTotal} ${t('messages.unread', 'unread')}`
                  : t('messages.all_caught_up', 'All caught up')}
              </Text>
            </View>
            {canCreateGroup && (
              <PressScale onPress={openGroupCreate} style={styles.clayIconBtnAccent}>
                <Ionicons name="people-circle" size={24} color={ACCENT} />
              </PressScale>
            )}
          </View>
        )}

        {/* Soft segmented tab track with sliding clay pill */}
        <View style={styles.tabTrackWrap}>
          <View style={styles.tabTrack}>
            <Animated.View
              style={[
                styles.tabPill,
                { width: activeTabLayout?.width || 0, opacity: activeTabLayout ? 1 : 0 },
                pillStyle,
              ]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.15)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.6, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            </Animated.View>
            {allTabs.map((tb) => {
              const active = tab === tb.key;
              const showBadge = tb.key === 'chats' && unreadTotal > 0;
              return (
                <Pressable
                  key={tb.key}
                  onPress={() => { setTab(tb.key); setSearch(''); }}
                  onLayout={(e) => onTabLayout(tb.key, e)}
                  style={styles.tabItem}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={tabIcon(tb.key)}
                    size={15}
                    color={active ? ACCENT : '#94A3B8'}
                  />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tb.label}</Text>
                  {showBadge && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{unreadTotal > 99 ? '99+' : unreadTotal}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Inbox status — only on chats, when there is something to say */}
        {showingChats && regularConversations.length > 0 && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.inboxStrip}>
            <View style={styles.inboxIcon}>
              <Ionicons
                name={unreadTotal > 0 ? 'mail-unread-outline' : 'checkmark-circle'}
                size={14}
                color={unreadTotal > 0 ? ACCENT : '#059669'}
              />
            </View>
            <Text style={styles.inboxText}>
              {unreadTotal > 0
                ? `${unreadTotal} ${t('messages.waiting_for_you', 'waiting for you')}`
                : t('messages.inbox_clear', "You're all caught up — nice work")}
            </Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeIn.duration(200)} style={styles.searchBarWrap}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={searchPlaceholder}
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {!!search && Platform.OS !== 'ios' && (
              <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color="#CBD5E1" />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {showingChats ? (
          <FlatList
            data={filteredConversations}
            keyExtractor={(item: Conversation) => item.id}
            renderItem={({ item }: { item: Conversation }) => (
              <ConversationRow item={item} onPress={() => openConversation(item)} />
            )}
            contentContainerStyle={styles.listContent}
            refreshing={loadingConvos}
            onRefresh={refetchConvos}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            removeClippedSubviews
            windowSize={7}
            maxToRenderPerBatch={8}
            initialNumToRender={10}
            ListHeaderComponent={
              support && !search.trim() ? (
                <PinnedSupportCard support={support} conversation={supportConversation} onPress={openSupport} />
              ) : null
            }
            ListEmptyComponent={
              !loadingConvos ? (
                search.trim() ? (
                  <View style={styles.emptyCompact}>
                    <View style={styles.emptyIconSoft}>
                      <Ionicons name="search-outline" size={26} color={ACCENT} />
                    </View>
                    <Text style={styles.emptyTitle}>{t('messages.no_results', 'No matches found.')}</Text>
                    <Text style={styles.emptyDesc}>
                      {t('messages.try_another_name', 'Try another name or clear the search.')}
                    </Text>
                  </View>
                ) : (
                  <EmptyConversations
                    directoryTabs={directoryTabs}
                    onPickTab={(key) => { setTab(key); setSearch(''); }}
                    onOpenSupport={support ? openSupport : undefined}
                    canCreateGroup={canCreateGroup}
                    onCreateGroup={canCreateGroup ? openGroupCreate : undefined}
                  />
                )
              ) : (
                <LoadingPlaceholders />
              )
            }
            ListFooterComponent={
              filteredConversations.length > 0 ? (
                <View style={styles.listFooterHint}>
                  <Ionicons name="sparkles" size={13} color="#A5B4FC" />
                  <Text style={styles.listFooterText}>
                    {t('messages.footer_hint', 'Pull down to refresh · Tap a chat to open')}
                  </Text>
                </View>
              ) : null
            }
          />
        ) : (
          <FlatList
            data={directoryList}
            keyExtractor={(r: Recipient) => `${r.user_id}_${r.student_id || 'none'}`}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={({ item }: { item: Recipient }) => (
              <RecipientRow item={item} onPress={() => openRecipient(item)} pinned={pinAdminInDirectory && item.role === 'admin'} />
            )}
            contentContainerStyle={styles.listContent}
            removeClippedSubviews
            windowSize={7}
            maxToRenderPerBatch={10}
            initialNumToRender={12}
            ListEmptyComponent={
              <View style={styles.emptyCompact}>
                <View style={styles.emptyIconSoft}>
                  <Ionicons name="search-outline" size={26} color={ACCENT} />
                </View>
                <Text style={styles.emptyTitle}>
                  {search
                    ? t('messages.no_results', 'No matches found.')
                    : t('messages.directory_empty', 'No people here yet')}
                </Text>
                <Text style={styles.emptyDesc}>
                  {search
                    ? t('messages.try_another_name', 'Try another name or clear the search.')
                    : t('messages.directory_empty_hint', 'People you can message will show up here.')}
                </Text>
              </View>
            }
          />
        )}

        {/* Thumb-zone compose FAB */}
        <PressScale
          onPress={openCompose}
          style={styles.fab}
          accessibilityLabel={t('messages.new_message', 'New Message')}
        >
          <LinearGradient
            colors={['#6366F1', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGrad}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <Ionicons name="create" size={22} color="#FFFFFF" />
          </LinearGradient>
        </PressScale>
      </Animated.View>
    </ScreenLayout>
  );
}

function EmptyConversations({
  directoryTabs,
  onPickTab,
  onOpenSupport,
  canCreateGroup,
  onCreateGroup,
}: {
  directoryTabs: DirectoryTab[];
  onPickTab: (key: string) => void;
  onOpenSupport?: () => void;
  canCreateGroup?: boolean;
  onCreateGroup?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeInDown.duration(320).delay(40)} style={styles.empty}>
      <View style={styles.emptyHero}>
        <LinearGradient
          colors={['#EEF2FF', '#E0E7FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyOrb}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.7, y: 0.9 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Ionicons name="chatbubble-ellipses" size={36} color={ACCENT} />
        </LinearGradient>
        <View style={styles.emptySparkleA} />
        <View style={styles.emptySparkleB} />
      </View>

      <Text style={styles.emptyTitle}>{t('messages.empty_title', 'Start a conversation')}</Text>
      <Text style={styles.emptyDesc}>
        {t('messages.empty_premium_hint', 'Pick someone below — or message Support anytime. Your chats will live here.')}
      </Text>

      <View style={styles.emptyActions}>
        {directoryTabs.map((tb) => (
          <PressScale key={tb.key} onPress={() => onPickTab(tb.key)} style={styles.emptyCta}>
            <LinearGradient
              colors={['#FFFFFF', '#F8FAFF']}
              style={styles.emptyCtaInner}
            >
              <View style={styles.emptyCtaIcon}>
                <Ionicons name={tabIcon(tb.key)} size={18} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyCtaTitle}>{tb.label}</Text>
                <Text style={styles.emptyCtaSub}>{t('messages.tap_to_browse', 'Browse & message')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A5B4FC" />
            </LinearGradient>
          </PressScale>
        ))}

        {canCreateGroup && onCreateGroup && (
          <PressScale onPress={onCreateGroup} style={styles.emptyCta}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={styles.emptyCtaInner}>
              <View style={[styles.emptyCtaIcon, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="people" size={18} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyCtaTitle}>{t('messages.new_group', 'New Group')}</Text>
                <Text style={styles.emptyCtaSub}>{t('messages.group_or_broadcast', 'Chat or broadcast')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C4B5FD" />
            </LinearGradient>
          </PressScale>
        )}

        {onOpenSupport && (
          <PressScale onPress={onOpenSupport} style={styles.emptySupportBtn}>
            <Ionicons name="headset" size={16} color="#FFFFFF" />
            <Text style={styles.emptySupportText}>{t('messages.message_support', 'Message Support')}</Text>
          </PressScale>
        )}
      </View>
    </Animated.View>
  );
}

function LoadingPlaceholders() {
  return (
    <View style={{ gap: 12, paddingTop: 4 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.skeletonAvatar} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[styles.skeletonLine, { width: '42%' }]} />
            <View style={[styles.skeletonLine, { width: '72%', opacity: 0.55 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  blobA: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -40,
    right: -60,
    backgroundColor: 'rgba(99,102,241,0.10)',
  },
  blobB: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: 180,
    left: -70,
    backgroundColor: 'rgba(167,139,250,0.09)',
  },
  blobC: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    bottom: 80,
    right: 20,
    backgroundColor: 'rgba(129,140,248,0.08)',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 6,
    backgroundColor: Surfaces.light.raised,
  },
  clayIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(76,90,120,0.10)',
  },
  clayIconBtnAccent: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_SOFT,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(79,70,229,0.14)',
  },
  headerTitle: {
    ...Typography.title,
    fontSize: 18,
    fontWeight: '700',
    color: INK,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '500',
    color: MUTED,
    marginTop: 1,
  },

  tabTrackWrap: {
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: 'transparent',
  },
  tabTrack: {
    flexDirection: 'row',
    gap: 4,
    padding: 5,
    borderRadius: Radii.xxl,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(76,90,120,0.10)',
    ...Platform.select({
      ios: { shadowColor: '#6B7A99', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10 },
      android: { elevation: 2 },
      default: {},
    }),
  },
  tabPill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 0,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(79,70,229,0.12)',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 3 },
      default: {},
    }),
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 18,
    zIndex: 1,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  tabTextActive: { color: ACCENT, fontWeight: '700' },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

  inboxStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.md,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(76,90,120,0.08)',
  },
  inboxIcon: {
    width: 26,
    height: 26,
    borderRadius: 10,
    backgroundColor: ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: '#475569' },

  searchBarWrap: { paddingHorizontal: Spacing.md, paddingTop: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(76,90,120,0.07)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(76,90,120,0.11)',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1E293B', paddingVertical: 0 },

  listContent: { padding: Spacing.md, paddingTop: 12, paddingBottom: 110, flexGrow: 1 },
  listFooterHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    marginBottom: 8,
    opacity: 0.85,
  },
  listFooterText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

  fab: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    width: 56,
    height: 56,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.32, shadowRadius: 16 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  fabGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(15,23,42,0.18)',
  },

  empty: { alignItems: 'center', paddingTop: 28, paddingHorizontal: 8, flexGrow: 1, justifyContent: 'center' },
  emptyCompact: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  emptyHero: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyOrb: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(79,70,229,0.16)',
    ...Platform.select({
      ios: { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 18 },
      android: { elevation: 5 },
      default: {},
    }),
  },
  emptySparkleA: {
    position: 'absolute',
    top: 6,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#A5B4FC',
    opacity: 0.85,
  },
  emptySparkleB: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#C7D2FE',
  },
  emptyIconSoft: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(79,70,229,0.14)',
  },
  emptyTitle: { fontSize: 20, fontWeight: '750' as any, color: INK, letterSpacing: -0.3, textAlign: 'center' },
  emptyDesc: {
    fontSize: 14.5,
    lineHeight: 21,
    color: MUTED,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 12,
    maxWidth: 340,
  },
  emptyActions: { width: '100%', marginTop: 22, gap: 10 },
  emptyCta: {
    borderRadius: 18,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  emptyCtaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(76,90,120,0.07)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(76,90,120,0.11)',
  },
  emptyCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaTitle: { fontSize: 15, fontWeight: '700', color: INK },
  emptyCtaSub: { fontSize: 12.5, color: MUTED, marginTop: 1 },
  emptySupportBtn: {
    marginTop: 4,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 16,
    backgroundColor: ACCENT,
    ...Platform.select({
      ios: { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 12 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  emptySupportText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(76,90,120,0.08)',
  },
  skeletonAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0' },
  skeletonLine: { height: 10, borderRadius: 6, backgroundColor: '#E2E8F0' },

  // Group create
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    backgroundColor: Surfaces.light.raised,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  groupHeaderTitle: { fontSize: 17, fontWeight: '700', color: INK, letterSpacing: -0.2 },
  groupHeaderSub: { fontSize: 12, color: MUTED, marginTop: 1 },
  createBtn: { borderRadius: 14, overflow: 'hidden' },
  createBtnDisabled: { opacity: 0.85 },
  createBtnGrad: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  createBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  clayField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(76,90,120,0.08)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(76,90,120,0.12)',
  },
  groupNameInput: { flex: 1, fontSize: 16, color: '#1E293B', paddingVertical: 0 },
  modeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(76,90,120,0.08)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(76,90,120,0.10)',
  },
  modeChipActive: {
    borderColor: 'rgba(79,70,229,0.35)',
    backgroundColor: ACCENT_SOFT,
    borderBottomColor: 'rgba(79,70,229,0.18)',
  },
  modeChipText: { fontSize: 13, fontWeight: '600', color: MUTED },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginTop: 18, marginBottom: 4 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: Spacing.md,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(76,90,120,0.07)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(76,90,120,0.10)',
  },
  memberRowSel: {
    borderColor: 'rgba(79,70,229,0.35)',
    backgroundColor: '#F5F7FF',
    borderBottomColor: 'rgba(79,70,229,0.16)',
  },
  memberName: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  memberSub: { fontSize: 12, color: MUTED, marginTop: 1 },
  checkRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkRingOn: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
});
