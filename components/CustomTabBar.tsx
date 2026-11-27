import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

const TABS = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'records', label: 'Records', icon: 'list' },
  { name: 'people', label: 'People', icon: 'users' },
  { name: 'analytics', label: 'Analytics', icon: 'bar-chart-2' },
  { name: 'profile', label: 'Profile', icon: 'user' },
] as const;

interface Props {
  state: { routes: { name: string }[]; index: number };
  navigation: { navigate: (name: string) => void };
}

export function CustomTabBar({ state, navigation }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const currentName = state.routes[state.index]?.name;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: c.background,
          borderTopColor: c.border,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 6),
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = currentName === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate(tab.name);
            }}
          >
            <View
              style={[
                styles.tabInner,
                isActive && { backgroundColor: c.card2 },
              ]}
            >
              <Feather
                name={tab.icon}
                size={19}
                color={isActive ? c.primary : c.text3}
              />
              <Text
                style={[
                  styles.label,
                  {
                    color: isActive ? c.text : c.text3,
                    fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_500Medium',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingTop: 7,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  tabInner: {
    minWidth: 56,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 3,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
  },
});
