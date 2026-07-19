/**
 * Shared messenger UI parts used by the admin, teacher and parent messengers.
 * Mode A clay surfaces — soft, tactile, no blur-in-list.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { Conversation, Message, MessageStatus, Recipient, MessengerRole, SupportContact } from '@/src/services/messagesService';
import type { MessageActionAnchor } from './MessageActions';
import SwipeToReply from './SwipeToReply';

const ACCENT = '#4F46E5';

export const PressScale = ({ children, onPress, style, disabled }: any) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      style,
      {
        opacity: disabled ? 0.45 : pressed ? 0.92 : 1,
        transform: [{ scale: pressed && !disabled ? 0.975 : 1 }],
      },
    ]}
  >
    {children}
  </Pressable>
);

const roleTint: Record<string, { bg: string; fg: string; ring: string }> = {
  admin: { bg: '#FFE9D6', fg: '#C2410C', ring: 'rgba(194,65,12,0.22)' },
  teacher: { bg: '#E3EAFF', fg: '#2A50D8', ring: 'rgba(42,80,216,0.20)' },
  staff: { bg: '#E3EAFF', fg: '#2A50D8', ring: 'rgba(42,80,216,0.20)' },
  parent: { bg: '#DCFCE7', fg: '#15803D', ring: 'rgba(21,128,61,0.20)' },
  student: { bg: '#DCFCE7', fg: '#15803D', ring: 'rgba(21,128,61,0.20)' },
  group: { bg: '#EDE9FE', fg: '#6D28D9', ring: 'rgba(109,40,217,0.20)' },
  support: { bg: '#E8E7FF', fg: '#4F46E5', ring: 'rgba(79,70,229,0.28)' },
};

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const Avatar = ({
  name,
  size = 46,
  role,
  isGroup,
  uri,
}: {
  name: string;
  size?: number;
  role?: string;
  isGroup?: boolean;
  uri?: string | null;
}) => {
  const tint = roleTint[isGroup ? 'group' : role || 'teacher'] || roleTint.teacher;
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const ring = size >= 40 ? 2.5 : 2;
  const inner = size - ring * 2;

  if (uri && !isGroup) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          padding: ring,
          backgroundColor: tint.ring,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={{ uri }}
          style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: tint.bg }}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={120}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        padding: ring,
        backgroundColor: tint.ring,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: tint.bg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0.9 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {isGroup ? (
          <Ionicons name="people" size={inner * 0.48} color={tint.fg} />
        ) : role === 'support' ? (
          <Ionicons name="headset" size={inner * 0.46} color={tint.fg} />
        ) : (
          <Text style={{ fontSize: inner * 0.34, fontWeight: '700', color: tint.fg }}>{initials}</Text>
        )}
      </View>
    </View>
  );
};

const roleLabel = (role: MessengerRole, t: (k: string, d?: string) => string): string =>
  role === 'support'
    ? t('messages.nexsyrus_support', 'Official support')
    : role === 'admin'
    ? t('roles.admin_singular', 'Admin')
    : role === 'teacher' || role === 'staff'
      ? t('roles.teacher_singular', 'Teacher')
      : t('roles.student_singular', 'Student');

export const PinnedSupportCard = React.memo(function PinnedSupportCard({
  support,
  conversation,
  onPress,
}: {
  support: SupportContact;
  conversation?: Conversation | null;
  onPress: () => void;
}) {
  const hasUnread = (conversation?.unread_count || 0) > 0;
  return (
    <PressScale onPress={onPress} style={styles.supportCard}>
      <LinearGradient
        colors={['#F8F7FF', '#EEF2FF', '#E8E7FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.72)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.55, y: 0.9 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.supportGlow} />
      <View style={styles.supportAccentBar} />
      <Avatar name={support.display_name} size={46} role="support" uri={support.photo_url} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={styles.supportTitleRow}>
          <Text style={styles.supportTitle}>Nexsyrus Support</Text>
          <View style={styles.verifiedPill}>
            <Ionicons name="shield-checkmark" size={11} color={ACCENT} />
            <Text style={styles.verifiedText}>Official</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={[styles.supportSub, hasUnread && styles.supportSubUnread]}>
          {conversation?.last_message_preview || 'Product help, onboarding & issue resolution'}
        </Text>
      </View>
      {hasUnread ? (
        <View style={styles.supportUnread}>
          <Text style={styles.supportUnreadText}>{conversation!.unread_count > 99 ? '99+' : conversation!.unread_count}</Text>
        </View>
      ) : (
        <View style={styles.supportChat}>
          <Ionicons name="chatbubble-ellipses" size={15} color="#FFFFFF" />
        </View>
      )}
    </PressScale>
  );
});

/** Tappable directory row: "start a chat with this person". */
export const RecipientRow = React.memo(
  ({ item, onPress, pinned }: { item: Recipient; onPress: () => void; pinned?: boolean }) => {
    const { t } = useTranslation();
    return (
      <PressScale onPress={onPress} style={styles.recipientRow}>
        <LinearGradient
          colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Avatar name={item.display_name} size={44} role={item.role} uri={item.photo_url} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text numberOfLines={1} style={styles.recipientName}>
              {item.display_name}
            </Text>
            {pinned && (
              <View style={styles.pinChip}>
                <Ionicons name="pin" size={10} color="#64748B" />
              </View>
            )}
          </View>
          <Text numberOfLines={1} style={styles.recipientSub}>
            {roleLabel(item.role, t as unknown as (k: string, d?: string) => string)}
            {item.student_name && item.role !== 'student' ? ` · ${item.student_name}` : ''}
          </Text>
        </View>
        <View style={styles.chatChip}>
          <Ionicons name="chatbubble-ellipses" size={15} color={ACCENT} />
        </View>
      </PressScale>
    );
  },
);

