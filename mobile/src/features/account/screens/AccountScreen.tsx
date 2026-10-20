import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/context/useAuth';
import {
  fontSizes,
  radii,
  sereneColors,
  spacing,
} from '@/theme/tokens';

const roleLabels = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
} as const;

function getInitials(fullName: string) {
  const names = fullName.trim().split(/\s+/).filter(Boolean);

  if (names.length === 0) {
    return 'GE';
  }

  if (names.length === 1) {
    return names[0].slice(0, 2).toUpperCase();
  }

  return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
}

export function AccountScreen() {
  const {
    session,
    status,
    error,
    signOut,
  } = useAuth();

  const isLoading = status === 'loading';
  const fullName = session?.full_name ?? 'Usuário';
  const organizationName =
    session?.organization.name ?? 'Sua empresa';

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      return;
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>CONTA</Text>
        <Text style={styles.title}>Seu acesso</Text>

        <Text style={styles.description}>
          Confira a conta e a empresa conectadas neste
          aparelho.
        </Text>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(fullName)}
              </Text>
            </View>

            <View style={styles.profileIdentity}>
              <Text style={styles.name}>
                {fullName}
              </Text>

              <Text style={styles.organization}>
                {organizationName}
              </Text>
            </View>

            {session ? (
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>
                  {roleLabels[session.role]}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Text style={styles.detailIconText}>@</Text>
            </View>

            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>
                E-mail
              </Text>
              <Text style={styles.detailValue}>
                {session?.email ?? '—'}
              </Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Text style={styles.detailIconText}>◇</Text>
            </View>

            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>
                Perfil de acesso
              </Text>
              <Text style={styles.detailValue}>
                {session
                  ? roleLabels[session.role]
                  : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Text style={styles.detailIconText}>⌂</Text>
            </View>

            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>
                Empresa
              </Text>
              <Text style={styles.detailValue}>
                {organizationName}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.securityCard}>
          <View style={styles.securityIndicator} />

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>
              Sessão protegida
            </Text>

            <Text style={styles.securityDescription}>
              Seu acesso está vinculado à empresa e ao seu
              perfil de permissões.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          {error ? (
            <View
              style={styles.errorCard}
              accessibilityRole="alert"
            >
              <View style={styles.errorDot} />
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sair da conta"
            disabled={isLoading}
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed &&
                !isLoading &&
                styles.logoutButtonPressed,
              isLoading &&
                styles.logoutButtonDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator
                color={sereneColors.danger}
              />
            ) : (
              <Text style={styles.logoutButtonText}>
                Sair da conta
              </Text>
            )}
          </Pressable>

          <Text style={styles.logoutHint}>
            Você precisará informar suas credenciais para
            entrar novamente.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: sereneColors.background,
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 560,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    width: '100%',
  },
  eyebrow: {
    color: sereneColors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: sereneColors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: spacing.xs,
  },
  description: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 21,
    marginTop: spacing.md,
    maxWidth: 390,
  },
  profileCard: {
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginTop: spacing.xxl,
    padding: spacing.xl,
  },
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: sereneColors.primarySoft,
    borderColor: sereneColors.primary,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: '#7FA4FF',
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },
  profileIdentity: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  name: {
    color: sereneColors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
  },
  organization: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.caption,
    marginTop: spacing.xs,
  },
  roleBadge: {
    backgroundColor: sereneColors.primarySoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  roleBadgeText: {
    color: '#7FA4FF',
    fontSize: 9,
    fontWeight: '800',
  },
  divider: {
    backgroundColor: sereneColors.border,
    height: 1,
    marginVertical: spacing.xl,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  detailIcon: {
    alignItems: 'center',
    backgroundColor: sereneColors.surfaceMuted,
    borderColor: sereneColors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  detailIconText: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.bodySmall,
    fontWeight: '700',
  },
  detailContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  detailLabel: {
    color: sereneColors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: sereneColors.text,
    fontSize: fontSizes.bodySmall,
    marginTop: spacing.xs,
  },
  detailDivider: {
    backgroundColor: sereneColors.border,
    height: 1,
    marginVertical: spacing.lg,
  },
  securityCard: {
    alignItems: 'flex-start',
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  securityIndicator: {
    backgroundColor: sereneColors.success,
    borderRadius: radii.pill,
    height: 9,
    marginTop: 4,
    width: 9,
  },
  securityContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  securityTitle: {
    color: sereneColors.text,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },
  securityDescription: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: spacing.xxxl,
  },
  errorCard: {
    alignItems: 'flex-start',
    backgroundColor: '#2A171D',
    borderColor: '#61303B',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  errorDot: {
    backgroundColor: sereneColors.danger,
    borderRadius: radii.pill,
    height: 8,
    marginTop: 5,
    width: 8,
  },
  errorText: {
    color: sereneColors.danger,
    flex: 1,
    fontSize: fontSizes.caption,
    lineHeight: 18,
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: sereneColors.danger,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  logoutButtonPressed: {
    backgroundColor: '#2A171D',
  },
  logoutButtonDisabled: {
    opacity: 0.55,
  },
  logoutButtonText: {
    color: sereneColors.danger,
    fontSize: fontSizes.body,
    fontWeight: '800',
  },
  logoutHint: {
    color: sereneColors.textSubtle,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});