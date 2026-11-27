import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  title: string;
  value: string;
  color?: string;
  subtitle?: string;
}

function sentenceCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function StatCard({ title, value, subtitle }: Props) {
  const c = useColors();

  return (
    <View
      style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
    >
      <Text
        style={[
          styles.title,
          { color: c.text2, fontFamily: 'Inter_500Medium' },
        ]}
      >
        {sentenceCase(title)}
      </Text>
      <Text
        style={[
          styles.value,
          { color: c.text, fontFamily: 'Inter_600SemiBold' },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            { color: c.text3, fontFamily: 'Inter_400Regular' },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    minWidth: 0,
  },
  title: { fontSize: 12, lineHeight: 16 },
  value: { fontSize: 22, fontVariant: ['tabular-nums'] },
  subtitle: { fontSize: 12 },
});
