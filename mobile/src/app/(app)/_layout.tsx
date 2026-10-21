import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import {
  type ColorValue,
  StyleSheet,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  size = 22,
}: TabIconProps) {
  return (
    <View style={styles.iconContainer}>
      {focused ? (
        <View style={styles.activeIndicator}>
          <View style={styles.activeIndicatorAccent} />
        </View>
      ) : null}

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
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: sereneColors.primary,
        tabBarHideOnKeyboard: true,
        tabBarIconStyle: styles.tabBarIcon,
        tabBarInactiveTintColor:
          sereneColors.sheetTextMuted,
        tabBarItemStyle: styles.tabBarItem,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 60 + bottomInset,
            paddingBottom: bottomInset,
          },
        ],
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
              size={23}
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

      <Tabs.Screen
        name="finance"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="finance-entry"
        options={{
          href: null,
          tabBarStyle: {
            display: 'none',
          },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: sereneColors.sheetSurface,
    borderTopColor: sereneColors.sheetBorder,
    borderTopWidth: 1,
    bottom: 0,
    elevation: 18,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 0,
    position: 'absolute',
    right: 0,
    shadowColor: '#071225',
    shadowOffset: {
      width: 0,
      height: -6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    width: 'auto',
  },

  tabBarItem: {
    alignItems: 'center',
    flex: 1,
    height: 60,
    justifyContent: 'center',
    margin: 0,
    padding: 0,
  },

  tabBarIcon: {
    alignItems: 'center',
    height: 60,
    justifyContent: 'center',
    margin: 0,
    padding: 0,
    width: '100%',
  },

  iconContainer: {
    alignItems: 'center',
    height: 60,
    justifyContent: 'center',
    position: 'relative',
    width: 52,
  },

  activeIndicator: {
    backgroundColor: sereneColors.primary,
    borderRadius: radii.pill,
    height: 4,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    width: 32,
  },

  activeIndicatorAccent: {
    alignSelf: 'flex-end',
    backgroundColor: sereneColors.brandCyan,
    height: 4,
    width: 10,
  },
});
