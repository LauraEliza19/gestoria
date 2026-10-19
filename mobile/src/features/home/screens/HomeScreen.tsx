import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/context/useAuth';
import { colors, fontSizes, radii, spacing } from '@/theme/tokens';

const modules = [
  {
    name: 'Pedidos',
    description: 'Acompanhe vendas e o andamento dos pedidos.',
    accent: colors.primary,
  },
  {
    name: 'Produção',
    description: 'Consulte a fila de preparo e a disponibilidade.',
    accent: colors.success,
  },
  {
    name: 'Fiscal',
    description: 'Visualize documentos e situações fiscais.',
    accent: colors.warning,
  },
  {
    name: 'Gestão',
    description: 'Acesse pessoas, registros e centros de custo.',
    accent: colors.navySoft,
  },
] as const;

export function HomeScreen() {
  const { session } = useAuth();
  const firstName = session?.full_name.trim().split(/\s+/)[0] ?? 'usuário';
  const organizationName = session?.organization.name ?? 'Sua empresa';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandMark} accessibilityElementsHidden>
            <Text style={styles.brandMarkText}>G</Text>
          </View>

          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>GESTORIA MOBILE</Text>
            <Text style={styles.organization} numberOfLines={1}>
              {organizationName}
            </Text>
          </View>
        </View>

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeLabel}>VISÃO GERAL</Text>
          <Text style={styles.title}>Olá, {firstName}.</Text>
          <Text style={styles.description}>
            Sua conta está conectada. A partir daqui, vamos trazer os módulos
            essenciais do GestorIA para o celular.
          </Text>

          <View style={styles.sessionBadge}>
            <View style={styles.sessionDot} />
            <Text style={styles.sessionBadgeText}>Sessão protegida ativa</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Módulos</Text>
          <Text style={styles.sectionHint}>Estrutura inicial</Text>
        </View>

        <View style={styles.moduleGrid}>
          {modules.map((module) => (
            <View key={module.name} style={styles.moduleCard}>
              <View style={[styles.moduleAccent, { backgroundColor: module.accent }]} />
              <Text style={styles.moduleName}>{module.name}</Text>
              <Text style={styles.moduleDescription}>{module.description}</Text>
              <Text style={styles.moduleStatus}>Próxima etapa</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  brandMarkText: {
    color: colors.textOnDark,
    fontSize: fontSizes.title,
    fontWeight: '800',
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: fontSizes.caption,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  organization: {
    color: colors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  welcomeCard: {
    backgroundColor: colors.navy,
    borderRadius: radii.xl,
    padding: spacing.xl,
  },
  welcomeLabel: {
    color: '#9FB5FF',
    fontSize: fontSizes.caption,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.textOnDark,
    fontSize: fontSizes.display,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  description: {
    color: '#CCD5EE',
    fontSize: fontSizes.body,
    lineHeight: 24,
    marginTop: spacing.sm,
  },
  sessionBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.navySoft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sessionDot: {
    backgroundColor: '#59D7A5',
    borderRadius: radii.pill,
    height: 8,
    width: 8,
  },
  sessionBadgeText: {
    color: colors.textOnDark,
    fontSize: fontSizes.caption,
    fontWeight: '700',
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xxl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.title,
    fontWeight: '800',
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
  },
  moduleGrid: {
    gap: spacing.md,
  },
  moduleCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.lg,
    paddingLeft: spacing.xl,
  },
  moduleAccent: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 5,
  },
  moduleName: {
    color: colors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
  },
  moduleDescription: {
    color: colors.textMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  moduleStatus: {
    color: colors.primary,
    fontSize: fontSizes.caption,
    fontWeight: '800',
    marginTop: spacing.md,
    textTransform: 'uppercase',
  },
});
