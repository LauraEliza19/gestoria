import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, fontSizes, spacing } from '@/theme/tokens';

export default function LoadingRoute() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>Preparando seu GestorIA...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  text: {
    color: colors.textMuted,
    fontSize: fontSizes.body,
  },
});