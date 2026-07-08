import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AppTextInput from './AppTextInput';
import { clayCard, clayInset } from '../theme/clayStyles';

const FONT = Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif';

interface ClayInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  isDark: boolean;
  multiline?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  suffix?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export default function ClayInput({
  label,
  value,
  onChangeText,
  placeholder,
  isDark,
  multiline,
  icon,
  suffix,
  containerStyle,
}: ClayInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ marginBottom: 18 }, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
          {label}
        </Text>
      )}
      
      {/* Outer Thick Clay Frame */}
      <View style={[styles.outerFrame, clayCard(isDark, 'sm')]}>
        {/* Inner Deep Recessed Cavity */}
        <View
          style={[
            styles.innerCavity,
            multiline && styles.multiCavity,
            clayInset(isDark, focused) as any,
          ]}
        >
          {icon && (
            <MaterialIcons
              name={icon}
              size={16}
              color={focused ? (isDark ? '#6366F1' : '#4F46E5') : (isDark ? '#475569' : '#94A3B8')}
              style={{ marginTop: multiline ? 2 : 0 }}
            />
          )}
          
          <AppTextInput
            style={[
              styles.input,
              multiline && styles.multiInput,
              {
                color: isDark ? '#EEF2FF' : '#0F172A',
                fontFamily: FONT,
                backgroundColor: 'transparent',
                borderWidth: 0,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
              } as any,
            ]}
            placeholder={placeholder}
            placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
            value={value}
            onChangeText={onChangeText}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            numberOfLines={multiline ? 4 : 1}
          />
          {suffix}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  outerFrame: {
    padding: 6, // Thick frame around the input
    borderRadius: 18,
  },
  innerCavity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  multiCavity: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
    minHeight: 22,
  },
  multiInput: {
    minHeight: 90,
    lineHeight: 20,
  },
});
