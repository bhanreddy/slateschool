import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import type { Conversation, Message } from '@/src/services/messagesService';
import { copyToClipboard } from '@/src/utils/copyToClipboard';
import { Avatar } from './parts';

interface MessageActionSheetProps {
  message: Message | null;
  currentUserId?: string | null;
  anchor?: MessageActionAnchor;
  visible: boolean;
  onClose: () => void;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
}

export interface MessageActionAnchor {
  x: number;
  y: number;
}

type MessageAction = {
  key: 'reply' | 'forward' | 'copy' | 'edit' | 'delete';
  icon: 'arrow-undo-outline' | 'arrow-redo-outline' | 'copy-outline' | 'create-outline' | 'trash-outline';
  fallback: string;
  ownOnly?: boolean;
  destructive?: boolean;
};

const ACTIONS: readonly MessageAction[] = [
  { key: 'reply', icon: 'arrow-undo-outline', fallback: 'Reply' },
  { key: 'forward', icon: 'arrow-redo-outline', fallback: 'Forward' },
  { key: 'copy', icon: 'copy-outline', fallback: 'Copy' },
  { key: 'edit', icon: 'create-outline' as const, fallback: 'Edit', ownOnly: true },
  { key: 'delete', icon: 'trash-outline' as const, fallback: 'Delete', ownOnly: true, destructive: true },
] as const;

