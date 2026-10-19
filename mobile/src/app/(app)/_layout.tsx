import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { colors, fontSizes, spacing } from '@/theme/tokens';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarAccessibilityLabel: 'Abrir início',
          tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>⌂</Text>,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Pedidos',
          tabBarAccessibilityLabel: 'Abrir pedidos',
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]}>≡</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="copilot"
        options={{
          title: 'Copiloto',
          tabBarAccessibilityLabel: 'Abrir Copiloto',
          tabBarIcon: ({ color }) => (
            <Text style={[styles.icon, { color }]}>✦</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Conta',
          tabBarAccessibilityLabel: 'Abrir conta',
          tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>●</Text>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 68,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
  label: {
    fontSize: fontSizes.caption,
    fontWeight: '700',
  },
  icon: {
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 24,
  },
});
