/**
 * WhatsApp-style right-swipe-to-reply for chat bubbles.
 * UI-thread pan (Reanimated) — safe inside FlatList on low-end Android.
 */
import React, { useCallback } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { HapticFeedback } from '@/src/utils/animations';

const REPLY_THRESHOLD = 56;
const MAX_SWIPE = 72;
const SPRING = { damping: 18, stiffness: 220, mass: 0.7 };

type Props = {
  enabled?: boolean;
  onReply: () => void;
  accentColor?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function SwipeToReply({
  enabled = true,
  onReply,
  accentColor = '#4F46E5',
  children,
  style,
}: Props) {
  const translateX = useSharedValue(0);
  const crossed = useSharedValue(false);

  const fireReply = useCallback(() => {
    onReply();
  }, [onReply]);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(14)
    .failOffsetY([-12, 12])
    .onBegin(() => {
      crossed.value = false;
    })
    .onUpdate((event) => {
      const x = Math.max(0, Math.min(event.translationX, MAX_SWIPE));
      translateX.value = x;
      if (x >= REPLY_THRESHOLD && !crossed.value) {
        crossed.value = true;
        runOnJS(HapticFeedback.light)();
      } else if (x < REPLY_THRESHOLD * 0.85) {
        crossed.value = false;
      }
    })
    .onEnd(() => {
      if (translateX.value >= REPLY_THRESHOLD) {
        runOnJS(fireReply)();
      }
      translateX.value = withSpring(0, SPRING);
    })
    .onFinalize(() => {
      if (translateX.value !== 0) {
        translateX.value = withSpring(0, SPRING);
      }
    });

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, REPLY_THRESHOLD * 0.35, REPLY_THRESHOLD],
      [0, 0.55, 1],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      translateX.value,
      [0, REPLY_THRESHOLD],
      [0.45, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [
        {
          translateX: interpolate(
            translateX.value,
            [0, MAX_SWIPE],
            [-10, 2],
            Extrapolation.CLAMP,
          ),
        },
        { scale },
      ],
    };
  });

  if (!enabled) {
    return <View style={[styles.wrap, style]}>{children}</View>;
  }

  return (
    <View style={[styles.wrap, style]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.replyIcon, iconStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.replyIconBg, { backgroundColor: accentColor }]}>
          <Ionicons name="arrow-undo" size={15} color="#FFFFFF" />
        </View>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.bubbleHost, bubbleStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  // maxWidth must live here (full chat row), not on the bubble —
  // % maxWidth on a shrink-wrapped parent collapses the card on web.
  wrap: {
    position: 'relative',
    justifyContent: 'center',
    maxWidth: '82%',
    flexShrink: 1,
  },
  bubbleHost: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  replyIcon: {
    position: 'absolute',
    left: 2,
    zIndex: 0,
  },
  replyIconBg: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