export function MessageActionSheet({
  message,
  currentUserId,
  anchor,
  visible,
  onClose,
  onReply,
  onForward,
  onEdit,
  onDelete,
}: MessageActionSheetProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [copied, setCopied] = useState(false);
  const [backdropReady, setBackdropReady] = useState(false);
  const serverConfirmed =
    !!message
    && !message.id.startsWith('temp_')
    && message._status !== 'sending'
    && message._status !== 'failed';
  const isOwnMessage = !!message && message.sender_user_id === currentUserId;
  const availableActions = ACTIONS.filter((action) => !action.ownOnly || isOwnMessage);
  const isWeb = Platform.OS === 'web';
  const menuWidth = 248;
  const menuHeight = 76 + availableActions.length * 46;
  const hasAnchor = Number.isFinite(anchor?.x) && Number.isFinite(anchor?.y);
  const menuLeft = hasAnchor
    ? Math.max(
        12,
        Math.min(
          (anchor?.x || 0) > width / 2 ? (anchor?.x || 0) - menuWidth - 10 : (anchor?.x || 0) + 10,
          width - menuWidth - 12,
        ),
      )
    : Math.max(12, (width - menuWidth) / 2);
  const menuTop = hasAnchor
    ? Math.max(12, Math.min((anchor?.y || 0) - 18, height - menuHeight - 12))
    : Math.max(12, (height - menuHeight) / 2);

  useEffect(() => {
    if (!visible) {
      setCopied(false);
      setBackdropReady(false);
      return undefined;
    }
    const timer = setTimeout(() => setBackdropReady(true), 180);
    return () => clearTimeout(timer);
  }, [visible]);

  const closeFromBackdrop = () => {
    if (!backdropReady) return;
    onClose();
  };

  const handleAction = async (key: (typeof ACTIONS)[number]['key']) => {
    if (!message) return;
    if (key === 'reply') {
      onReply(message);
      onClose();
      return;
    }
    if (key === 'forward') {
      onForward(message);
      onClose();
      return;
    }
    if (key === 'edit') {
      onEdit(message);
      onClose();
      return;
    }
    if (key === 'delete') {
      onDelete(message);
      onClose();
      return;
    }
    const success = await copyToClipboard(message.body);
    if (success) {
      setCopied(true);
      setTimeout(onClose, 450);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, isWeb && styles.overlayWeb]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close message actions"
          style={StyleSheet.absoluteFill}
          onPress={closeFromBackdrop}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.actionSheet,
            isWeb && styles.actionSheetWeb,
            isWeb && { left: menuLeft, top: menuTop },
          ]}
        >
          {!isWeb && <View style={styles.sheetHandle} />}
          <View style={[styles.messagePreview, isWeb && styles.messagePreviewWeb]}>
            <Text style={styles.messagePreviewEyebrow}>
              {isOwnMessage ? t('messages.your_message', 'Your message') : message?.sender_name}
            </Text>
            <Text numberOfLines={2} style={styles.messagePreviewBody}>{message?.body}</Text>
          </View>
          <View style={[styles.actionRow, isWeb && styles.actionRowWeb]}>
            {availableActions.map((action, index) => {
              const disabled = action.key !== 'copy' && !serverConfirmed;
              const label =
                action.key === 'copy' && copied
                  ? t('messages.copied', 'Copied')
                  : t(`messages.${action.key}`, action.fallback);
              return (
                <React.Fragment key={action.key}>
                  {isWeb && index > 0 && action.ownOnly && !availableActions[index - 1]?.ownOnly && (
                    <View style={styles.actionDivider} />
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    disabled={disabled}
                    onPress={() => handleAction(action.key)}
                    style={({ pressed }) => [
                      styles.actionButton,
                      isWeb && styles.actionButtonWeb,
                      action.destructive && styles.actionButtonDestructive,
                      pressed && !disabled && (action.destructive
                        ? styles.actionButtonDestructivePressed
                        : styles.actionButtonPressed),
                      disabled && styles.actionButtonDisabled,
                    ]}
                  >
                    <View
                      style={[
                        styles.actionIcon,
                        isWeb && styles.actionIconWeb,
                        action.destructive && styles.actionIconDestructive,
                      ]}
                    >
                      <Ionicons
                        name={action.key === 'copy' && copied ? 'checkmark' : action.icon}
                        size={isWeb ? 18 : 22}
                        color={disabled ? '#CBD5E1' : action.destructive ? '#DC2626' : '#4F46E5'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.actionLabel,
                        isWeb && styles.actionLabelWeb,
                        action.destructive && styles.actionLabelDestructive,
                        disabled && styles.actionLabelDisabled,
                      ]}
                    >
                      {label}
                    </Text>
                    {isWeb && (
                      <Ionicons
                        name="chevron-forward"
                        size={15}
                        color={action.destructive ? '#FCA5A5' : '#CBD5E1'}
                      />
                    )}
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ForwardMessageModalProps {
  message: Message | null;
  conversations: Conversation[];
  visible: boolean;
  onClose: () => void;
  onForward: (conversationIds: string[]) => Promise<void>;
}

export function ForwardMessageModal({
  message,
  conversations,
  visible,
  onClose,
  onForward,
}: ForwardMessageModalProps) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const forwardDialogHeight = Math.min(
    height - 48,
    Math.max(390, Math.min(620, 254 + Math.min(conversations.length, 5) * 68))
  );
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setSelected({});
      setSending(false);
      setError('');
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations
      .filter((conversation) => {
        const title = conversation.is_group
          ? conversation.group_name || ''
          : conversation.other_user_name || '';
        return !query || title.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [conversations, search]);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const toggle = (id: string) => {
    setSelected((previous) => ({ ...previous, [id]: !previous[id] }));
    setError('');
  };

  const submit = async () => {
    if (!message || selectedIds.length === 0 || sending) return;
    setSending(true);
    setError('');
    try {
      await onForward(selectedIds);
      onClose();
    } catch {
      setError(t('messages.forward_failed', 'Could not forward the message. Please try again.'));
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={isWeb}
      animationType={isWeb ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.forwardModalRoot, !isWeb && styles.forwardModalRootMobile]}>
        {isWeb && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
            style={StyleSheet.absoluteFill}
            onPress={onClose}
          />
        )}
        <View
          accessibilityViewIsModal
          style={[
            styles.forwardScreen,
            !isWeb && styles.forwardScreenMobile,
            isWeb && styles.forwardDialog,
            isWeb && { height: forwardDialogHeight },
          ]}
        >
        <View style={styles.forwardHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
            hitSlop={10}
            onPress={onClose}
            style={styles.headerIconButton}
          >
            <Ionicons name="close" size={26} color="#1E293B" />
          </Pressable>
          <View style={styles.forwardHeaderText}>
            <Text style={styles.forwardTitle}>{t('messages.forward_message', 'Forward message')}</Text>
            <Text style={styles.forwardSubtitle}>
              {selectedIds.length
                ? selectedIds.length === 1
                  ? t('messages.one_chat_selected', '1 chat selected')
                  : t('messages.chats_selected', '{{count}} chats selected', { count: selectedIds.length })
                : t('messages.choose_chats', 'Choose one or more chats')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('messages.forward', 'Forward')}
            disabled={selectedIds.length === 0 || sending}
            onPress={submit}
            style={({ pressed }) => [
              styles.forwardButton,
              isWeb && styles.forwardButtonWeb,
              (selectedIds.length === 0 || sending) && styles.forwardButtonDisabled,
              pressed && selectedIds.length > 0 && !sending && styles.forwardButtonPressed,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="arrow-redo" size={18} color="#FFFFFF" />
                {isWeb && (
                  <Text style={styles.forwardButtonText}>{t('messages.forward', 'Forward')}</Text>
                )}
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.forwardedPreview}>
          <Ionicons name="arrow-redo-outline" size={15} color="#64748B" />
          <Text numberOfLines={2} style={styles.forwardedPreviewText}>
            {message?.body}
          </Text>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={19} color="#94A3B8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('messages.search_chats', 'Search chats')}
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
          {!!search && (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={19} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <Text style={styles.sectionLabel}>{t('messages.recent_chats', 'Recent chats')}</Text>
        <FlatList
          data={filtered}
          style={styles.forwardListView}
          keyExtractor={(conversation) => conversation.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.forwardList}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {t('messages.no_forward_chats', 'No chats available to forward to.')}
            </Text>
          }
          renderItem={({ item }) => {
            const isGroup = !!item.is_group;
            const title = isGroup
              ? item.group_name || t('messages.group', 'Group')
              : item.other_user_name || t('messages.chat', 'Chat');
            const checked = !!selected[item.id];
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={title}
                onPress={() => toggle(item.id)}
                style={({ pressed }) => [
                  styles.chatRow,
                  checked && styles.chatRowSelected,
                  pressed && styles.chatRowPressed,
                ]}
              >
                <Avatar
                  name={title}
                  size={46}
                  isGroup={isGroup}
                  uri={isGroup ? undefined : item.other_user_photo}
                />
                <View style={styles.chatText}>
                  <Text numberOfLines={1} style={styles.chatTitle}>
                    {title}
                  </Text>
                  <Text numberOfLines={1} style={styles.chatPreview}>
                    {item.last_message_preview || t('messages.no_messages', 'No messages yet')}
                  </Text>
                </View>
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Ionicons name="checkmark" size={17} color="#FFFFFF" />}
                </View>
              </Pressable>
            );
          }}
        />
        </View>
      </View>
    </Modal>
  );
}

export function ReplyComposerPreview({
  message,
  currentUserId,
  onCancel,
}: {
  message: Message;
  currentUserId?: string | null;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const sender =
    message.sender_user_id === currentUserId
      ? t('messages.you', 'You')
      : message.sender_name || t('messages.unknown_sender', 'Unknown');

  return (
    <View style={styles.replyComposer}>
      <View style={styles.replyAccent} />
      <View style={styles.replyText}>
        <Text numberOfLines={1} style={styles.replySender}>
          {sender}
        </Text>
        <Text numberOfLines={1} style={styles.replyBody}>
          {message.body}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('messages.cancel_reply', 'Cancel reply')}
        hitSlop={8}
        onPress={onCancel}
        style={styles.cancelReply}
      >
        <Ionicons name="close" size={20} color="#64748B" />
      </Pressable>
    </View>
  );
}

export function EditComposerPreview({
  message,
  error,
  onCancel,
}: {
  message: Message;
  error?: string;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.replyComposer, styles.editComposer]}>
      <View style={[styles.replyAccent, styles.editAccent]} />
      <View style={styles.editIcon}>
        <Ionicons name="create-outline" size={17} color="#4F46E5" />
      </View>
      <View style={styles.replyText}>
        <Text numberOfLines={1} style={styles.replySender}>
          {t('messages.editing_message', 'Editing message')}
        </Text>
        <Text numberOfLines={1} style={styles.replyBody}>{message.body}</Text>
        {!!error && <Text numberOfLines={2} style={styles.editError}>{error}</Text>}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('messages.cancel_edit', 'Cancel edit')}
        hitSlop={8}
        onPress={onCancel}
        style={styles.cancelReply}
      >
        <Ionicons name="close" size={20} color="#64748B" />
      </Pressable>
    </View>
  );
}

export function DeleteMessageDialog({
  message,
  visible,
  onClose,
  onConfirm,
}: {
  message: Message | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const isWeb = Platform.OS === 'web';
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) {
      setDeleting(false);
      setError('');
    }
  }, [visible]);

  const confirm = async () => {
    if (deleting) return;
    setDeleting(true);
    setError('');
    const deleted = await onConfirm();
    if (deleted) {
      onClose();
      return;
    }
    setDeleting(false);
    setError(t('messages.delete_failed', 'Could not delete the message. Please try again.'));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.deleteOverlay, !isWeb && styles.deleteOverlayMobile]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close', 'Close')}
          style={StyleSheet.absoluteFill}
          onPress={deleting ? undefined : onClose}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={t('messages.delete_message', 'Delete message')}
          style={[styles.deleteDialog, !isWeb && styles.deleteDialogMobile]}
        >
          {!isWeb && <View style={styles.sheetHandle} />}
          <View style={styles.deleteWarningIcon}>
            <Ionicons name="trash-outline" size={24} color="#DC2626" />
          </View>
          <Text style={styles.deleteTitle}>{t('messages.delete_message', 'Delete message?')}</Text>
          <Text style={styles.deleteDescription}>
            {t(
              'messages.delete_for_everyone_description',
              'This message will be removed for everyone in this chat. This cannot be undone.',
            )}
          </Text>
          <View style={styles.deletePreview}>
            <Text numberOfLines={2} style={styles.deletePreviewText}>{message?.body}</Text>
          </View>
          {!!error && <Text style={styles.deleteError}>{error}</Text>}
          <View style={styles.deleteActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel', 'Cancel')}
              disabled={deleting}
              onPress={onClose}
              style={({ pressed }) => [styles.deleteCancelButton, pressed && styles.deleteCancelButtonPressed]}
            >
              <Text style={styles.deleteCancelText}>{t('common.cancel', 'Cancel')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('messages.delete_for_everyone', 'Delete for everyone')}
              disabled={deleting}
              onPress={confirm}
              style={({ pressed }) => [
                styles.deleteConfirmButton,
                pressed && !deleting && styles.deleteConfirmButtonPressed,
                deleting && styles.actionButtonDisabled,
              ]}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.deleteConfirmText}>
                    {t('messages.delete_for_everyone', 'Delete for everyone')}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  overlayWeb: {
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(15, 23, 42, 0.14)',
  },
  actionSheet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? {
          marginBottom: 24,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          boxShadow: '0 18px 50px rgba(15, 23, 42, 0.22)',
        }
      : {}),
  },
  actionSheetWeb: {
    position: 'absolute',
    width: 236,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    boxShadow: '0 14px 38px rgba(15, 23, 42, 0.22)',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 12,
  },
  messagePreview: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  messagePreviewWeb: {
    marginBottom: 6,
    borderRadius: 9,
  },
  messagePreviewEyebrow: {
    color: '#4F46E5',
    fontSize: 10.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  messagePreviewBody: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
  actionRowWeb: {
    flexDirection: 'column',
    gap: 2,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: '28%',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
  },
  actionButtonWeb: {
    flex: 0,
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
  },
  actionButtonPressed: {
    backgroundColor: '#EEF2FF',
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  actionButtonDestructive: {
    backgroundColor: '#FFF7F7',
  },
  actionButtonDestructivePressed: {
    backgroundColor: '#FEE2E2',
  },
  actionDivider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    marginVertical: 3,
    backgroundColor: '#E2E8F0',
  },
  actionIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    marginBottom: 5,
  },
  actionIconWeb: {
    width: 34,
    height: 34,
    borderRadius: 10,
    marginRight: 10,
    marginBottom: 0,
  },
  actionIconDestructive: {
    backgroundColor: '#FEE2E2',
  },
  actionLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  actionLabelWeb: {
    flex: 1,
    fontSize: 14,
    textAlign: 'left',
  },
  actionLabelDisabled: {
    color: '#94A3B8',
  },
  actionLabelDestructive: {
    color: '#DC2626',
  },
  forwardScreen: {
    width: '100%',
    backgroundColor: '#F8FAFC',
  },
  forwardScreenMobile: {
    flex: 1,
  },
  forwardModalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
  },
  forwardModalRootMobile: {
    padding: 0,
    backgroundColor: '#F8FAFC',
  },
  forwardDialog: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
    maxWidth: 540,
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.28)',
  },
  forwardHeader: {
    minHeight: Platform.OS === 'ios' ? 94 : 68,
    paddingTop: Platform.OS === 'ios' ? 26 : 0,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forwardHeaderText: {
    flex: 1,
    marginLeft: 4,
  },
  forwardTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '700',
  },
  forwardSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  forwardButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    marginRight: 4,
  },
  forwardButtonWeb: {
    width: 'auto',
    minWidth: 104,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 7,
  },
  forwardButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  forwardButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  forwardButtonPressed: {
    opacity: 0.78,
  },
  forwardedPreview: {
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
  },
  forwardedPreviewText: {
    flex: 1,
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  searchBox: {
    height: 44,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    color: '#1E293B',
    fontSize: 15,
    paddingVertical: 0,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginHorizontal: 18,
    marginTop: 9,
  },
  sectionLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 4,
  },
  forwardList: {
    flexGrow: 1,
    padding: 12,
    paddingBottom: 20,
  },
  forwardListView: {
    flex: 1,
  },
  chatRow: {
    minHeight: 68,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
  },
  chatRowPressed: {
    backgroundColor: '#EEF2FF',
  },
  chatRowSelected: {
    backgroundColor: '#EEF2FF',
  },
  chatText: {
    flex: 1,
    marginLeft: 12,
  },
  chatTitle: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '600',
  },
  chatPreview: {
    color: '#94A3B8',
    fontSize: 12.5,
    marginTop: 3,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginLeft: 10,
  },
  checkboxChecked: {
    borderColor: '#4F46E5',
    backgroundColor: '#4F46E5',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 50,
  },
  replyComposer: {
    minHeight: 58,
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 8,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  editComposer: {
    backgroundColor: '#EEF2FF',
  },
  replyAccent: {
    alignSelf: 'stretch',
    width: 4,
    borderRadius: 2,
    backgroundColor: '#4F46E5',
    marginRight: 10,
  },
  editAccent: {
    backgroundColor: '#6366F1',
    marginRight: 0,
  },
  editIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  editError: {
    color: '#DC2626',
    fontSize: 11,
    marginTop: 3,
  },
  replyText: {
    flex: 1,
  },
  replySender: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '700',
  },
  replyBody: {
    color: '#64748B',
    fontSize: 12.5,
    marginTop: 2,
  },
  cancelReply: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  deleteOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  deleteOverlayMobile: {
    justifyContent: 'flex-end',
    padding: 0,
  },
  deleteDialog: {
    width: '100%',
    maxWidth: 430,
    padding: 24,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.28)',
  },
  deleteDialogMobile: {
    maxWidth: 560,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  deleteWarningIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderRadius: 15,
    backgroundColor: '#FEE2E2',
  },
  deleteTitle: {
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '800',
  },
  deleteDescription: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  deletePreview: {
    marginTop: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderLeftWidth: 3,
    borderLeftColor: '#FCA5A5',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  deletePreviewText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  deleteError: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 10,
  },
  deleteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },
  deleteCancelButton: {
    height: 44,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  deleteCancelButtonPressed: {
    backgroundColor: '#F8FAFC',
  },
  deleteCancelText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteConfirmButton: {
    height: 44,
    minWidth: 174,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 12,
    backgroundColor: '#DC2626',
  },
  deleteConfirmButtonPressed: {
    backgroundColor: '#B91C1C',
  },
  deleteConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
