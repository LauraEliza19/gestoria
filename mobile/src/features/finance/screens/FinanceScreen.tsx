import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { useAuth } from '@/features/auth/context/useAuth';
import {
  fontSizes,
  radii,
  sereneColors,
  spacing,
} from '@/theme/tokens';

import type {
  FinanceCategory,
  FinanceEntry,
  FinanceEntryStatus,
  FinanceEntryType,
} from '../financeTypes';
import { useFinance } from '../useFinance';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const TYPE_FILTERS: {
  label: string;
  value?: FinanceEntryType;
}[] = [
    { label: 'Todos' },
    { label: 'Entradas', value: 'income' },
    { label: 'Saídas', value: 'expense' },
  ];


const STATUS_FILTERS: {
  label: string;
  value?: FinanceEntryStatus;
}[] = [
    { label: 'Todos' },
    { label: 'Pagos', value: 'paid' },
    { label: 'Pendentes', value: 'pending' },
    { label: 'Cancelados', value: 'cancelled' },
  ];

const STATUS_LABELS: Record<FinanceEntryStatus, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<FinanceEntryStatus, string> = {
  paid: '#16815B',
  pending: '#9B6700',
  cancelled: '#C83E59',
};

function formatCurrency(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? currencyFormatter.format(parsed)
    : value;
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);

  return Number.isNaN(parsed.getTime())
    ? value
    : dateFormatter.format(parsed);
}

type FilterPillProps<T extends string> = {
  label: string;
  selected: boolean;
  value?: T;
  onSelect: (value?: T) => void;
};

