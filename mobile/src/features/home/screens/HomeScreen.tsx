import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ComponentProps, useState } from 'react';
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
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

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

type IoniconName = ComponentProps<
  typeof Ionicons
>['name'];

function getPriorityIcon(
  module: DashboardAlertItem['module']
): IoniconName {
  switch (module) {
    case 'orders':
      return 'receipt-outline';

    case 'quotes':
      return 'document-text-outline';

    case 'products':
      return 'cube-outline';

    case 'production':
      return 'construct-outline';

    case 'fiscal':
      return 'reader-outline';

    case 'management':
      return 'people-outline';

    case 'financial':
      return 'wallet-outline';
  }
}

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
      <Text
        numberOfLines={2}
        style={styles.metricLabel}
      >
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
      <Pressable
        accessibilityHint={item.impact}
        accessibilityLabel={`Abrir ${item.title}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [
          styles.focusSummary,
          pressed && styles.sheetPressed,
        ]}
      >
        <View
          style={[
            styles.focusDot,
            { backgroundColor: color },
          ]}
        />

        <View style={styles.focusContent}>
          <Text style={styles.focusTitle}>
            {item.title}
          </Text>

          <Text style={styles.focusDescription}>
            {item.description}
          </Text>
        </View>

        <Ionicons
          color={sereneColors.sheetTextMuted}
          name="chevron-forward"
          size={22}
        />
      </Pressable>

      <Pressable
        accessibilityLabel={item.action_label}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [
          styles.focusAction,
          pressed && styles.sheetPressed,
        ]}
      >
        <Text style={styles.focusActionText}>
          {item.action_label}
        </Text>

        <Ionicons
          color={sereneColors.primary}
          name="chevron-forward"
          size={21}
        />
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
  const iconName = getPriorityIcon(item.module);

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

        <View style={styles.priorityIconContainer}>
          <Ionicons
            color={sereneColors.sheetText}
            name={iconName}
            size={24}
          />
        </View>

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

        <Ionicons
          color={sereneColors.sheetTextMuted}
          name={
            expanded
              ? 'chevron-up'
              : 'chevron-forward'
          }
          size={21}
          style={styles.priorityChevron}
        />
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

            <Ionicons
              color={sereneColors.primary}
              name="chevron-forward"
              size={20}
            />
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
    contentMaxWidth,
    horizontalGutter,
  } = useResponsiveLayout();

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

    if (item.action_route === '/products') {
      router.push('/products');
      return;
    }

    Alert.alert(
      item.title,
      'A tela deste módulo será integrada nas próximas etapas do aplicativo.'
    );
  }

  function openGlobalSearch() {
    Alert.alert(
      'Busca geral',
      'A busca entre os módulos será integrada na próxima etapa.'
    );
  }

  function openAllAlerts() {
    router.push('/alerts');
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: contentMaxWidth },
        ]}
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
        <View
          style={[
            styles.hero,
            { paddingHorizontal: horizontalGutter },
          ]}
        >
          <View
            pointerEvents="none"
            style={styles.heroDecoration}
          >
            <View style={styles.heroTopGlow} />
            <View style={styles.heroDecorationRing} />
            <View style={styles.heroDecorationCore} />
          </View>

          <View style={styles.brandRow}>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="Abrir busca geral"
                accessibilityRole="button"
                onPress={openGlobalSearch}
                style={({ pressed }) => [
                  styles.headerButton,
                  pressed && styles.headerButtonPressed,
                ]}
              >
                <Ionicons
                  color={sereneColors.text}
                  name="search-outline"
                  size={25}
                />
              </Pressable>

              <Pressable
                accessibilityLabel="Abrir central de alertas"
                accessibilityRole="button"
                onPress={openAllAlerts}
                style={({ pressed }) => [
                  styles.headerButton,
                  pressed && styles.headerButtonPressed,
                ]}
              >
                <Ionicons
                  color={sereneColors.text}
                  name="notifications-outline"
                  size={25}
                />

                {overview && overview.alerts.length > 0 ? (
                  <View style={styles.notificationBadge} />
                ) : null}
              </Pressable>
            </View>
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

            <View style={styles.statusRow}>
              <Text style={styles.updateTime}>
                {overview
                  ? formatUpdateTime(overview.generated_at)
                  : 'Preparando sua visão executiva'}
              </Text>

              {overview ? (
                <View style={styles.onlineStatus}>
                  <View style={styles.onlineDot} />

                  <Text style={styles.onlineText}>
                    Operação online
                  </Text>
                </View>
              ) : null}
            </View>
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

        <View
          style={[
            styles.sheet,
            { paddingHorizontal: horizontalGutter },
          ]}
        >
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
    </SafeAreaView >
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
    width: '100%',
  },
  hero: {
    backgroundColor: sereneColors.background,
    overflow: 'hidden',
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
    position: 'relative',
  },
  heroDecoration: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heroTopGlow: {
    backgroundColor: 'rgba(40, 103, 232, 0.08)',
    borderRadius: 190,
    height: 320,
    left: -100,
    position: 'absolute',
    top: -220,
    width: 380,
  },

  heroDecorationRing: {
    borderColor: 'rgba(40, 103, 232, 0.14)',
    borderRadius: 155,
    borderWidth: 38,
    height: 310,
    position: 'absolute',
    right: -160,
    top: 86,
    width: 310,
  },

  heroDecorationCore: {
    backgroundColor: 'rgba(23, 174, 230, 0.04)',
    borderRadius: 100,
    height: 200,
    position: 'absolute',
    right: -92,
    top: 141,
    width: 200,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 1,
  },

  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },

  headerButton: {
    alignItems: 'center',
    backgroundColor: sereneColors.surfaceMuted,
    borderColor: sereneColors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    position: 'relative',
    width: 50,
  },

  headerButtonPressed: {
    backgroundColor: sereneColors.surfaceElevated,
    transform: [{ scale: 0.96 }],
  },

  notificationBadge: {
    backgroundColor: sereneColors.danger,
    borderColor: sereneColors.surfaceMuted,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 9,
    position: 'absolute',
    right: 10,
    top: 9,
    width: 9,
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
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  introduction: {
    marginTop: spacing.xl,
    zIndex: 1,

  },
  greeting: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.body,
    fontWeight: '500',
  },
  title: {
    color: sereneColors.text,
    fontSize: fontSizes.display,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 36,
    marginTop: spacing.sm,
    maxWidth: 410,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  updateTime: {
    color: sereneColors.textSubtle,
    fontSize: fontSizes.bodySmall,
  },
  metricsPanel: {
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginTop: spacing.xxl,
    overflow: 'hidden',
    zIndex: 1,
  },
  metricsHeading: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  metricsTitle: {
    color: sereneColors.text,
    fontSize: fontSizes.title,
    fontWeight: '600',
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
    minHeight: 32,
  },
  metricValue: {
    color: sereneColors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  sheet: {
    backgroundColor: sereneColors.sheet,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    flex: 1,
    minHeight: 520,
    paddingBottom: 116,
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  focusCard: {
    borderBottomColor: sereneColors.sheetBorder,
    borderBottomWidth: 1,
    marginTop: spacing.lg,
    paddingBottom: spacing.lg,
  },

  focusSummary: {
    alignItems: 'center',
    borderRadius: radii.md,
    flexDirection: 'row',
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },

  focusDot: {
    borderRadius: radii.pill,
    height: 12,
    marginRight: spacing.lg,
    width: 12,
  },

  focusContent: {
    flex: 1,
    minWidth: 0,
  },

  focusTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    lineHeight: 24,
  },

  focusDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.xs,
  },

  focusAction: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderTopColor: sereneColors.sheetBorder,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
  },

  focusActionText: {
    color: sereneColors.primary,
    fontSize: fontSizes.body,
    fontWeight: '600',
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
    fontWeight: '600',
  },
  seeAllArrow: {
    color: sereneColors.primary,
    fontSize: fontSizes.subtitle,
  },
  priorityList: {
    backgroundColor: 'transparent',
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
    borderRadius: radii.md,
    flexDirection: 'row',
    minHeight: 90,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
  },
  priorityDot: {
    borderRadius: radii.pill,
    height: 9,
    width: 9,
  },
  priorityIconContainer: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    marginLeft: spacing.md,
    width: 38,
  },
  priorityTitleArea: {
    flex: 1,
    marginLeft: spacing.md,
    minWidth: 0,
  },
  priorityTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.body,
    fontWeight: '600',
    lineHeight: 21,
  },
  priorityDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  priorityCount: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    marginLeft: spacing.md,
  },
  priorityChevron: {
    marginLeft: spacing.md,
  },
  priorityDetails: {
    backgroundColor: sereneColors.sheetPressed,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.sm,
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
  },
  emptyContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  emptyTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.body,
    fontWeight: '600',
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
