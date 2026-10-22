import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

import {
  SereneHeader,
  SereneSheet,
} from '@/components/serene/SereneLayout';

import {
  fontSizes,
  radii,
  sereneColors,
  spacing,
} from '@/theme/tokens';

import type {
  DashboardAlert,
  DashboardAlertSeverity,
} from '../../home/dashboardTypes';
import { useExecutiveDashboard } from '../../home/useExecutiveDashboard';

const SEVERITY_COLORS: Record<
  DashboardAlertSeverity,
  string
> = {
  info: sereneColors.info,
  warning: sereneColors.warning,
  critical: sereneColors.danger,
};

const SEVERITY_LABELS: Record<
  DashboardAlertSeverity,
  string
> = {
  info: 'Acompanhar',
  warning: 'Atenção',
  critical: 'Prioridade',
};

function formatDate(value: string | null) {
  if (!value) {
    return 'Ocorrência atual';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Ocorrência atual';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

type AlertCardProps = {
  item: DashboardAlert;
  onOpen: () => void;
  wide: boolean;
};

function AlertCard({
  item,
  onOpen,
  wide,
}: AlertCardProps) {
  const color = SEVERITY_COLORS[item.severity];

  return (
    <View
      style={[
        styles.alertCard,
        wide && styles.alertCardWide,
      ]}
    >
      <View style={styles.alertHeader}>
        <View
          style={[
            styles.severityDot,
            { backgroundColor: color },
          ]}
        />

        <View style={styles.alertTitleArea}>
          <Text style={styles.alertTitle}>{item.title}</Text>
          <Text style={styles.alertMetadata}>
            {item.source} · {formatDate(item.occurred_at)}
          </Text>
        </View>

        <View
          style={[
            styles.severityBadge,
            { borderColor: color },
          ]}
        >
          <Text
            style={[
              styles.severityText,
              { color },
            ]}
          >
            {SEVERITY_LABELS[item.severity]}
          </Text>
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
        onPress={onOpen}
        style={({ pressed }) => [
          styles.actionButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.actionText}>
          {item.action_label}
        </Text>
        <Ionicons
          color={sereneColors.primary}
          name="chevron-forward"
          size={20}
        />
      </Pressable>
    </View>
  );
}

export function AlertsScreen() {
  const router = useRouter();
  const {
    contentMaxWidth,
    isCompact,
  } = useResponsiveLayout();
  const {
    overview,
    loading,
    refreshing,
    error,
    retry,
    refresh,
  } = useExecutiveDashboard();

  function openAlert(item: DashboardAlert) {
    if (item.action_route === '/orders') {
      router.push('/orders');
      return;
    }

    Alert.alert(
      item.title,
      'A tela deste módulo será integrada ao aplicativo nas próximas etapas.'
    );
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
            tintColor={sereneColors.primary}
            onRefresh={refresh}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <SereneHeader
          actions={
            overview ? (
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>
                  {overview.alerts.length}
                </Text>
              </View>
            ) : null
          }
          description="Veja o que aconteceu, entenda o impacto e abra o módulo responsável."
          eyebrow="Central de prioridades"
          title="Alertas"
        />

        <SereneSheet style={styles.alertsSheet}>

          {loading && !overview ? (
            <View style={styles.stateCard}>
              <ActivityIndicator
                color={sereneColors.primary}
                size="large"
              />
              <Text style={styles.stateTitle}>
                Organizando suas prioridades
              </Text>
              <Text style={styles.stateDescription}>
                Consultando os dados mais recentes da empresa.
              </Text>
            </View>
          ) : null}

          {error && !overview ? (
            <View style={styles.errorCard}>
              <View style={styles.errorAccent} />
              <Text style={styles.errorTitle}>
                Não foi possível carregar os alertas
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
                  <Text style={styles.warningText}>
                    A atualização falhou. Os últimos alertas
                    disponíveis continuam na tela.
                  </Text>
                </View>
              ) : null}

              {overview.alerts.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <Text style={styles.emptyIconText}>✓</Text>
                  </View>

                  <Text style={styles.emptyTitle}>
                    Nenhum alerta importante
                  </Text>

                  <Text style={styles.emptyDescription}>
                    Sua operação não possui pendências
                    prioritárias neste momento.
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.alertList,
                    !isCompact && styles.alertListWide,
                  ]}
                >
                  {overview.alerts.map((item) => (
                    <AlertCard
                      key={item.id}
                      item={item}
                      onOpen={() => openAlert(item)}
                      wide={!isCompact}
                    />
                  ))}
                </View>
              )}
            </>
          ) : null}
        </SereneSheet>
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
    width: '100%',
  },
  alertsSheet: {
    flexGrow: 1,
  },
  totalBadge: {
    alignItems: 'center',
    backgroundColor: sereneColors.primarySoft,
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 36,
    paddingHorizontal: spacing.sm,
  },
  totalBadgeText: {
    color: sereneColors.primary,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
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
  errorAccent: {
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
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  warningDot: {
    backgroundColor: sereneColors.warning,
    borderRadius: radii.pill,
    height: 8,
    marginTop: 5,
    width: 8,
  },
  warningText: {
    color: sereneColors.sheetTextMuted,
    flex: 1,
    fontSize: fontSizes.caption,
    lineHeight: 18,
  },
  alertList: {
    gap: 0,
  },
  alertListWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  alertCard: {
    borderBottomColor: sereneColors.sheetBorder,
    borderBottomWidth: 1,
    paddingVertical: spacing.xl,
  },
  alertCardWide: {
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 0,
    minWidth: 300,
    padding: spacing.xl,
  },
  alertHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  severityDot: {
    borderRadius: radii.pill,
    height: 9,
    width: 9,
  },
  alertTitleArea: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  alertTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  alertMetadata: {
    color: sereneColors.sheetTextMuted,
    fontSize: 10,
    marginTop: spacing.xs,
  },
  severityBadge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  severityText: {
    fontSize: 9,
    fontWeight: '600',
  },
  alertDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.lg,
  },
  impactBox: {
    backgroundColor: sereneColors.sheetPressed,
    borderRadius: radii.md,
    marginTop: spacing.md,
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
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  actionButton: {
    alignItems: 'center',
    borderTopColor: sereneColors.sheetBorder,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  actionText: {
    color: sereneColors.primary,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xxl,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: sereneColors.primarySoft,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  emptyIconText: {
    color: sereneColors.success,
    fontSize: fontSizes.title,
    fontWeight: '600',
  },
  emptyTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    marginTop: spacing.lg,
  },
  emptyDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
