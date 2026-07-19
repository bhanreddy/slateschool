import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from './useAuth';
import { useEffectiveStaffId } from './useEffectiveStaffId';
import { usePersistedSWR } from './usePersistedSWR';
import { persistentQueryCache } from '../services/persistentQueryCache';
import {
  MessagesService,
  type Conversation,
  type LiveState,
  type Message,
  type Recipient,
  type SupportContact,
  type UnreadTotal,
} from '../services/messagesService';

const TTL_30S = 30_000;
const TTL_5M = 5 * 60_000;
const POLL_INTERVAL = 5_000;

// ─── Thread message cache (local storage + in-session memory) ──────────────────
// Persist suffix for per-conversation history. Query key = conversationId, so
// each thread gets its own disk entry: `..._q_messages_thread?<conversationId>`.
const THREAD_CACHE_SUFFIX = 'messages_thread';
// Cap what we persist per thread so storage never grows unbounded; the newest
// slice is what a reopen needs — older pages come from loadOlder() on demand.
const THREAD_CACHE_LIMIT = 100;

// Same-session memory cache → instant, synchronous paint on reopen (no flash),
// backed by AsyncStorage below for survival across app restarts. Keyed by
// user + conversation so a re-login in the same session can't read another
// account's thread (disk entries are already user-namespaced by the cache key).
const threadMemCache = new Map<string, Message[]>();
const memKey = (userId: string, conversationId: string) => `${userId}:${conversationId}`;

/** Cache and optimistic sender identity must follow delegated staff access too. */
export function useMessageUserId(): string | null {
  const { user } = useAuth();
  const { userId: delegatedUserId } = useEffectiveStaffId();
  return delegatedUserId || user?.userId || null;
}

