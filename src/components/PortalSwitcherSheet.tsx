import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { alertCompat } from '../utils/crossPlatformAlert';
import type { AccessContext, AccessContextGroup } from '../types/context';

const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/2922/2922506.png';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function portalLabel(portalType: string): string {
  switch (portalType) {
    case 'student': return 'Parent Portal';
    case 'staff': return 'Staff Portal';
    case 'admin': return 'Admin Portal';
    case 'accounts': return 'Accounts Portal';
    case 'driver': return 'Driver Portal';
    default: return portalType;
  }
}

export default function PortalSwitcherSheet({ visible, onClose }: Props) {
  const { portalContexts, switchPortalContext, refreshPortalContexts } = useAuth();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [groups, setGroups] = useState<AccessContextGroup[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeContext, setActiveContext] = useState<AccessContext | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await refreshPortalContexts();
      setGroups(payload.groups);
      setActiveId(payload.activeContextId);
      setActiveContext(payload.activeContext);
    } catch {
      if (portalContexts) {
        setGroups(portalContexts.groups);
        setActiveId(portalContexts.activeContextId);
        setActiveContext(portalContexts.activeContext);
      }
    } finally {
      setLoading(false);
    }
  }, [portalContexts, refreshPortalContexts]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const onSwitch = async (ctx: AccessContext) => {
    if (busyId) return;
    if (ctx.id === activeId) {
      onClose();
      return;
    }
    setBusyId(ctx.id);
    try {
      const payload = await switchPortalContext(ctx.id);
      setGroups(payload.groups);
      setActiveId(payload.activeContextId);
      setActiveContext(payload.activeContext);
      onClose();
      const home = payload.activeContext?.home_route;
      if (home) {
        router.replace(home as any);
      }
    } catch (e: any) {
      alertCompat('Could not switch', e?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const sheetBg = isDark ? '#1c1c1e' : '#ffffff';
  const muted = isDark ? '#8e8e93' : '#6c6c70';
  const border = isDark ? '#38383a' : '#e5e5ea';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: sheetBg,
              maxHeight: height * 0.82,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: border }]} />
          <Text style={[styles.title, { color: theme.colors.text }]}>Switch portal / profile</Text>

          {activeContext && (
            <View style={[styles.activeCard, { borderColor: border, backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}>
              <Text style={[styles.activeLabel, { color: muted }]}>Currently active</Text>
              <Text style={[styles.activeName, { color: theme.colors.text }]}>{activeContext.display_name}</Text>
              <Text style={[styles.activeSub, { color: muted }]}>
                {portalLabel(activeContext.portal_type)}
                {activeContext.subtitle ? ` · ${activeContext.subtitle}` : ''}
              </Text>
            </View>
          )}

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={theme.colors.primary} />
          ) : groups.length === 0 ? (
            <Text style={[styles.empty, { color: muted }]}>No switchable profiles found for this account.</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {groups.map((group) => (
                <View key={group.portal_type} style={styles.group}>
                  <Text style={[styles.groupLabel, { color: muted }]}>{group.label.toUpperCase()}</Text>
                  {group.contexts.map((ctx, idx) => (
                    <Animated.View key={ctx.id} entering={FadeInDown.delay(idx * 40)}>
                      <TouchableOpacity
                        style={[styles.row, { borderBottomColor: border }]}
                        onPress={() => onSwitch(ctx)}
                        disabled={!!busyId}
                      >
                        <Image
                          source={{ uri: ctx.photo_url || FALLBACK_AVATAR }}
                          style={styles.avatar}
                        />
                        <View style={styles.rowText}>
                          <Text style={[styles.rowName, { color: theme.colors.text }]}>{ctx.display_name}</Text>
                          <Text style={[styles.rowSub, { color: muted }]}>
                            {portalLabel(ctx.portal_type)}
                            {ctx.subtitle ? ` · ${ctx.subtitle}` : ''}
                          </Text>
                        </View>
                        {busyId === ctx.id ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : ctx.id === activeId ? (
                          <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                        ) : (
                          <Ionicons name="chevron-forward" size={18} color={muted} />
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  activeCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  activeLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  activeName: { fontSize: 16, fontWeight: '700' },
  activeSub: { fontSize: 13, marginTop: 2 },
  empty: { textAlign: 'center', marginVertical: 24, fontSize: 14 },
  group: { marginBottom: 8 },
  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  rowText: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
});
