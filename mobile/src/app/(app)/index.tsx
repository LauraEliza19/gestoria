import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/context/useAuth';
import { colors, fontSizes, radii, spacing } from '@/theme/tokens';

export default function HomeRoute() {
  const {
    session,
    status,
    error,
    signOut,
  } = useAuth();

  const firstName =
    session?.full_name.trim().split(/\s+/)[0] ?? 'usuário';

  const organizationName =
    session?.organization.name ?? 'Sua empresa';

  const isLoading = status === 'loading';

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      return;
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>GESTORIA MOBILE</Text>
        <Text style={styles.title}>Olá, {firstName}.</Text>
        <Text style={styles.description}>
          {organizationName}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Sessão protegida ativa
        </Text>

        <Text style={styles.cardDescription}>
          O aplicativo reconheceu sua conta e sua organização.
          Os módulos serão adicionados a partir desta estrutura.
        </Text>

        {session ? (
          <View style={styles.details}>
            <Text style={styles.detailLabel}>E-mail</Text>
            <Text style={styles.detailValue}>{session.email}</Text>

            <Text style={styles.detailLabel}>Papel</Text>
            <Text style={styles.detailValue}>{session.role}</Text>
          </View>
        ) : null}
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
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.logoutButtonText}>Sair da conta</Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: fontSizes.caption,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.display,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  description: {
    color: colors.textMuted,
    fontSize: fontSizes.body,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '700',
  },
  cardDescription: {
    color: colors.textMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  details: {
    gap: spacing.xs,
    marginTop: spacing.xl,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  detailValue: {
    color: colors.text,
    fontSize: fontSizes.body,
  },
  error: {
    color: colors.danger,
    fontSize: fontSizes.bodySmall,
    marginTop: spacing.lg,
  },
  logoutButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    marginTop: 'auto',
  },
  logoutButtonPressed: {
    backgroundColor: colors.primarySoft,
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutButtonText: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: '700',
  },
});