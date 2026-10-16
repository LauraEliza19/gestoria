import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/context/useAuth';
import { colors, fontSizes, radii, spacing } from '@/theme/tokens';

const roleLabels = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
} as const;

export function AccountScreen() {
  const { session, status, error, signOut } = useAuth();
  const isLoading = status === 'loading';
  const organizationName = session?.organization.name ?? 'Sua empresa';

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      return;
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>CONTA</Text>
        <Text style={styles.title}>Seu acesso</Text>
        <Text style={styles.description}>
          Confira a conta e a empresa conectadas neste aparelho.
        </Text>

        <View style={styles.card}>
          <Text style={styles.name}>{session?.full_name ?? 'Usuário'}</Text>
          <Text style={styles.organization}>{organizationName}</Text>

          <View style={styles.divider} />

          <Text style={styles.detailLabel}>E-mail</Text>
          <Text style={styles.detailValue}>{session?.email ?? '—'}</Text>

          <Text style={styles.detailLabel}>Perfil de acesso</Text>
          <Text style={styles.detailValue}>{session ? roleLabels[session.role] : '—'}</Text>
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={handleSignOut}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && !isLoading && styles.logoutButtonPressed,
            isLoading && styles.logoutButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          {isLoading ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.logoutButtonText}>Sair da conta</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: fontSizes.caption,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.display,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  description: {
    color: colors.textMuted,
    fontSize: fontSizes.body,
    lineHeight: 23,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.xxl,
    padding: spacing.xl,
  },
  name: {
    color: colors.text,
    fontSize: fontSizes.title,
    fontWeight: '800',
  },
  organization: {
    color: colors.textMuted,
    fontSize: fontSizes.bodySmall,
    marginTop: spacing.xs,
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.xl,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: '700',
    marginTop: spacing.md,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.text,
    fontSize: fontSizes.body,
    marginTop: spacing.xs,
  },
  error: {
    color: colors.danger,
    fontSize: fontSizes.bodySmall,
    marginTop: spacing.lg,
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 'auto',
    minHeight: 52,
  },
  logoutButtonPressed: {
    backgroundColor: '#FFF1F3',
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: fontSizes.body,
    fontWeight: '800',
  },
});
