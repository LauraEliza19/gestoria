import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import {
  type ColorValue,
  StyleSheet,
  View,
} from 'react-native';

import {
  radii,
  sereneColors,
} from '@/theme/tokens';

type IoniconName = ComponentProps<
  typeof Ionicons
>['name'];

type TabIconProps = {
  color: ColorValue;
  focused: boolean;
  activeName: IoniconName;
  inactiveName: IoniconName;
  size?: number;
};

function TabIcon({
  color,
  focused,
  activeName,
  inactiveName,
  size = 24,
}: TabIconProps) {
  return (
    <View
      style={[
        styles.iconContainer,
        focused && styles.iconContainerFocused,
      ]}
    >
      <Ionicons
        color={
          focused
            ? sereneColors.primary
            : color
        }
        name={focused ? activeName : inactiveName}
        size={size}
      />
    </View>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: sereneColors.primary,
        tabBarHideOnKeyboard: true,
        tabBarIconStyle: styles.tabBarIcon,
        tabBarInactiveTintColor:
          sereneColors.textSubtle,
        tabBarItemStyle: styles.tabBarItem,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarAccessibilityLabel: 'Abrir início',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              activeName="home"
              color={color}
              focused={focused}
              inactiveName="home-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alertas',
          tabBarAccessibilityLabel:
            'Abrir central de alertas',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              activeName="notifications"
              color={color}
              focused={focused}
              inactiveName="notifications-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="copilot"
        options={{
          title: 'Copiloto',
          tabBarAccessibilityLabel: 'Abrir Copiloto',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              activeName="sparkles"
              color={color}
              focused={focused}
              inactiveName="sparkles-outline"
              size={25}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="modules"
        options={{
          title: 'Módulos',
          tabBarAccessibilityLabel:
            'Abrir módulos da empresa',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              activeName="grid"
              color={color}
              focused={focused}
              inactiveName="grid-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="account"
        options={{
          title: 'Conta',
          tabBarAccessibilityLabel: 'Abrir conta',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              activeName="person"
              color={color}
              focused={focused}
              inactiveName="person-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: sereneColors.tabBar,
    borderColor: sereneColors.border,
    borderRadius: radii.pill,
    borderTopWidth: 0,
    borderWidth: 1,
    bottom: 18,
    elevation: 14,
    height: 68,
    left: 24,
    paddingBottom: 0,
    paddingHorizontal: 8,
    paddingTop: 0,
    position: 'absolute',
    right: 24,
    shadowColor: '#020817',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },

  tabBarItem: {
    alignItems: 'center',
    height: 66,
    justifyContent: 'center',
    margin: 0,
    padding: 0,
  },

  tabBarIcon: {
    alignItems: 'center',
    height: 46,
    justifyContent: 'center',
    margin: 0,
    padding: 0,
    width: 46,
  },

  iconContainer: {
    alignItems: 'center',
    borderRadius: radii.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  iconContainerFocused: {
    backgroundColor: sereneColors.sheetSurface,
    shadowColor: '#020817',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
});