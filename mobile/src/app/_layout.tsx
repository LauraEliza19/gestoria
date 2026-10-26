import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { useAuth } from '@/features/auth/context/useAuth';
import {
  colors,
  sereneColors,
} from '@/theme/tokens';

function RootNavigator() {
  const { status } = useAuth();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Protected guard={status === 'loading'}>
        <Stack.Screen name="loading" />
      </Stack.Protected>

      <Stack.Protected
        guard={status === 'unauthenticated'}
      >
        <Stack.Screen name="index" />
      </Stack.Protected>

      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen
          name="(app)"
          options={{
            contentStyle: {
              backgroundColor:
                sereneColors.background,
            },
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}