const sortAsc = (list: Message[]): Message[] =>
  [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

const messageChangeTimestamp = (message: Message): string => {
  const timestamps = [message.created_at, message.edited_at, message.deleted_at].filter(Boolean) as string[];
  return timestamps.reduce((latest, candidate) =>
    new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest
  );
};

const latestChangeTimestamp = (messages: Message[]): string | null =>
  messages.reduce<string | null>((latest, message) => {
    const changedAt = messageChangeTimestamp(message);
    return !latest || new Date(changedAt).getTime() > new Date(latest).getTime()
      ? changedAt
      : latest;
  }, null);

/** Merge incoming messages by id. Existing rows are replaced so edits/deletes sync too. */
const mergeMessages = (prev: Message[], incoming: Message[]): Message[] => {
  if (incoming.length === 0) return prev;
  const byId = new Map(prev.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return sortAsc([...byId.values()]);
};

// ─── Conversations list ───────────────────────────────────────────────────────

export function useConversations() {
  const userId = useMessageUserId();
  return usePersistedSWR<Conversation[]>({
    cacheKey: 'messages_convos',
    userId,
    ttlMs: TTL_30S,
    fetcher: () => MessagesService.getConversations({ limit: 50 }),
    persist: true,
    enabled: !!userId,
  });
}

// ─── Thread messages with delta sync polling ──────────────────────────────────

export function useThreadMessages(conversationId: string | null) {
  const userId = useMessageUserId();
  const isFocused = useIsFocused();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<LiveState | null>(null);
  const latestTimestampRef = useRef<string | null>(null);
  const lastTypingSentRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Initial load — cache-first, then delta-only.
  // Opening a chat NEVER re-fetches the whole history: we paint the locally
  // stored messages instantly and then ask the server only for messages NEWER
  // than the last one we have (the unread tail). A full page is fetched once,
  // and only when nothing is cached yet (first-ever open of that thread).
  useEffect(() => {
    if (!conversationId || !userId) return;
    const uid = userId;
    const mk = memKey(uid, conversationId);
    let cancelled = false;

    // 1a. Instant synchronous hydrate from the same-session memory cache.
    const mem = threadMemCache.get(mk);
    if (mem && mem.length > 0) {
      setMessages(mem);
      latestTimestampRef.current = latestChangeTimestamp(mem);
      setLoading(false);
    } else {
      setMessages([]);
      latestTimestampRef.current = null;
      setLoading(true);
    }

    (async () => {
      // 1b. If not in memory, hydrate from persistent (local) storage.
      if (!threadMemCache.has(mk)) {
        const cached = await persistentQueryCache.read<Message[]>(uid, THREAD_CACHE_SUFFIX, conversationId);
        if (cancelled) return;
        if (cached?.data?.length) {
          const sorted = sortAsc(cached.data);
          threadMemCache.set(mk, sorted);
          setMessages(sorted);
          latestTimestampRef.current = latestChangeTimestamp(sorted);
          setLoading(false);
        }
      }

      // 2. Sync from the server: only the newer/unread tail when we have a
      //    cache; otherwise the recent page once (first-ever open).
      const since = latestTimestampRef.current;
      try {
        const fetched = await MessagesService.getMessages(
          conversationId,
          since ? { since, limit: 50 } : { limit: 50 },
        );
        if (cancelled || !mountedRef.current) return;
        if (fetched.length > 0 || !since) {
          setMessages((prev) => {
            const merged = mergeMessages(prev, fetched);
            latestTimestampRef.current = latestChangeTimestamp(merged);
            return merged;
          });
        }
      } catch {
        // Offline / transient — keep the cached view rather than blanking it.
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [conversationId, userId]);

  // Persist the thread (memory + local storage) whenever it changes, so the
  // next open hydrates instantly and syncs delta-only. Optimistic (sending /
  // failed) messages are excluded — only server-confirmed rows are stored.
  useEffect(() => {
    if (!conversationId || !userId) return;
    const confirmed = messages.filter((m) => m._status !== 'sending' && m._status !== 'failed');
    if (confirmed.length === 0) return;
    // Guard against writing a previous thread's messages under the new id during
    // the brief switch window before the load effect resets state.
    if (confirmed[0].conversation_id !== conversationId) return;

    threadMemCache.set(memKey(userId, conversationId), confirmed);
    persistentQueryCache.write(
      userId,
      THREAD_CACHE_SUFFIX,
      confirmed.slice(-THREAD_CACHE_LIMIT),
      Date.now(),
      conversationId,
    );
  }, [messages, conversationId, userId]);

  // Delta sync polling while focused
  useEffect(() => {
    if (!conversationId || !isFocused || !userId) return;

    const interval = setInterval(async () => {
      if (!latestTimestampRef.current) return;
      try {
        const newMsgs = await MessagesService.getMessages(conversationId, {
          since: latestTimestampRef.current,
          limit: 50,
        });
        if (!mountedRef.current || newMsgs.length === 0) return;

        setMessages((prev) => {
          const merged = mergeMessages(prev, newMsgs);
          latestTimestampRef.current = latestChangeTimestamp(merged);
          return merged;
        });
      } catch {
        // ignore polling errors
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [conversationId, isFocused, userId]);

  // Live poll: delivery/seen receipts + typing + presence (one call). Also marks
  // the caller delivered + refreshes their presence heartbeat, server-side.
  useEffect(() => {
    if (!conversationId || !isFocused || !userId) return;
    let active = true;
    const tick = async () => {
      try {
        const l = await MessagesService.getLive(conversationId);
        if (active && mountedRef.current) setLive(l);
      } catch {
        // ignore live-poll errors (offline/transient)
      }
    };
    tick();
    const iv = setInterval(tick, POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [conversationId, isFocused, userId]);

  // Reset live state when switching conversations.
  useEffect(() => {
    setLive(null);
  }, [conversationId]);

  // Mark read on focus
  useEffect(() => {
    if (conversationId && isFocused) {
      MessagesService.markRead(conversationId).catch(() => {});
    }
  }, [conversationId, isFocused]);

  // Debounced "I'm typing" ping (max once / 2.5s → no DB spam).
  const notifyTyping = useCallback(() => {
    if (!conversationId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2500) return;
    lastTypingSentRef.current = now;
    MessagesService.markTyping(conversationId).catch(() => {});
  }, [conversationId]);

  // Optimistic send
  const sendMessage = useCallback(
    async (body: string, replyTo?: Message | null) => {
      if (!conversationId) return null;
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const optimistic: Message = {
        id: tempId,
        conversation_id: conversationId,
        sender_user_id: userId ?? '',
        sender_name: '',
        body,
        reply_to_message_id: replyTo?.id || null,
        reply_to_body: replyTo?.body || null,
        reply_to_sender_user_id: replyTo?.sender_user_id || null,
        reply_to_sender_name: replyTo?.sender_name || null,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        _status: 'sending',
      };

      setMessages((prev) => [...prev, optimistic]);
      latestTimestampRef.current = optimistic.created_at;

      try {
        // tempId doubles as the idempotency key so a retry never duplicates.
        const saved = await MessagesService.sendMessage(
          conversationId,
          body,
          tempId,
          replyTo ? { replyToMessageId: replyTo.id } : undefined,
        );
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...saved, _status: 'sent' as const } : m)),
        );
        latestTimestampRef.current = saved.created_at;
        return saved;
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, _status: 'failed' as const } : m)),
        );
        return null;
      }
    },
    [conversationId, userId],
  );

  // Retry failed message
  const retryMessage = useCallback(
    async (tempId: string) => {
      const msg = messages.find((m) => m.id === tempId && m._status === 'failed');
      if (!msg || !conversationId) return;

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, _status: 'sending' as const } : m)),
      );

      try {
        // Same tempId key → idempotent: if the first attempt actually landed, the
        // server returns that same row instead of creating a duplicate.
        const saved = await MessagesService.sendMessage(
          conversationId,
          msg.body,
          tempId,
          msg.reply_to_message_id ? { replyToMessageId: msg.reply_to_message_id } : undefined,
        );
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...saved, _status: 'sent' as const } : m)),
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, _status: 'failed' as const } : m)),
        );
      }
    },
    [conversationId, messages],
  );

  const editMessage = useCallback(
    async (messageId: string, body: string) => {
      if (!conversationId) return null;
      try {
        const saved = await MessagesService.editMessage(conversationId, messageId, body);
        setMessages((prev) => prev.map((message) => (message.id === messageId ? saved : message)));
        latestTimestampRef.current = messageChangeTimestamp(saved);
        return saved;
      } catch {
        return null;
      }
    },
    [conversationId],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!conversationId) return null;
      try {
        const saved = await MessagesService.deleteMessage(conversationId, messageId);
        setMessages((prev) => prev.map((message) => (message.id === messageId ? saved : message)));
        latestTimestampRef.current = messageChangeTimestamp(saved);
        return saved;
      } catch {
        return null;
      }
    },
    [conversationId],
  );

  // Load older messages
  const loadOlder = useCallback(async () => {
    if (!conversationId || messages.length === 0) return;
    const oldest = messages[0];
    try {
      const older = await MessagesService.getMessages(conversationId, {
        before: oldest.created_at,
        limit: 30,
      });
      if (older.length === 0) return;
      const sorted = [...older].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      setMessages((prev) => [...sorted, ...prev]);
    } catch {
      // ignore
    }
  }, [conversationId, messages]);

  return {
    messages,
    loading,
    live,
    sendMessage,
    editMessage,
    deleteMessage,
    retryMessage,
    loadOlder,
    notifyTyping,
  };
}

