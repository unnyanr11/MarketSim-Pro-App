import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  priority: number;
  roomStatus?: string;
  style?: object;
}

const LABELS: Record<number, { label: string; color: string; icon: string }> = {
  1: { label: 'CHECKOUT', color: '#22c55e', icon: '🏁' },
  2: { label: 'VIP / SUITE', color: '#a78bfa', icon: '⭐' },
  3: { label: 'EARLY CHECK-IN', color: '#f59e0b', icon: '🔑' },
  4: { label: 'STAY-OVER', color: '#0ea5e9', icon: '🛏' },
  5: { label: 'STANDARD', color: '#475569', icon: '🏨' },
};

export function PriorityLabel({ priority, style }: Props) {
  const info = LABELS[priority] ?? LABELS[5];
  return (
    <View style={[styles.badge, { backgroundColor: info.color + '22', borderColor: info.color }, style]}>
      <Text style={styles.icon}>{info.icon}</Text>
      <Text style={[styles.text, { color: info.color }]}>{info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
    alignSelf: 'flex-start',
  },
  icon: { fontSize: 11 },
  text: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
});
