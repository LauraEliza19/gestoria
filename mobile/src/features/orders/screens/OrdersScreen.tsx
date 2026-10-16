import { useCallback, useEffect, useMemo, useState } from 'react';
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

import type { Order, OrderStatus } from '../orderTypes';
import { orderStatusLabels } from '../orderTypes';
import { listOrders } from '../services/orderService';
import { colors, fontSizes, radii, spacing } from '@/theme/tokens';

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
    background: colors.primarySoft,
    text: colors.primaryDark,
  },
  completed: {
    background: '#EAF8F2',
    text: colors.success,
  },
  cancelled: {
    background: '#FFF1F3',
    text: colors.danger,
  },
};

type OrderFilter = 'all' | OrderStatus;

const filters: { label: string; value: OrderFilter }[] = [
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
  const [filter, setFilter] = useState<OrderFilter>('all');

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
      const matchesFilter = filter === 'all' || order.status === filter;
      const matchesQuery =
        normalizedQuery === '' ||
        normalizeSearch(order.id).includes(normalizedQuery) ||
        normalizeSearch(order.customer_name).includes(normalizedQuery) ||
        order.items.some((item) =>
          normalizeSearch(item.product_name).includes(normalizedQuery)
        );

      return matchesFilter && matchesQuery;
    });
  }, [filter, orders, query]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.stateTitle}>Carregando pedidos...</Text>
      </SafeAreaView>
    );
  }

  if (error && orders.length === 0) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <Text style={styles.stateTitle}>Não foi possível carregar</Text>
        <Text style={styles.stateDescription}>{error}</Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => void reload()}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
        >
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={visibleOrders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={[
          styles.content,
          visibleOrders.length === 0 && styles.emptyContent,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reload()}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>OPERAÇÃO</Text>
            <Text style={styles.title}>Pedidos</Text>
            <Text style={styles.description}>
              Acompanhe os pedidos registrados na sua empresa.
            </Text>

            <TextInput
              accessibilityLabel="Buscar pedidos"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={setQuery}
              placeholder="Cliente, pedido ou produto"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />

            <View
              accessibilityRole="radiogroup"
              style={styles.filterRow}
            >
              {filters.map((option) => {
                const selected = filter === option.value;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setFilter(option.value)}
                    style={({ pressed }) => [
                      styles.filterButton,
                      selected && styles.filterButtonSelected,
                      pressed && styles.filterButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        selected && styles.filterButtonTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? (
              <Text style={styles.warning} accessibilityRole="alert">
                {error} Os pedidos já exibidos foram mantidos.
              </Text>
            ) : null}

            <Text style={styles.count}>
              {visibleOrders.length}{' '}
              {visibleOrders.length === 1
                ? 'pedido encontrado'
                : 'pedidos encontrados'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.stateTitle}>Nenhum pedido encontrado</Text>
            <Text style={styles.stateDescription}>
              {orders.length === 0
                ? 'Os pedidos registrados no sistema aparecerão aqui.'
                : 'Nenhum pedido corresponde à busca e ao filtro selecionados.'}
            </Text>
          </View>
        }
        renderItem={({ item: order }) => {
          const statusStyle = statusColors[order.status];

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
                    { backgroundColor: statusStyle.background },
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

              {order.items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <Text style={styles.itemQuantity}>
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </Text>
                </View>
              ))}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(order.total_amount)}
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
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.md,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  emptyContent: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  header: {
    marginBottom: spacing.md,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: fontSizes.caption,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.display,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  description: {
    color: colors.textMuted,
    fontSize: fontSizes.body,
    lineHeight: 23,
    marginTop: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: fontSizes.body,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonPressed: {
    opacity: 0.75,
  },
  filterButtonText: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: '800',
  },
  filterButtonTextSelected: {
    color: colors.textOnDark,
  },
  count: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    marginTop: spacing.xl,
  },
  warning: {
    color: colors.warning,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
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
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },
  customerName: {
    color: colors.text,
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
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    marginTop: spacing.md,
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.lg,
  },
  itemRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  itemName: {
    color: colors.text,
    flex: 1,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  itemQuantity: {
    color: colors.textMuted,
    fontSize: fontSizes.bodySmall,
  },
  totalRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  totalLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.bodySmall,
    fontWeight: '700',
  },
  totalValue: {
    color: colors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  stateTitle: {
    color: colors.text,
    fontSize: fontSizes.subtitle,
    fontWeight: '800',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  stateDescription: {
    color: colors.textMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 21,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  retryButtonText: {
    color: colors.textOnDark,
    fontSize: fontSizes.body,
    fontWeight: '800',
  },
});
