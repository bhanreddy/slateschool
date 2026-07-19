import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import type { MessengerRole } from '@/src/services/messagesService';

const roleTint: Record<string, { bg: string; fg: string }> = {
  admin: { bg: '#FFE9D6', fg: '#C2410C' },
  teacher: { bg: '#E3EAFF', fg: '#2A50D8' },
  staff: { bg: '#E3EAFF', fg: '#2A50D8' },
  parent: { bg: '#DCFCE7', fg: '#15803D' },
  student: { bg: '#DCFCE7', fg: '#15803D' },
  support: { bg: '#E8E7FF', fg: '#4F46E5' },
};

interface Props {
  visible: boolean;
  name: string;
  imageUrl?: string | null;
  role?: MessengerRole;
  isGroup?: boolean;
  onClose: () => void;
}

function getInitials(name: string): string {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ProfilePhotoViewer({
  visible,
  name,
  imageUrl,
  role,
  isGroup = false,
  onClose,
}: Props) {
  const { width, height } = useWindowDimensions();
  const imageWidth = Math.min(width, 720);
  const imageHeight = Math.min(height * 0.72, 720);
  const fallbackSize = Math.min(width * 0.62, height * 0.48, 360);
  const tint = roleTint[role || 'teacher'] || roleTint.teacher;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        accessibilityViewIsModal
        style={styles.backdrop}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss profile photo"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <View style={styles.topBar}>
          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close profile photo"
            hitSlop={12}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>

        <View
          accessibilityRole="image"
          accessibilityLabel={`${name} profile photo`}
          style={[styles.photoStage, styles.nonInteractive]}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: imageWidth, height: imageHeight }}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={150}
            />
          ) : (
            <View
              style={[
                styles.fallback,
                {
                  width: fallbackSize,
                  height: fallbackSize,
                  borderRadius: fallbackSize / 2,
                  backgroundColor: tint.bg,
                },
              ]}
            >
              {isGroup ? (
                <Ionicons name="people" size={fallbackSize * 0.46} color={tint.fg} />
              ) : role === 'support' ? (
                <Ionicons name="headset" size={fallbackSize * 0.44} color={tint.fg} />
              ) : (
                <Text style={[styles.initials, { color: tint.fg, fontSize: fallbackSize * 0.3 }]}>
                  {getInitials(name)}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
  },
  topBar: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    left: 0,
    right: 0,
    minHeight: Platform.OS === 'web' ? 64 : 76,
    paddingTop: Platform.OS === 'web' ? 0 : 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  name: {
    flex: 1,
    marginRight: 16,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  photoStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
  },
  nonInteractive: {
    pointerEvents: 'none',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
  },
});