// ─── Unread total (for badge) ─────────────────────────────────────────────────

export function useUnreadTotal() {
  const userId = useMessageUserId();
  return usePersistedSWR<UnreadTotal>({
    cacheKey: 'messages_unread_total',
    userId,
    ttlMs: TTL_30S,
    fetcher: () => MessagesService.getUnreadTotal(),
    persist: false,
    enabled: !!userId,
    revalidateOnMount: true,
  });
}

// ─── Eligible recipients ──────────────────────────────────────────────────────

export function useEligibleRecipients() {
  const userId = useMessageUserId();
  return usePersistedSWR<Recipient[]>({
    cacheKey: 'messages_recipients',
    userId,
    ttlMs: TTL_5M,
    fetcher: () => MessagesService.getEligibleRecipients(),
    persist: true,
    enabled: !!userId,
    // Always re-fetch on open so a stale/empty cache never hides available
    // admins or teachers (cached copy still paints instantly first).
    revalidateOnMount: true,
  });
}

export function useSupportContact() {
  const userId = useMessageUserId();
  return usePersistedSWR<SupportContact>({
    cacheKey: 'messages_support_contact',
    userId,
    ttlMs: TTL_5M,
    fetcher: () => MessagesService.getSupportContact(),
    persist: true,
    enabled: !!userId,
    revalidateOnMount: true,
  });
}