function conversationMeta(
  item: Conversation,
  isGroup: boolean,
  t: (k: string, d?: string) => string,
): string | null {
  if (isGroup) {
    return `${item.member_count ?? 0} ${t('messages.members', 'members')}${
      item.group_mode === 'broadcast' ? ` · ${t('messages.broadcast', 'Broadcast')}` : ''
    }`;
  }
  if (item.student_name) {
    return `${t('roles.student_singular', 'Student')} · ${item.student_name}`;
  }
  if (item.pair_type === 'admin_teacher') return t('roles.admin_singular', 'Admin');
  if (item.pair_type === 'teacher_parent' || item.pair_type === 'parent_admin') {
    return t('roles.parent_singular', 'Parent');
  }
  return null;
}

/** A conversation row (1:1 or group). */
export const ConversationRow = React.memo(
  ({ item, onPress }: { item: Conversation; onPress: () => void }) => {
    const { t } = useTranslation();
    const isGroup = !!item.is_group;
    const title = isGroup ? item.group_name || t('messages.group', 'Group') : item.other_user_name || '—';
    const dateStr = formatRelativeTime(item.last_message_at);
    const hasUnread = item.unread_count > 0;
    const subtitle = conversationMeta(item, isGroup, t as unknown as (k: string, d?: string) => string);

    return (
      <PressScale onPress={onPress}>
        <View style={[styles.convoRow, hasUnread && styles.convoRowUnread]}>
          <LinearGradient
            colors={
              hasUnread
                ? ['rgba(238,242,255,0.95)', 'rgba(255,255,255,0.35)']
                : ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {hasUnread && <View style={styles.convoUnreadBar} />}
          <Avatar
            name={title}
            size={44}
            role={undefined}
            isGroup={isGroup}
            uri={isGroup ? undefined : item.other_user_photo}
          />
          <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center', minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text numberOfLines={1} style={[styles.convoTitle, hasUnread && styles.convoTitleUnread]}>
                {title}
              </Text>
              {!!dateStr && (
                <Text style={[styles.convoDate, hasUnread && styles.convoDateUnread]}>{dateStr}</Text>
              )}
            </View>
            {!!subtitle && (
              <Text numberOfLines={1} style={styles.convoMeta}>
                {subtitle}
              </Text>
            )}
            <Text numberOfLines={1} style={[styles.convoPreview, hasUnread && styles.convoPreviewUnread]}>
              {item.last_message_preview || t('messages.no_messages', 'No messages yet')}
            </Text>
          </View>
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unread_count > 99 ? '99+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>
      </PressScale>
    );
  },
);

const StatusTicks = ({ status, onRetry }: { status: MessageStatus; onRetry: () => void }) => {
  if (status === 'sending') return <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.8)" />;
  if (status === 'failed')
    return (
      <Pressable onPress={onRetry} hitSlop={8}>
        <Ionicons name="alert-circle" size={14} color="#FDA4AF" />
      </Pressable>
    );
  if (status === 'seen') return <Ionicons name="checkmark-done" size={15} color="#7FE0FF" />;
  if (status === 'delivered') return <Ionicons name="checkmark-done" size={15} color="rgba(255,255,255,0.85)" />;
  return <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.85)" />;
};

