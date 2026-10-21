import { Ionicons } from '@expo/vector-icons';
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
  SereneHeader,
  SereneSheet,
} from '@/components/serene/SereneLayout';

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
    background: '#EAF0FF',
    text: sereneColors.primaryPressed,
  },
  completed: {
    background: '#E5F6EE',
    text: '#16815B',
  },
  cancelled: {
    background: '#FDECEF',
    text: '#C83E59',
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
              sereneColors.sheetSurface
            }
            tintColor={sereneColors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <SereneHeader
              description="Acompanhe os pedidos registrados na sua empresa."
              eyebrow="Operação"
              title="Pedidos"
            />

            <SereneSheet style={styles.ordersSheet}>
              <TextInput
                accessibilityLabel="Buscar pedidos"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                onChangeText={setQuery}
                placeholder="Cliente, pedido ou produto"
                placeholderTextColor={
                  sereneColors.sheetTextMuted
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
                  accessibilityRole="alert"
                  style={styles.warningCard}
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
            </SereneSheet>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons
                color={sereneColors.primary}
                name="receipt-outline"
                size={25}
              />
            </View>

            <Text style={styles.emptyTitle}>
              Nenhum pedido encontrado
            </Text>

            <Text style={styles.emptyDescription}>
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
    backgroundColor: sereneColors.sheet,
    maxWidth: 560,
    paddingBottom: 140,
    width: '100%',
  },
ordersSheet: {
    minHeight: 0,
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg,
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
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  title: {
    color: sereneColors.text,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
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
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  filterButton: {
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
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
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },

  filterButtonTextSelected: {
    color: sereneColors.textOnPrimary,
  },
  warningCard: {
    alignItems: 'flex-start',
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
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
    color: sereneColors.sheetTextMuted,
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
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
  },

  refreshHint: {
    color: sereneColors.sheetTextMuted,
    fontSize: 10,
  },
  card: {
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
    marginHorizontal: spacing.xl,
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
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },
  customerName: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  statusBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusText: {
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },
  createdAt: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    marginTop: spacing.md,
  },
  divider: {
    backgroundColor: sereneColors.sheetBorder,
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
    color: sereneColors.sheetText,
    flex: 1,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
    lineHeight: 20,
  },
  itemQuantity: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    textAlign: 'right',
  },
  totalRow: {
    alignItems: 'center',
    borderTopColor: sereneColors.sheetBorder,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  totalLabel: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  totalValue: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: sereneColors.primarySoft,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
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
    lineHeight: 21,
    marginTop: spacing.sm,
    maxWidth: 340,
    textAlign: 'center',
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
    fontWeight: '600',
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
    fontWeight: '600',
  },
});