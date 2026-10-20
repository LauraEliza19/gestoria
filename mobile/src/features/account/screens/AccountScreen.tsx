import { Ionicons } from '@expo/vector-icons';
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

import {
  SereneHeader,
  SereneSheet,
} from '@/components/serene/SereneLayout';
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
  const names = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (names.length === 0) {
    return 'GE';
  }

  if (names.length === 1) {
    return names[0].slice(0, 2).toUpperCase();
  }

  return `${names[0][0]}${
    names[names.length - 1][0]
  }`.toUpperCase();
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
    <SafeAreaView
      edges={['top']}
      style={styles.screen}
    >
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SereneHeader
          description="Confira a conta e a empresa conectadas neste aparelho."
          eyebrow="Conta"
          title="Seu acesso"
        />

        <SereneSheet style={styles.accountSheet}>
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
                <Ionicons
                  color={sereneColors.primary}
                  name="mail-outline"
                  size={18}
                />
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
                <Ionicons
                  color={sereneColors.primary}
                  name="shield-checkmark-outline"
                  size={18}
                />
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
                <Ionicons
                  color={sereneColors.primary}
                  name="business-outline"
                  size={18}
                />
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
                accessibilityRole="alert"
                style={styles.errorCard}
              >
                <View style={styles.errorDot} />

                <Text style={styles.errorText}>
                  {error}
                </Text>
              </View>
            ) : null}

            <Pressable
              accessibilityLabel="Sair da conta"
              accessibilityRole="button"
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
                <ActivityIndicator color="#C83E59" />
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
        </SereneSheet>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: sereneColors.background,
    flex: 1,
  },

  content: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 560,
    paddingBottom: 0,
    width: '100%',
  },

  accountSheet: {
    flex: 1,
    minHeight: 560,
    paddingBottom: 140,
    paddingTop: spacing.xl,
  },

  profileCard: {
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginTop: 0,
    padding: spacing.xl,
  },

  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },

  avatar: {
    alignItems: 'center',
    backgroundColor: '#EAF0FF',
    borderColor: '#D6E1FB',
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },

  avatarText: {
    color: sereneColors.primaryPressed,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },

  profileIdentity: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },

  name: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
  },

  organization: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    marginTop: spacing.xs,
  },

  roleBadge: {
    backgroundColor: '#EAF0FF',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },

  roleBadgeText: {
    color: sereneColors.primaryPressed,
    fontSize: 9,
    fontWeight: '800',
  },

  divider: {
    backgroundColor: sereneColors.sheetBorder,
    height: 1,
    marginVertical: spacing.xl,
  },

  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },

  detailIcon: {
    alignItems: 'center',
    backgroundColor: sereneColors.sheetPressed,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },

  detailContent: {
    flex: 1,
    marginLeft: spacing.md,
  },

  detailLabel: {
    color: sereneColors.sheetTextMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  detailValue: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    marginTop: spacing.xs,
  },

  detailDivider: {
    backgroundColor: sereneColors.sheetBorder,
    height: 1,
    marginVertical: spacing.lg,
  },

  securityCard: {
    alignItems: 'flex-start',
    backgroundColor: '#EAF8F1',
    borderColor: '#CBEADB',
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
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },

  securityDescription: {
    color: sereneColors.sheetTextMuted,
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
    backgroundColor: '#FFF1F3',
    borderColor: '#F3BBC5',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },

  errorDot: {
    backgroundColor: '#C83E59',
    borderRadius: radii.pill,
    height: 8,
    marginTop: 5,
    width: 8,
  },

  errorText: {
    color: '#C83E59',
    flex: 1,
    fontSize: fontSizes.caption,
    lineHeight: 18,
  },

  logoutButton: {
    alignItems: 'center',
    borderColor: '#C83E59',
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },

  logoutButtonPressed: {
    backgroundColor: '#FFF1F3',
  },

  logoutButtonDisabled: {
    opacity: 0.55,
  },

  logoutButtonText: {
    color: '#C83E59',
    fontSize: fontSizes.body,
    fontWeight: '800',
  },

  logoutHint: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});