import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
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

import type {
  DashboardAlert as DashboardAlertItem,
  DashboardAlertSeverity,
  DashboardHealth,
} from '../dashboardTypes';
import { useExecutiveDashboard } from '../useExecutiveDashboard';

const SEVERITY_COLORS: Record<
  DashboardAlertSeverity,
  string
> = {
  info: sereneColors.info,
  warning: sereneColors.warning,
  critical: sereneColors.danger,
};

const EXECUTIVE_TITLES: Record<
  DashboardHealth,
  string
> = {
  healthy: 'Sua empresa está sob controle.',
  attention: 'Há pontos para acompanhar.',
  critical: 'Sua empresa precisa da sua atenção.',
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
    maximumFractionDigits: 2,
  }).format(parsedValue);
}

function formatUpdateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Atualizado agora';
  }

  return `Atualizado às ${new Intl.DateTimeFormat(
    'pt-BR',
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(date)}`;
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Bom dia';
  }

  if (hour < 18) {
    return 'Boa tarde';
  }

  return 'Boa noite';
}

type MetricProps = {
  label: string;
  value: string;
  bordered?: boolean;
};

function Metric({
  label,
  value,
  bordered = false,
}: MetricProps) {
  return (
    <View
      style={[
        styles.metric,
        bordered && styles.metricBordered,
      ]}
    >
      <Text style={styles.metricLabel}>
        {label}
      </Text>

      <Text
        style={styles.metricValue}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

type FocusCardProps = {
  item: DashboardAlertItem;
  onOpen: () => void;
};

function FocusCard({ item, onOpen }: FocusCardProps) {
  const color = SEVERITY_COLORS[item.severity];

  return (
    <View style={styles.focusCard}>
      <View style={styles.focusHeader}>
        <View
          style={[
            styles.focusDot,
            { backgroundColor: color },
          ]}
        />

        <Text style={styles.focusEyebrow}>
          EM FOCO AGORA
        </Text>
      </View>

      <Text style={styles.focusTitle}>
        {item.title}
      </Text>

      <Text style={styles.focusDescription}>
        {item.description}
      </Text>

      <Text style={styles.focusImpact}>
        {item.impact}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.action_label}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.focusAction,
          pressed && styles.sheetPressed,
        ]}
      >
        <Text style={styles.focusActionText}>
          {item.action_label}
        </Text>

        <Text style={styles.focusActionArrow}>
          ›
        </Text>
      </Pressable>
    </View>
  );
}

type PriorityItemProps = {
  item: DashboardAlertItem;
  expanded: boolean;
  isLast: boolean;
  onToggle: () => void;
  onOpen: () => void;
};

