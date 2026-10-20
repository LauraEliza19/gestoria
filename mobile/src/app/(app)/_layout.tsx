import { Tabs } from 'expo-router';
import {
  type ColorValue,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  fontSizes,
  radii,
  sereneColors,
} from '@/theme/tokens';

type TabIconProps = {
  color: ColorValue;
  focused: boolean;
  symbol: string;
};

function TabIcon({
  color,
  focused,
  symbol,
}: TabIconProps) {
  return (
    <View
      style={[
        styles.iconContainer,
        focused && styles.iconContainerFocused,
      ]}
    >
      <Text
        style={[
          styles.icon,
          { color },
          focused && styles.iconFocused,
        ]}
      >
        {symbol}
      </Text>
    </View>
  );
}

type CopilotIconProps = {
  focused: boolean;
};

function CopilotIcon({ focused }: CopilotIconProps) {
  return (
    <View
      style={[
        styles.iconContainer,
        focused && styles.iconContainerFocused,
      ]}
    >
      <Text
        style={[
          styles.copilotIcon,
          focused && styles.copilotIconFocused,
        ]}
      >
        ✦
      </Text>
    </View>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: sereneColors.primary,
        tabBarInactiveTintColor:
          sereneColors.textMuted,
        tabBarHideOnKeyboard: true,
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
              color={color}
              focused={focused}
              symbol="⌂"
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
              color={color}
              focused={focused}
              symbol="!"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="copilot"
        options={{
          title: 'Copiloto',
          tabBarAccessibilityLabel: 'Abrir Copiloto',
          tabBarIcon: ({ focused }) => (
            <CopilotIcon focused={focused} />
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
              color={color}
              focused={focused}
              symbol="▦"
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
              color={color}
              focused={focused}
              symbol="○"
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
    paddingHorizontal: 10,
    paddingTop: 0,
    position: 'absolute',
    right: 24,
    shadowColor: '#020817',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.26,
    shadowRadius: 18,
  },
  tabBarItem: {
    alignItems: 'center',
    height: 66,
    justifyContent: 'center',
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
  },
  icon: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 25,
  },
  iconFocused: {
    color: sereneColors.primary,
  },
  copilotIcon: {
    color: sereneColors.primary,
    fontSize: fontSizes.title,
    fontWeight: '800',
    lineHeight: 28,
  },
  copilotIconFocused: {
    color: sereneColors.primaryPressed,
  },
});