export const MessageBubble = React.memo(
  function MessageBubble({
    item,
    isMine,
    showSender,
    status,
    groupStart = true,
    onRetry,
    onOpenActions,
    onReply,
  }: {
    item: Message;
    isMine: boolean;
    showSender?: boolean;
    status?: MessageStatus;
    groupStart?: boolean;
    onRetry: () => void;
    onOpenActions?: (message: Message, anchor?: MessageActionAnchor) => void;
    onReply?: (message: Message) => void;
  }) {
    const { t } = useTranslation();
    const timeStr = new Date(item.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const st: MessageStatus = item._status === 'failed' ? 'failed' : item._status === 'sending' ? 'sending' : status || 'sent';
    const deleted = !!item.deleted_at;
    const tail = isMine ? { borderTopRightRadius: 6 } : { borderTopLeftRadius: 6 };
    return (
      <View
        style={{
          flexDirection: 'row',
          justifyContent: isMine ? 'flex-end' : 'flex-start',
          marginTop: groupStart ? 10 : 3,
          marginBottom: 1,
        }}
      >
        <SwipeToReply
          enabled={!deleted && !!onReply}
          onReply={() => onReply?.(item)}
          accentColor={ACCENT}
        >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={deleted
            ? t('messages.message_deleted', 'This message was deleted')
            : `${item.sender_name || 'Message'}: ${item.body}. Swipe right to reply, or tap for actions`}
          onPress={(event) =>
            !deleted && onOpenActions?.(item, {
              x: event.nativeEvent.pageX,
              y: event.nativeEvent.pageY,
            })
          }
          onLongPress={(event) =>
            !deleted && onOpenActions?.(item, {
              x: event.nativeEvent.pageX,
              y: event.nativeEvent.pageY,
            })
          }
          delayLongPress={280}
          style={[
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleTheirs,
            groupStart ? tail : null,
            { opacity: item._status === 'sending' ? 0.72 : 1 },
          ]}
        >
          {isMine && (
            <LinearGradient
              colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          )}
          {!!onOpenActions && !deleted && (
            <View style={styles.bubbleMenuHint}>
              <Ionicons
                name="chevron-down"
                size={14}
                color={isMine ? 'rgba(255,255,255,0.78)' : '#64748B'}
              />
            </View>
          )}
          {groupStart && showSender && !isMine && !!item.sender_name && (
            <Text style={styles.bubbleSender}>{item.sender_name}</Text>
          )}
          {!deleted && !!item.forwarded_from_message_id && (
            <View style={styles.forwardedLabel}>
              <Ionicons
                name="arrow-redo-outline"
                size={12}
                color={isMine ? 'rgba(255,255,255,0.72)' : '#64748B'}
              />
              <Text style={[styles.forwardedText, isMine && styles.forwardedTextMine]}>
                Forwarded
              </Text>
            </View>
          )}
          {!deleted && !!item.reply_to_message_id && (
            <View style={[styles.quotedMessage, isMine ? styles.quotedMessageMine : styles.quotedMessageTheirs]}>
              <View style={styles.quoteAccent} />
              <View style={styles.quoteContent}>
                <Text numberOfLines={1} style={[styles.quoteSender, isMine && styles.quoteSenderMine]}>
                  {item.reply_to_sender_name || 'Message'}
                </Text>
                <Text numberOfLines={2} style={[styles.quoteBody, isMine && styles.quoteBodyMine]}>
                  {item.reply_to_body || 'Original message unavailable'}
                </Text>
              </View>
            </View>
          )}
          {deleted ? (
            <View style={styles.deletedMessage}>
              <Ionicons
                name="ban-outline"
                size={16}
                color={isMine ? 'rgba(255,255,255,0.76)' : '#64748B'}
              />
              <Text style={[styles.deletedMessageText, isMine && styles.deletedMessageTextMine]}>
                {t('messages.message_deleted', 'This message was deleted')}
              </Text>
            </View>
          ) : (
            <Text style={{ fontSize: 15, color: isMine ? '#FFFFFF' : '#1E293B', lineHeight: 21 }}>{item.body}</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3, gap: 4 }}>
            {!!item.edited_at && !deleted && (
              <Text style={[styles.editedLabel, isMine && styles.editedLabelMine]}>
                {t('messages.edited', 'Edited')}
              </Text>
            )}
            <Text style={{ fontSize: 10.5, color: isMine ? 'rgba(255,255,255,0.75)' : '#94A3B8' }}>{timeStr}</Text>
            {isMine && <StatusTicks status={st} onRetry={onRetry} />}
          </View>
        </Pressable>
        </SwipeToReply>
      </View>
    );
  },
);

export function formatDayLabel(d: Date, t: (k: string, def?: string) => string): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return t('messages.today', 'Today');
  if (d.toDateString() === yesterday.toDateString()) return t('messages.yesterday', 'Yesterday');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export const DateSeparator = React.memo(({ label }: { label: string }) => (
  <View style={styles.dateSepWrap}>
    <View style={styles.dateSepPill}>
      <Text style={styles.dateSepText}>{label}</Text>
    </View>
  </View>
));
DateSeparator.displayName = 'DateSeparator';

export const SecurityBanner = React.memo(function SecurityBanner() {
  const { t } = useTranslation();
  return (
    <View style={styles.securityBanner}>
      <Ionicons name="lock-closed" size={12} color="#8A6D3B" />
      <Text style={styles.securityText}>
        {t(
          'messages.security_notice',
          'Messages are encrypted in transit and visible only to people in this chat and your school administrators.',
        )}
      </Text>
    </View>
  );
});

export const styles = StyleSheet.create({
  supportCard: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.14)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(79,70,229,0.16)',
    ...(Platform.OS === 'android'
      ? { elevation: 3 }
      : { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 14 }),
  },
  supportGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    right: -36,
    top: -56,
    backgroundColor: 'rgba(99,102,241,0.14)',
  },
  supportAccentBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3.5,
    borderRadius: 4,
    backgroundColor: ACCENT,
    opacity: 0.85,
  },
  supportTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  supportTitle: { fontSize: 15, fontWeight: '750' as any, color: '#1E1B4B', letterSpacing: -0.2 },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: 'rgba(79,70,229,0.10)',
  },
  verifiedText: { fontSize: 10, fontWeight: '700', color: ACCENT, letterSpacing: 0.2 },
  supportSub: { marginTop: 3, fontSize: 12.5, lineHeight: 17, color: '#63668A' },
  supportSubUnread: { color: '#4338CA', fontWeight: '600' },
  supportChat: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(15,23,42,0.18)',
  },
  supportUnread: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 7,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  supportUnreadText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    maxWidth: '88%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(253, 246, 220, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(180,140,60,0.12)',
  },
  securityText: { flex: 1, fontSize: 11.5, lineHeight: 16, color: '#8A6D3B', textAlign: 'center' },
  recipientRow: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: 'rgba(76,90,120,0.06)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(76,90,120,0.10)',
  },
  recipientName: { fontSize: 15, fontWeight: '650' as any, color: '#1E293B', flexShrink: 1 },
  recipientSub: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
  pinChip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatChip: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(79,70,229,0.12)',
  },
  convoRow: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: 'rgba(76,90,120,0.055)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(76,90,120,0.09)',
  },
  convoRowUnread: {
    backgroundColor: '#F7F8FF',
    borderColor: 'rgba(79,70,229,0.12)',
    borderBottomColor: 'rgba(79,70,229,0.14)',
  },
  convoUnreadBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3.5,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  convoTitle: { fontSize: 15, fontWeight: '600', color: '#1E293B', flex: 1, letterSpacing: -0.15 },
  convoTitleUnread: { fontWeight: '750' as any, color: '#0F172A' },
  convoDate: { fontSize: 11.5, color: '#94A3B8', fontWeight: '500' },
  convoDateUnread: { color: ACCENT, fontWeight: '700' },
  convoMeta: { fontSize: 11.5, color: '#64748B', marginTop: 1.5, fontWeight: '500' },
  convoPreview: { fontSize: 13, color: '#64748B', marginTop: 2.5 },
  convoPreviewUnread: { color: '#475569', fontWeight: '600' },
  unreadBadge: {
    backgroundColor: ACCENT,
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  bubble: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, overflow: 'hidden' },
  bubbleMine: {
    backgroundColor: ACCENT,
    borderBottomRightRadius: 5,
    ...(Platform.OS === 'android'
      ? { elevation: 2 }
      : { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6 }),
  },
  bubbleTheirs: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(76,90,120,0.08)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(76,90,120,0.12)',
  },
  bubbleSender: { fontSize: 12, fontWeight: '700', color: '#6D28D9', marginBottom: 2 },
  bubbleMenuHint: {
    position: 'absolute',
    top: 5,
    right: 7,
    zIndex: 1,
  },
  forwardedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    paddingRight: 18,
  },
  forwardedText: { fontSize: 11, fontStyle: 'italic', color: '#64748B' },
  forwardedTextMine: { color: 'rgba(255,255,255,0.72)' },
  quotedMessage: {
    minWidth: 180,
    marginBottom: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 10,
  },
  quotedMessageMine: { backgroundColor: 'rgba(15,23,42,0.17)' },
  quotedMessageTheirs: { backgroundColor: '#F1F5F9' },
  quoteAccent: { width: 3.5, backgroundColor: '#22C55E' },
  quoteContent: { flex: 1, paddingHorizontal: 9, paddingVertical: 6 },
  quoteSender: { fontSize: 11.5, fontWeight: '700', color: ACCENT },
  quoteSenderMine: { color: '#A7F3D0' },
  quoteBody: { marginTop: 2, fontSize: 11.5, lineHeight: 15, color: '#64748B' },
  quoteBodyMine: { color: 'rgba(255,255,255,0.82)' },
  deletedMessage: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 4 },
  deletedMessageText: { color: '#64748B', fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  deletedMessageTextMine: { color: 'rgba(255,255,255,0.78)' },
  editedLabel: { color: '#94A3B8', fontSize: 10, fontStyle: 'italic' },
  editedLabelMine: { color: 'rgba(255,255,255,0.68)' },
  dateSepWrap: { alignItems: 'center', marginVertical: 12 },
  dateSepPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(76,90,120,0.08)',
  },
  dateSepText: { fontSize: 11.5, fontWeight: '650' as any, color: '#475569' },
});
