import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/context/useAuth';
import { colors, fontSizes, radii, spacing } from '@/theme/tokens';

import type {
  DashboardAlert as DashboardAlertItem,
  DashboardAlertSeverity,
  DashboardHealth,
} from '../dashboardTypes';
import { useExecutiveDashboard } from '../useExecutiveDashboard';

const HEALTH_CONTENT: Record<
  DashboardHealth,
  {
    label: string;
    description: string;
    color: string;
    backgroundColor: string;
  }
> = {
  healthy: {
    label: 'Tudo sob controle',
    description: 'Nenhuma situação importante exige sua atenção agora.',
    color: colors.success,
    backgroundColor: '#EAF8F2',
  },
  attention: {
    label: 'Sua empresa precisa de atenção',
    description: 'Existem situações que merecem acompanhamento.',
    color: colors.warning,
    backgroundColor: '#FFF7E8',
  },
  critical: {
    label: 'Existem pontos críticos',
    description: 'Algumas situações podem impactar a operação.',
    color: colors.danger,
    backgroundColor: '#FFF0F3',
  },
};

const SEVERITY_COLORS: Record<DashboardAlertSeverity, string> = {
  info: colors.primary,
  warning: colors.warning,
  critical: colors.danger,
};

function formatCurrency(value: string | null) {
  if (value === null) {
    return 'Indisponível';
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 'R$ 0,00';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(parsedValue);
}

function formatUpdateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Atualizado agora';
  }

  return `Atualizado às ${new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)}`;
}

type MetricCardProps = {
  label: string;
  value: string;
  description: string;
  accent: string;
};

function MetricCard({
  label,
  value,
  description,
  accent,
}: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <View
        style={[
          styles.metricAccent,
          { backgroundColor: accent },
        ]}
      />

      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDescription}>{description}</Text>
    </View>
  );
}

type AlertCardProps = {
  item: DashboardAlertItem;
  onPress: (item: DashboardAlertItem) => void;
};