function PriorityItem({
  item,
  expanded,
  isLast,
  onToggle,
  onOpen,
}: PriorityItemProps) {
  const color = SEVERITY_COLORS[item.severity];

  return (
    <View
      style={[
        styles.priorityItem,
        isLast && styles.priorityItemLast,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Exibir detalhes de ${item.title}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.priorityHeader,
          pressed && styles.sheetPressed,
        ]}
      >
        <View
          style={[
            styles.priorityDot,
            { backgroundColor: color },
          ]}
        />

        <View style={styles.priorityTitleArea}>
          <Text style={styles.priorityTitle}>
            {item.title}
          </Text>

          <Text
            style={styles.priorityDescription}
            numberOfLines={1}
          >
            {item.description}
          </Text>
        </View>

        <Text style={styles.priorityCount}>
          {item.count}
        </Text>

        <Text style={styles.priorityChevron}>
          {expanded ? '⌃' : '›'}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={styles.priorityDetails}>
          <View style={styles.impactBox}>
            <Text style={styles.impactLabel}>
              IMPACTO
            </Text>

            <Text style={styles.impactText}>
              {item.impact}
            </Text>
          </View>

          <Text style={styles.prioritySource}>
            Origem: {item.source}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.action_label}
            onPress={onOpen}
            style={({ pressed }) => [
              styles.priorityAction,
              pressed && styles.sheetPressed,
            ]}
          >
            <Text style={styles.priorityActionText}>
              {item.action_label}
            </Text>

            <Text style={styles.priorityActionArrow}>
              ›
            </Text>
          </Pressable>
        </View>
      ) : null}
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

  const [expandedAlertId, setExpandedAlertId] =
    useState<string | null>(null);

  const firstName =
    session?.full_name.trim().split(/\s+/)[0] ||
    'Gestor';

  const focusAlert = overview?.alerts[0] ?? null;
  const priorityAlerts =
    overview?.alerts.slice(1, 4) ?? [];

  function openAlert(item: DashboardAlertItem) {
    if (item.action_route === '/orders') {
      router.push('/orders');
      return;
    }

    Alert.alert(
      item.title,
      'A tela deste módulo será integrada nas próximas etapas do aplicativo.'
    );
  }

  function openAllAlerts() {
    router.push('/alerts');
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[sereneColors.primary]}
            progressBackgroundColor={
              sereneColors.sheetSurface
            }
            refreshing={refreshing}
            tintColor={sereneColors.text}
            onRefresh={refresh}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.brandRow}>
            <Image
              accessibilityLabel="GestorIA"
              resizeMode="contain"
              source={require('@/assets/images/gestoria-logo.png')}
              style={styles.logo}
            />

            {overview ? (
              <View style={styles.onlineStatus}>
                <View style={styles.onlineDot} />

                <Text style={styles.onlineText}>
                  Operação online
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.introduction}>
            <Text style={styles.greeting}>
              {getGreeting()}, {firstName}
            </Text>

            <Text style={styles.title}>
              {overview
                ? EXECUTIVE_TITLES[overview.health]
                : 'Sua empresa em um só lugar.'}
            </Text>

            <Text style={styles.updateTime}>
              {overview
                ? formatUpdateTime(
                    overview.generated_at
                  )
                : 'Preparando sua visão executiva'}
            </Text>
          </View>

          {overview ? (
            <View style={styles.metricsPanel}>
              <View style={styles.metricsHeading}>
                <Text style={styles.metricsTitle}>
                  Hoje
                </Text>

                <View style={styles.brandRail}>
                  <View style={styles.brandRailCyan} />
                </View>
              </View>

              <View style={styles.metricsRow}>
                <Metric
                  label="Vendas"
                  value={formatCurrency(
                    overview.summary.sales_today
                  )}
                />

                <Metric
                  bordered
                  label="Em preparo"
                  value={String(
                    overview.summary
                      .orders_in_preparation
                  )}
                />

                <Metric
                  bordered
                  label="Estoque crítico"
                  value={String(
                    overview.summary
                      .critical_stock_items
                  )}
                />
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.sheet}>
          {loading && !overview ? (
            <View style={styles.stateCard}>
              <ActivityIndicator
                color={sereneColors.primary}
                size="large"
              />

              <Text style={styles.stateTitle}>
                Preparando sua visão executiva
              </Text>

              <Text style={styles.stateDescription}>
                Consultando os indicadores mais recentes da
                empresa.
              </Text>
            </View>
          ) : null}

          {error && !overview ? (
            <View style={styles.errorCard}>
              <View style={styles.errorIndicator} />

              <Text style={styles.errorTitle}>
                Não foi possível carregar os indicadores
              </Text>

              <Text style={styles.errorDescription}>
                {error}
              </Text>

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

          {overview ? (
            <>
              {error ? (
                <View style={styles.updateWarning}>
                  <View style={styles.warningDot} />

                  <View style={styles.warningContent}>
                    <Text style={styles.warningTitle}>
                      Não foi possível atualizar
                    </Text>

                    <Text style={styles.warningText}>
                      Os últimos dados disponíveis continuam
                      na tela.
                    </Text>
                  </View>
                </View>
              ) : null}

              <Text style={styles.sheetTitle}>
                Em foco agora
              </Text>

              {focusAlert ? (
                <FocusCard
                  item={focusAlert}
                  onOpen={() => openAlert(focusAlert)}
                />
              ) : (
                <View style={styles.emptyFocus}>
                  <View style={styles.emptyIcon}>
                    <Text style={styles.emptyIconText}>
                      ✓
                    </Text>
                  </View>

                  <View style={styles.emptyContent}>
                    <Text style={styles.emptyTitle}>
                      Tudo em ordem por aqui
                    </Text>

                    <Text style={styles.emptyDescription}>
                      Nenhuma pendência importante exige sua
                      atenção neste momento.
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.sectionHeading}>
                <Text style={styles.sheetTitle}>
                  Prioridades
                </Text>

                {overview.alerts.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ver todos os alertas"
                    onPress={openAllAlerts}
                    style={({ pressed }) => [
                      styles.seeAllButton,
                      pressed && styles.sheetPressed,
                    ]}
                  >
                    <Text style={styles.seeAllText}>
                      Ver todas
                    </Text>

                    <Text style={styles.seeAllArrow}>
                      ›
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {priorityAlerts.length > 0 ? (
                <View style={styles.priorityList}>
                  {priorityAlerts.map((item, index) => (
                    <PriorityItem
                      key={item.id}
                      expanded={
                        expandedAlertId === item.id
                      }
                      isLast={
                        index ===
                        priorityAlerts.length - 1
                      }
                      item={item}
                      onOpen={() => openAlert(item)}
                      onToggle={() =>
                        setExpandedAlertId((current) =>
                          current === item.id
                            ? null
                            : item.id
                        )
                      }
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.noMorePriorities}>
                  Nenhuma outra prioridade neste momento.
                </Text>
              )}
            </>
          ) : null}
        </View>
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
    paddingBottom: 104,
    width: '100%',
  },
  hero: {
    backgroundColor: sereneColors.background,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logo: {
    height: 38,
    width: 126,
  },
  onlineStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  onlineDot: {
    backgroundColor: sereneColors.success,
    borderRadius: radii.pill,
    height: 7,
    width: 7,
  },
  onlineText: {
    color: sereneColors.success,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },
  introduction: {
    marginTop: spacing.xl,
  },
  greeting: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.body,
    fontWeight: '500',
  },
  title: {
    color: sereneColors.text,
    fontSize: fontSizes.display,
    fontWeight: '800',
    letterSpacing: -0.9,
    lineHeight: 38,
    marginTop: spacing.sm,
    maxWidth: 410,
  },
  updateTime: {
    color: sereneColors.textSubtle,
    fontSize: fontSizes.bodySmall,
    marginTop: spacing.md,
  },
  metricsPanel: {
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginTop: spacing.xxl,
    overflow: 'hidden',
  },
  metricsHeading: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  metricsTitle: {
    color: sereneColors.text,
    fontSize: fontSizes.title,
    fontWeight: '800',
  },
  brandRail: {
    backgroundColor: sereneColors.primary,
    borderRadius: radii.pill,
    height: 3,
    marginTop: spacing.md,
    overflow: 'hidden',
    width: 42,
  },
  brandRailCyan: {
    alignSelf: 'flex-end',
    backgroundColor: sereneColors.brandCyan,
    height: 3,
    width: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xl,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.lg,
  },
  metricBordered: {
    borderLeftColor: sereneColors.border,
    borderLeftWidth: 1,
  },
  metricLabel: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: 16,
  },
  metricValue: {
    color: sereneColors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  sheet: {
    backgroundColor: sereneColors.sheet,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    flex: 1,
    minHeight: 520,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xxl,
  },
  stateTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '700',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  stateDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
  },
  errorIndicator: {
    backgroundColor: sereneColors.danger,
    borderRadius: radii.pill,
    height: 3,
    marginBottom: spacing.lg,
    width: 36,
  },
  errorTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
  },
  errorDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: sereneColors.primary,
    borderRadius: radii.md,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  retryButtonText: {
    color: sereneColors.textOnPrimary,
    fontSize: fontSizes.bodySmall,
    fontWeight: '700',
  },
  updateWarning: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E8',
    borderColor: '#F2D79A',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
    padding: spacing.md,
  },
  warningDot: {
    backgroundColor: sereneColors.warning,
    borderRadius: radii.pill,
    height: 8,
    marginTop: 5,
    width: 8,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    fontWeight: '700',
  },
  warningText: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  sheetTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.title,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  focusCard: {
    borderBottomColor: sereneColors.sheetBorder,
    borderBottomWidth: 1,
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  focusHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  focusDot: {
    borderRadius: radii.pill,
    height: 11,
    width: 11,
  },
  focusEyebrow: {
    color: sereneColors.sheetTextMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  focusTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
    lineHeight: 24,
    marginLeft: 23,
    marginTop: spacing.md,
  },
  focusDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 21,
    marginLeft: 23,
    marginTop: spacing.xs,
  },
  focusImpact: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginLeft: 23,
    marginTop: spacing.sm,
  },
  focusAction: {
    alignItems: 'center',
    borderTopColor: sereneColors.sheetBorder,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
  },
  focusActionText: {
    color: sereneColors.primary,
    fontSize: fontSizes.bodySmall,
    fontWeight: '700',
  },
  focusActionArrow: {
    color: sereneColors.primary,
    fontSize: fontSizes.title,
    lineHeight: 24,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    marginTop: spacing.xxl,
  },
  seeAllButton: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  seeAllText: {
    color: sereneColors.primary,
    fontSize: fontSizes.bodySmall,
    fontWeight: '700',
  },
  seeAllArrow: {
    color: sereneColors.primary,
    fontSize: fontSizes.subtitle,
  },
  priorityList: {
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  priorityItem: {
    borderBottomColor: sereneColors.sheetBorder,
    borderBottomWidth: 1,
  },
  priorityItemLast: {
    borderBottomWidth: 0,
  },
  priorityHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 76,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  priorityDot: {
    borderRadius: radii.pill,
    height: 9,
    width: 9,
  },
  priorityTitleArea: {
    flex: 1,
    marginLeft: spacing.md,
  },
  priorityTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    fontWeight: '700',
  },
  priorityDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    marginTop: spacing.xs,
  },
  priorityCount: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.body,
    fontWeight: '800',
    marginLeft: spacing.md,
  },
  priorityChevron: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.title,
    lineHeight: 24,
    marginLeft: spacing.md,
  },
  priorityDetails: {
    backgroundColor: '#EEF3FA',
    borderTopColor: sereneColors.sheetBorder,
    borderTopWidth: 1,
    padding: spacing.lg,
  },
  impactBox: {
    backgroundColor: sereneColors.sheetSurface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  impactLabel: {
    color: sereneColors.sheetTextMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  impactText: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  prioritySource: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    marginTop: spacing.md,
  },
  priorityAction: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  priorityActionText: {
    color: sereneColors.primary,
    fontSize: fontSizes.bodySmall,
    fontWeight: '700',
  },
  priorityActionArrow: {
    color: sereneColors.primary,
    fontSize: fontSizes.title,
    lineHeight: 24,
  },
  emptyFocus: {
    alignItems: 'center',
    borderBottomColor: sereneColors.sheetBorder,
    borderBottomWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#E5F6EF',
    borderRadius: radii.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  emptyIconText: {
    color: sereneColors.success,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
  },
  emptyContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  emptyTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.body,
    fontWeight: '800',
  },
  emptyDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  noMorePriorities: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.72,
  },
  sheetPressed: {
    backgroundColor: sereneColors.sheetPressed,
  },
});
