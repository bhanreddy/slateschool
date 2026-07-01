import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

export default function ViewAsBanner({ name, limited }: { name?: string; limited?: boolean }) {
  const { isDark } = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: isDark ? 'rgba(255,176,26,0.14)' : 'rgba(255,176,26,0.10)',
          borderColor: isDark ? 'rgba(255,176,26,0.30)' : 'rgba(255,176,26,0.28)',
        },
      ]}
    >
      <Ionicons name="eye-outline" size={14} color="#B45309" style={{ marginRight: 7 }} />
      <Text style={styles.text} numberOfLines={2}>
        Viewing {name || 'staff'}'s portal — Admin (read-only)
        {limited ? '. This section isn\'t available in admin view yet.' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
});