function AlertCard({ item, onPress }: AlertCardProps) {
  const accent = SEVERITY_COLORS[item.severity];

  return (
    <View style={styles.alertCard}>
      <View
        style={[
          styles.alertAccent,
          { backgroundColor: accent },
        ]}
      />

      <View style={styles.alertHeader}>
        <View
          style={[
            styles.alertCount,
            { backgroundColor: accent },
          ]}
        >
          <Text style={styles.alertCountText}>{item.count}</Text>
        </View>

        <View style={styles.alertTitleArea}>
          <Text style={styles.alertTitle}>{item.title}</Text>
          <Text style={styles.alertSource}>{item.source}</Text>
        </View>
      </View>

      <Text style={styles.alertDescription}>
        {item.description}
      </Text>

      <View style={styles.impactBox}>
        <Text style={styles.impactLabel}>IMPACTO</Text>
        <Text style={styles.impactText}>{item.impact}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.action_label}
        onPress={() => onPress(item)}
        style={({ pressed }) => [
          styles.alertButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.alertButtonText}>
          {item.action_label}
        </Text>
        <Text style={styles.alertButtonArrow}>›</Text>
      </Pressable>
    </View>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const {
    overview,
    loading,
    refreshing,
    error,
    retry,
    refresh,
  } = useExecutiveDashboard();

  const firstName =
    session?.full_name.trim().split(/\s+/)[0] ?? 'gestor';
  const organizationName =
    session?.organization.name ?? 'Sua empresa';

  function openAlert(item: DashboardAlertItem) {
    if (item.action_route === '/orders') {
      router.push('/orders');
      return;
    }

    Alert.alert(
      item.title,
      'Este módulo será disponibilizado nas próximas etapas do aplicativo.'
    );
  }

  const healthContent = overview
    ? HEALTH_CONTENT[overview.health]
    : null;

  const summaryCards = overview
    ? [
        {
          label: 'Vendas hoje',
          value: formatCurrency(overview.summary.sales_today),
          description: 'Pedidos concluídos hoje',
          accent: colors.primary,
        },
        {
          label: 'Pedidos em andamento',
          value: String(
            overview.summary.orders_in_preparation
          ),
          description: 'Pedidos em preparação',
          accent: colors.primary,
        },
        {
          label: 'Produção bloqueada',
          value: String(overview.summary.blocked_recipes),
          description: 'Receitas sem insumos suficientes',
          accent:
            overview.summary.blocked_recipes > 0
              ? colors.danger
              : colors.success,
        },
        {
          label: 'Estoque crítico',
          value: String(
            overview.summary.critical_stock_items
          ),
          description: 'Produtos no limite de reposição',
          accent:
            overview.summary.critical_stock_items > 0
              ? colors.danger
              : colors.success,
        },
        {
          label: 'Situação fiscal',
          value: String(overview.summary.fiscal_attention),
          description: 'Documentos que exigem atenção',
          accent:
            overview.summary.fiscal_attention > 0
              ? colors.warning
              : colors.success,
        },
        {
          label: 'Saldo financeiro',
          value: overview.summary.financial_available
            ? formatCurrency(
                overview.summary.financial_balance
              )
            : 'Em breve',
          description: overview.summary.financial_available
            ? 'Saldo financeiro atual'
            : 'Integração financeira em desenvolvimento',
          accent: colors.navySoft,
        },
      ]
    : [];

  if (
    overview?.summary.management_available &&
    overview.summary.active_employees !== null
  ) {
    summaryCards.push({
      label: 'Funcionários ativos',
      value: String(overview.summary.active_employees),
      description: `${
        overview.summary.open_employee_records ?? 0
      } ocorrências abertas`,
      accent:
        (overview.summary.open_employee_records ?? 0) > 0
          ? colors.warning
          : colors.success,
    });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={refresh}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>G</Text>
          </View>

          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>VISÃO EXECUTIVA</Text>
            <Text style={styles.organization} numberOfLines={1}>
              {organizationName}
            </Text>
          </View>

          <View style={styles.protectedBadge}>
            <View style={styles.protectedDot} />
            <Text style={styles.protectedText}>Protegido</Text>
          </View>
        </View>

        <View style={styles.introduction}>
          <Text style={styles.greeting}>Olá, {firstName}.</Text>
          <Text style={styles.mainQuestion}>
            Minha empresa está bem?
          </Text>
          <Text style={styles.introductionText}>
            Confira agora os principais indicadores e situações
            que precisam da sua atenção.
          </Text>
        </View>

        {loading && !overview ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator
              color={colors.primary}
              size="large"
            />
            <Text style={styles.loadingTitle}>
              Preparando sua visão executiva
            </Text>
            <Text style={styles.loadingDescription}>
              Estamos consultando os dados mais recentes da
              empresa.
            </Text>
          </View>
        ) : null}

        {error && !overview ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>
              Não foi possível carregar os indicadores
            </Text>
            <Text style={styles.errorDescription}>{error}</Text>

            <Pressable
              accessibilityRole="button"
              onPress={retry}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.retryButtonText}>
                Tentar novamente
              </Text>
            </Pressable>
          </View>
        ) : null}

        {overview && healthContent ? (
          <>
            {error ? (
              <View style={styles.updateWarning}>
                <Text style={styles.updateWarningTitle}>
                  Não foi possível atualizar os dados
                </Text>
                <Text style={styles.updateWarningText}>
                  Os últimos indicadores disponíveis continuam
                  sendo exibidos.
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.healthCard,
                {
                  backgroundColor:
                    healthContent.backgroundColor,
                },
              ]}
            >
              <View style={styles.healthHeader}>
                <View
                  style={[
                    styles.healthIndicator,
                    {
                      backgroundColor: healthContent.color,
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.healthLabel,
                    { color: healthContent.color },
                  ]}
                >
                  {healthContent.label}
                </Text>
              </View>

              <Text style={styles.healthDescription}>
                {healthContent.description}
              </Text>

              <Text style={styles.updateTime}>
                {formatUpdateTime(overview.generated_at)}
              </Text>
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>
                  INDICADORES
                </Text>
                <Text style={styles.sectionTitle}>
                  Visão geral
                </Text>
              </View>

              <Text style={styles.pullHint}>
                Puxe para atualizar
              </Text>
            </View>

            <View style={styles.metricGrid}>
              {summaryCards.map((card) => (
                <MetricCard
                  key={card.label}
                  accent={card.accent}
                  description={card.description}
                  label={card.label}
                  value={card.value}
                />
              ))}
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>
                  PRIORIDADES
                </Text>
                <Text style={styles.sectionTitle}>
                  Precisa da sua atenção
                </Text>
              </View>

              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>
                  {overview.alerts.length}
                </Text>
              </View>
            </View>

            {overview.alerts.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Text style={styles.emptyIconText}>✓</Text>
                </View>

                <Text style={styles.emptyTitle}>
                  Nenhuma pendência importante
                </Text>
                <Text style={styles.emptyDescription}>
                  Sua operação não possui alertas prioritários
                  neste momento.
                </Text>
              </View>
            ) : (
              <View style={styles.alertList}>
                {overview.alerts.map((item) => (
                  <AlertCard
                    key={item.id}
                    item={item}
                    onPress={openAlert}
                  />
                ))}
              </View>
            )}
          </>
        ) : null}
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
    padding: spacing.lg,
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
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  brandMarkText: {
    color: colors.textOnDark,
    fontSize: fontSizes.title,
    fontWeight: '900',
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  organization: {
    color: colors.text,
    fontSize: fontSizes.body,
    fontWeight: '800',
    marginTop: 2,
  },
  protectedBadge: {
    alignItems: 'center',
    backgroundColor: '#EAF8F2',
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  protectedDot: {
    backgroundColor: colors.success,
    borderRadius: radii.pill,
    height: 6,
    width: 6,
  },
  protectedText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '800',
  },
  introduction: {
    marginBottom: spacing.xl,
  },
  greeting: {
    color: colors.textMuted,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  mainQuestion: {
    color: colors.text,
    fontSize: fontSizes.display,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 38,
    marginTop: spacing.xs,
  },
  introductionText: {
    color: colors.textMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.xxl,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  loadingDescription: {
    color: colors.textMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: '#FFF0F3',
    borderColor: '#F4BCC7',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
  },
  errorDescription: {
    color: colors.text,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.danger,
    borderRadius: radii.md,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  retryButtonText: {
    color: colors.textOnDark,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },
  updateWarning: {
    backgroundColor: '#FFF7E8',
    borderColor: '#F3D8A4',
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  updateWarningTitle: {
    color: colors.warning,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },
  updateWarningText: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  healthCard: {
    borderRadius: radii.xl,
    padding: spacing.xl,
  },
  healthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  healthIndicator: {
    borderRadius: radii.pill,
    height: 10,
    width: 10,
  },
  healthLabel: {
    fontSize: fontSizes.subtitle,
    fontWeight: '900',
  },
  healthDescription: {
    color: colors.text,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  updateTime: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xxl,
  },
  sectionEyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.title,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  pullHint: {
    color: colors.textMuted,
    fontSize: 10,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 150,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  metricAccent: {
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  metricValue: {
    color: colors.text,
    fontSize: fontSizes.title,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  metricDescription: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  totalBadge: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 30,
    paddingHorizontal: spacing.sm,
  },
  totalBadgeText: {
    color: colors.primary,
    fontSize: fontSizes.bodySmall,
    fontWeight: '900',
  },
  alertList: {
    gap: spacing.md,
  },
  alertCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.lg,
    paddingLeft: spacing.xl,
  },
  alertAccent: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 5,
  },
  alertHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  alertCount: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 36,
    justifyContent: 'center',
    minWidth: 36,
    paddingHorizontal: spacing.sm,
  },
  alertCountText: {
    color: colors.textOnDark,
    fontSize: fontSizes.bodySmall,
    fontWeight: '900',
  },
  alertTitleArea: {
    flex: 1,
  },
  alertTitle: {
    color: colors.text,
    fontSize: fontSizes.body,
    fontWeight: '900',
  },
  alertSource: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    marginTop: 2,
  },
  alertDescription: {
    color: colors.text,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.lg,
  },
  impactBox: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  impactLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  impactText: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  alertButton: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  alertButtonText: {
    color: colors.primary,
    fontSize: fontSizes.bodySmall,
    fontWeight: '800',
  },
  alertButtonArrow: {
    color: colors.primary,
    fontSize: fontSizes.title,
    lineHeight: 24,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xxl,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#EAF8F2',
    borderRadius: radii.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  emptyIconText: {
    color: colors.success,
    fontSize: fontSizes.title,
    fontWeight: '900',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '900',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptyDescription: {
    color: colors.textMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});