function FilterPill<T extends string>({
  label,
  selected,
  value,
  onSelect,
}: FilterPillProps<T>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(value)}
      style={({ pressed }) => [
        styles.filterPill,
        selected && styles.filterPillSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.filterPillText,
          selected && styles.filterPillTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type EntryRowProps = {
  entry: FinanceEntry;
  category?: FinanceCategory;
  isLast: boolean;
};

function EntryRow({
  entry,
  category,
  isLast,
}: EntryRowProps) {
  const income = entry.entry_type === 'income';
  const statusColor = STATUS_COLORS[entry.status];

  return (
    <View style={[styles.entryRow, isLast && styles.entryRowLast]}>
      <View style={styles.entryIcon}>
        <Ionicons
          color={income ? sereneColors.success : sereneColors.danger}
          name={income ? 'arrow-down' : 'arrow-up'}
          size={18}
        />
      </View>

      <View style={styles.entryContent}>
        <Text numberOfLines={1} style={styles.entryDescription}>
          {entry.description}
        </Text>

        <Text numberOfLines={1} style={styles.entryMetadata}>
          {category?.name ?? 'Sem categoria'} ·{' '}
          {formatDate(entry.transaction_date)}
        </Text>
      </View>

      <View style={styles.entryValueArea}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={[
            styles.entryAmount,
            income ? styles.incomeText : styles.expenseText,
          ]}
        >
          {income ? '+' : '-'} {formatCurrency(entry.amount)}
        </Text>

        <View style={styles.statusLine}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: statusColor },
            ]}
          />

          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABELS[entry.status]}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function FinanceScreen() {
  const router = useRouter();
  const {
    pageWidth,
    horizontalGutter,
  } = useResponsiveLayout();
  const { session } = useAuth();
  const canManage =
    session?.role === 'owner' || session?.role === 'admin';
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);
  const {
    data,
    filters,
    loading,
    refreshing,
    error,
    selectType,
    selectStatus,
    retry,
    refresh,
  } = useFinance();

  const categories = new Map(
    data?.categories.map((category) => [category.id, category]) ?? []
  );
  const selectedStatusLabel =
    STATUS_FILTERS.find((option) => option.value === filters.status)?.label ??
    'Todos';

  function handleStatusSelect(value?: FinanceEntryStatus) {
    selectStatus(value);
    setStatusPickerVisible(false);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { width: pageWidth },
        ]}
        refreshControl={
          <RefreshControl
            colors={[sereneColors.primary]}
            progressBackgroundColor={sereneColors.sheetSurface}
            refreshing={refreshing}
            tintColor={sereneColors.primary}
            onRefresh={refresh}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <SereneHeader
          actions={
            canManage ? (
              <Pressable
                accessibilityLabel="Novo lançamento"
                accessibilityRole="button"
                onPress={() => router.push('/finance-entry')}
                style={({ pressed }) => [
                  styles.newEntryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  color={sereneColors.text}
                  name="add"
                  size={22}
                />
              </Pressable>
            ) : undefined
          }
          description="Entradas, saídas e saldo realizado para decisões mais tranquilas."
          eyebrow="Controle executivo"
          title="Financeiro"
        >
          {data ? (
            <View style={styles.balanceOverview}>
              <Text style={styles.balanceLabel}>Saldo realizado</Text>

              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                numberOfLines={1}
                style={styles.balanceValue}
              >
                {formatCurrency(data.summary.balance)}
              </Text>

              <View style={styles.balanceRail}>
                <View style={styles.balanceRailAccent} />
              </View>

              <View style={styles.balanceMetrics}>
                <View style={styles.balanceMetric}>
                  <View style={styles.metricLabelRow}>
                    <View
                      style={[
                        styles.metricDot,
                        styles.incomeDot,
                      ]}
                    />
                    <Text style={styles.balanceMetricLabel}>
                      Entradas
                    </Text>
                  </View>
                  <Text style={styles.balanceMetricValue}>
                    {formatCurrency(data.summary.total_income)}
                  </Text>
                </View>

                <View style={styles.balanceDivider} />

                <View style={styles.balanceMetric}>
                  <View style={styles.metricLabelRow}>
                    <View
                      style={[
                        styles.metricDot,
                        styles.expenseDot,
                      ]}
                    />
                    <Text style={styles.balanceMetricLabel}>
                      Saídas
                    </Text>
                  </View>
                  <Text style={styles.balanceMetricValue}>
                    {formatCurrency(data.summary.total_expense)}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </SereneHeader>

        <SereneSheet style={styles.financeSheet}>
          {loading && !data ? (
            <View style={styles.statePanel}>
              <ActivityIndicator color={sereneColors.primary} size="large" />
              <Text style={styles.stateTitle}>Organizando seus números</Text>
              <Text style={styles.stateDescription}>
                Consultando os lançamentos financeiros mais recentes.
              </Text>
            </View>
          ) : null}

          {error && !data ? (
            <View style={styles.errorPanel}>
              <View style={styles.errorAccent} />
              <Text style={styles.errorTitle}>
                Não foi possível carregar o financeiro
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
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : null}

          {data ? (
            <>
              {error ? (
                <View style={styles.updateWarning}>
                  <View style={styles.warningDot} />
                  <Text style={styles.warningText}>
                    A atualização falhou. Os últimos dados disponíveis
                    continuam na tela.
                  </Text>
                </View>
              ) : null}

              <View style={styles.entriesHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>MOVIMENTAÇÕES</Text>
                  <Text style={styles.sectionTitle}>Fluxo recente</Text>
                </View>

                <View style={styles.entryCountArea}>
                  {loading ? (
                    <ActivityIndicator
                      color={sereneColors.primary}
                      size="small"
                    />
                  ) : null}
                  <Text style={styles.entryCount}>
                    {data.entries.length}{' '}
                    {data.entries.length === 1 ? 'registro' : 'registros'}
                  </Text>
                </View>
              </View>

              <View style={styles.filtersBlock}>
                <Text style={styles.filterLabel}>Tipo</Text>
                <ScrollView
                  contentContainerStyle={styles.filterRow}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {TYPE_FILTERS.map((option) => (
                    <FilterPill
                      key={option.value ?? 'all'}
                      label={option.label}
                      onSelect={selectType}
                      selected={filters.entry_type === option.value}
                      value={option.value}
                    />
                  ))}
                </ScrollView>

                <Pressable
                  accessibilityHint="Abre as opções de situação financeira"
                  accessibilityRole="button"
                  onPress={() => setStatusPickerVisible(true)}
                  style={({ pressed }) => [
                    styles.statusSelector,
                    pressed && styles.pressed,
                  ]}
                >
                  <View>
                    <Text style={styles.statusSelectorLabel}>Situação</Text>
                    <Text style={styles.statusSelectorValue}>
                      {selectedStatusLabel}
                    </Text>
                  </View>

                  <View style={styles.statusSelectorIcon}>
                    <Ionicons
                      color={sereneColors.primary}
                      name="chevron-down"
                      size={17}
                    />
                  </View>
                </Pressable>
              </View>

              {data.entries.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      color={sereneColors.primary}
                      name="receipt-outline"
                      size={23}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>
                    Nenhum lançamento encontrado
                  </Text>
                  <Text style={styles.emptyDescription}>
                    Ajuste os filtros ou registre uma movimentação na
                    próxima etapa do Financeiro Mobile.
                  </Text>
                </View>
              ) : (
                <View style={styles.entryList}>
                  {data.entries.map((entry, index) => (
                    <EntryRow
                      category={categories.get(entry.category_id)}
                      entry={entry}
                      isLast={index === data.entries.length - 1}
                      key={entry.id}
                    />
                  ))}
                </View>
              )}
            </>
          ) : null}
        </SereneSheet>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setStatusPickerVisible(false)}
        transparent
        visible={statusPickerVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar seleção de situação"
            accessibilityRole="button"
            onPress={() => setStatusPickerVisible(false)}
            style={styles.modalBackdrop}
          />

          <View
            style={[
              styles.statusModal,
              {
                paddingHorizontal: horizontalGutter,
                width: pageWidth,
              },
            ]}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>FILTRO</Text>
                <Text style={styles.modalTitle}>Situação</Text>
              </View>

              <Pressable
                accessibilityLabel="Fechar"
                accessibilityRole="button"
                onPress={() => setStatusPickerVisible(false)}
                style={({ pressed }) => [
                  styles.modalClose,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  color={sereneColors.sheetTextMuted}
                  name="close"
                  size={20}
                />
              </Pressable>
            </View>

            <View style={styles.statusOptions}>
              {STATUS_FILTERS.map((option, index) => {
                const selected = filters.status === option.value;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.value ?? 'all'}
                    onPress={() => handleStatusSelect(option.value)}
                    style={({ pressed }) => [
                      styles.statusOption,
                      index === STATUS_FILTERS.length - 1 &&
                      styles.statusOptionLast,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        selected && styles.statusOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>

                    {selected ? (
                      <Ionicons
                        color={sereneColors.primary}
                        name="checkmark-circle"
                        size={21}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
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
    width: '100%',
  },
  balanceOverview: {
    marginTop: spacing.xxl,
  },
  newEntryButton: {
    alignItems: 'center',
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  balanceLabel: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  balanceValue: {
    color: sereneColors.text,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 34,
    marginTop: spacing.xs,
  },
  balanceRail: {
    backgroundColor: sereneColors.primary,
    borderRadius: radii.pill,
    height: 3,
    marginTop: spacing.md,
    overflow: 'hidden',
    width: 48,
  },
  balanceRailAccent: {
    alignSelf: 'flex-end',
    backgroundColor: sereneColors.brandCyan,
    height: 3,
    width: 14,
  },
  balanceMetrics: {
    alignItems: 'stretch',
    flexDirection: 'row',
    marginTop: spacing.xl,
  },
  balanceMetric: {
    flex: 1,
    minWidth: 0,
  },
  balanceDivider: {
    backgroundColor: sereneColors.border,
    marginHorizontal: spacing.lg,
    width: 1,
  },
  metricLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricDot: {
    borderRadius: radii.pill,
    height: 6,
    width: 6,
  },
  incomeDot: {
    backgroundColor: sereneColors.success,
  },
  expenseDot: {
    backgroundColor: sereneColors.danger,
  },
  balanceMetricLabel: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },
  balanceMetricValue: {
    color: sereneColors.text,
    fontSize: fontSizes.body,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  financeSheet: {
    flexGrow: 1,
    paddingBottom: 112,
  },
  statePanel: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxxl,
  },
  stateTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    marginTop: spacing.lg,
  },
  stateDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorPanel: {
    borderBottomColor: sereneColors.sheetBorder,
    borderBottomWidth: 1,
    paddingBottom: spacing.xl,
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
    borderRadius: radii.pill,
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
    borderBottomColor: sereneColors.sheetBorder,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
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
  entriesHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    color: sereneColors.primary,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  sectionTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.title,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  entryCountArea: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  entryCount: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },
  filtersBlock: {
    borderBottomColor: sereneColors.sheetBorder,
    borderBottomWidth: 1,
    paddingBottom: spacing.xl,
  },
  filterLabel: {
    color: sereneColors.sheetTextMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: spacing.lg,
    textTransform: 'uppercase',
  },
  filterRow: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  filterPill: {
    backgroundColor: 'transparent',
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterPillSelected: {
    backgroundColor: '#EAF1FF',
    borderColor: '#EAF1FF',
  },
  filterPillText: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },
  filterPillTextSelected: {
    color: sereneColors.primary,
  },
  statusSelector: {
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  statusSelectorLabel: {
    color: sereneColors.sheetTextMuted,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusSelectorValue: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
    marginTop: 3,
  },
  statusSelectorIcon: {
    alignItems: 'center',
    backgroundColor: '#EAF1FF',
    borderRadius: radii.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(4, 15, 33, 0.42)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  statusModal: {
    alignSelf: 'center',
    backgroundColor: sereneColors.sheetSurface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: sereneColors.sheetBorder,
    borderRadius: radii.pill,
    height: 4,
    width: 40,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    paddingTop: spacing.lg,
  },
  modalEyebrow: {
    color: sereneColors.primary,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  modalTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  modalClose: {
    alignItems: 'center',
    backgroundColor: '#F1F4F9',
    borderRadius: radii.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  statusOptions: {
    borderTopColor: sereneColors.sheetBorder,
    borderTopWidth: 1,
  },
  statusOption: {
    alignItems: 'center',
    borderBottomColor: sereneColors.sheetBorder,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
  },
  statusOptionLast: {
    borderBottomWidth: 0,
  },
  statusOptionText: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.body,
  },
  statusOptionTextSelected: {
    color: sereneColors.primary,
    fontWeight: '600',
  },
  entryList: {
    marginTop: spacing.sm,
  },
  entryRow: {
    alignItems: 'center',
    borderBottomColor: sereneColors.sheetBorder,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 82,
    paddingVertical: spacing.lg,
  },
  entryRowLast: {
    borderBottomWidth: 0,
  },
  entryIcon: {
    alignItems: 'center',
    backgroundColor: '#EDF2F8',
    borderRadius: radii.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  entryContent: {
    flex: 1,
    marginLeft: spacing.md,
    minWidth: 0,
  },
  entryDescription: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  entryMetadata: {
    color: sereneColors.sheetTextMuted,
    fontSize: 10,
    marginTop: spacing.xs,
  },
  entryValueArea: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
    maxWidth: 128,
  },
  entryAmount: {
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
    textAlign: 'right',
  },
  incomeText: {
    color: sereneColors.success,
  },
  expenseText: {
    color: sereneColors.danger,
  },
  statusLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: spacing.xs,
  },
  statusDot: {
    borderRadius: radii.pill,
    height: 5,
    width: 5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxxl,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#EAF1FF',
    borderRadius: radii.pill,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  emptyTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    marginTop: spacing.lg,
    textAlign: 'center',
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
