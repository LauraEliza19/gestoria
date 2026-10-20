import { StatusBar } from 'expo-status-bar';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fontSizes,
  radii,
  sereneColors,
  spacing,
} from '@/theme/tokens';

import type { Order, OrderStatus } from '../orderTypes';
import { orderStatusLabels } from '../orderTypes';
import { listOrders } from '../services/orderService';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const statusColors: Record<
  OrderStatus,
  { background: string; text: string }
> = {
  in_preparation: {
    background: sereneColors.primarySoft,
    text: '#7FA4FF',
  },
  completed: {
    background: '#102A25',
    text: sereneColors.success,
  },
  cancelled: {
    background: '#331C24',
    text: sereneColors.danger,
  },
};

type OrderFilter = 'all' | OrderStatus;

const filters: {
  label: string;
  value: OrderFilter;
}[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Em preparo', value: 'in_preparation' },
  { label: 'Concluídos', value: 'completed' },
  { label: 'Cancelados', value: 'cancelled' },
];

function formatCurrency(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? currencyFormatter.format(parsed)
    : value;
}

function formatDate(value: string) {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? value
    : dateFormatter.format(parsed);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível carregar os pedidos.';
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] =
    useState<OrderFilter>('all');

  useEffect(() => {
    let active = true;

    void listOrders()
      .then((result) => {
        if (active) {
          setOrders(result);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setRefreshing(true);
    setError('');

    try {
      setOrders(await listOrders());
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  const visibleOrders = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    return orders.filter((order) => {
      const matchesFilter =
        filter === 'all' || order.status === filter;

      const matchesQuery =
        normalizedQuery === '' ||
        normalizeSearch(order.id).includes(
          normalizedQuery
        ) ||
        normalizeSearch(order.customer_name).includes(
          normalizedQuery
        ) ||
        order.items.some((item) =>
          normalizeSearch(item.product_name).includes(
            normalizedQuery
          )
        );

      return matchesFilter && matchesQuery;
    });
  }, [filter, orders, query]);

  if (loading) {
    return (
      <SafeAreaView
        style={styles.centered}
        edges={['top']}
      >
        <StatusBar style="light" />

        <ActivityIndicator
          size="large"
          color={sereneColors.primary}
        />

        <Text style={styles.stateTitle}>
          Carregando pedidos...
        </Text>

        <Text style={styles.stateDescription}>
          Consultando os registros mais recentes da empresa.
        </Text>
      </SafeAreaView>
    );
  }

  if (error && orders.length === 0) {
    return (
      <SafeAreaView
        style={styles.centered}
        edges={['top']}
      >
        <StatusBar style="light" />

        <View style={styles.errorAccent} />

        <Text style={styles.stateTitle}>
          Não foi possível carregar
        </Text>

        <Text style={styles.stateDescription}>
          {error}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => void reload()}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
        >
          <Text style={styles.retryButtonText}>
            Tentar novamente
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />

      <FlatList
        data={visibleOrders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={[
          styles.content,
          visibleOrders.length === 0 &&
            styles.emptyContent,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reload()}
            colors={[sereneColors.primary]}
            progressBackgroundColor={
              sereneColors.surface
            }
            tintColor={sereneColors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>
              OPERAÇÃO
            </Text>

            <Text style={styles.title}>
              Pedidos
            </Text>

            <Text style={styles.description}>
              Acompanhe os pedidos registrados na sua
              empresa.
            </Text>

            <TextInput
              accessibilityLabel="Buscar pedidos"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={setQuery}
              placeholder="Cliente, pedido ou produto"
              placeholderTextColor={
                sereneColors.textSubtle
              }
              returnKeyType="search"
              selectionColor={sereneColors.primary}
              style={styles.searchInput}
              value={query}
            />

            <View
              accessibilityRole="radiogroup"
              style={styles.filterRow}
            >
              {filters.map((option) => {
                const selected =
                  filter === option.value;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: selected,
                    }}
                    onPress={() =>
                      setFilter(option.value)
                    }
                    style={({ pressed }) => [
                      styles.filterButton,
                      selected &&
                        styles.filterButtonSelected,
                      pressed &&
                        styles.filterButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        selected &&
                          styles.filterButtonTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? (
              <View
                style={styles.warningCard}
                accessibilityRole="alert"
              >
                <View style={styles.warningDot} />

                <Text style={styles.warningText}>
                  {error} Os pedidos já exibidos foram
                  mantidos.
                </Text>
              </View>
            ) : null}

            <View style={styles.resultSummary}>
              <Text style={styles.count}>
                {visibleOrders.length}{' '}
                {visibleOrders.length === 1
                  ? 'pedido encontrado'
                  : 'pedidos encontrados'}
              </Text>

              <Text style={styles.refreshHint}>
                Puxe para atualizar
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>○</Text>
            </View>

            <Text style={styles.stateTitle}>
              Nenhum pedido encontrado
            </Text>

            <Text style={styles.stateDescription}>
              {orders.length === 0
                ? 'Os pedidos registrados no sistema aparecerão aqui.'
                : 'Nenhum pedido corresponde à busca e ao filtro selecionados.'}
            </Text>
          </View>
        }
        renderItem={({ item: order }) => {
          const statusStyle =
            statusColors[order.status];

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeading}>
                  <Text style={styles.orderCode}>
                    Pedido {order.id.slice(0, 8)}
                  </Text>

                  <Text style={styles.customerName}>
                    {order.customer_name}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        statusStyle.background,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: statusStyle.text },
                    ]}
                  >
                    {orderStatusLabels[order.status]}
                  </Text>
                </View>
              </View>

              <Text style={styles.createdAt}>
                Criado em {formatDate(order.created_at)}
              </Text>

              <View style={styles.divider} />

              <View style={styles.items}>
                {order.items.map((item) => (
                  <View
                    key={item.id}
                    style={styles.itemRow}
                  >
                    <Text style={styles.itemName}>
                      {item.product_name}
                    </Text>

                    <Text style={styles.itemQuantity}>
                      {item.quantity} ×{' '}
                      {formatCurrency(item.unit_price)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Total
                </Text>

                <Text style={styles.totalValue}>
                  {formatCurrency(
                    order.total_amount
                  )}
                </Text>
              </View>
            </View>
          );
        }}
      />
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
    gap: spacing.md,
    maxWidth: 560,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    width: '100%',
  },
  emptyContent: {
    flexGrow: 1,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: sereneColors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    marginBottom: spacing.md,
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
  searchInput: {
    backgroundColor: sereneColors.surfaceMuted,
    borderColor: sereneColors.borderStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: sereneColors.text,
    fontSize: fontSizes.bodySmall,
    marginTop: spacing.xl,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  filterButton: {
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterButtonSelected: {
    backgroundColor: sereneColors.primary,
    borderColor: sereneColors.primary,
  },
  filterButtonPressed: {
    opacity: 0.72,
  },
  filterButtonText: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: '700',
  },
  filterButtonTextSelected: {
    color: sereneColors.textOnPrimary,
  },
  warningCard: {
    alignItems: 'flex-start',
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
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
    color: sereneColors.textMuted,
    flex: 1,
    fontSize: fontSizes.caption,
    lineHeight: 18,
  },
  resultSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  count: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.caption,
  },
  refreshHint: {
    color: sereneColors.textSubtle,
    fontSize: 10,
  },
  card: {
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.xl,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  cardHeading: {
    flex: 1,
  },
  orderCode: {
    color: sereneColors.textSubtle,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },
  customerName: {
    color: sereneColors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  statusBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusText: {
    fontSize: fontSizes.caption,
    fontWeight: '800',
  },
  createdAt: {
    color: sereneColors.textSubtle,
    fontSize: fontSizes.caption,
    marginTop: spacing.md,
  },
  divider: {
    backgroundColor: sereneColors.border,
    height: 1,
    marginVertical: spacing.lg,
  },
  items: {
    gap: spacing.sm,
  },
  itemRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  itemName: {
    color: sereneColors.text,
    flex: 1,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
    lineHeight: 20,
  },
  itemQuantity: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.bodySmall,
    textAlign: 'right',
  },
  totalRow: {
    alignItems: 'center',
    borderTopColor: sereneColors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  totalLabel: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.bodySmall,
    fontWeight: '700',
  },
  totalValue: {
    color: sereneColors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  emptyIconText: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.title,
    fontWeight: '700',
  },
  errorAccent: {
    backgroundColor: sereneColors.danger,
    borderRadius: radii.pill,
    height: 3,
    marginBottom: spacing.md,
    width: 36,
  },
  stateTitle: {
    color: sereneColors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  stateDescription: {
    color: sereneColors.textMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 21,
    marginTop: spacing.sm,
    maxWidth: 340,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: sereneColors.primary,
    borderRadius: radii.md,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryButtonPressed: {
    backgroundColor: sereneColors.primaryPressed,
  },
  retryButtonText: {
    color: sereneColors.textOnPrimary,
    fontSize: fontSizes.body,
    fontWeight: '800',
  },
});