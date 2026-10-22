import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
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
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  fontSizes,
  radii,
  sereneColors,
  spacing,
} from '@/theme/tokens';

import {
  productCategoryLabels,
  productTypeLabels,
  productUnitLabels,
  type Product,
  type ProductStatus,
} from '../productTypes';
import { useProducts } from '../useProducts';

type ProductFilter =
  | 'all'
  | 'critical'
  | 'available'
  | 'inactive';

const FILTERS: {
  label: string;
  value: ProductFilter;
}[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Estoque crítico', value: 'critical' },
    { label: 'Disponíveis', value: 'available' },
    { label: 'Inativos', value: 'inactive' },
  ];

const STATUS_COLORS: Record<
  ProductStatus,
  { background: string; text: string }
> = {
  Disponível: {
    background: '#E5F6EE',
    text: '#16815B',
  },
  'Estoque baixo': {
    background: '#FFF5D8',
    text: '#9A6700',
  },
  Esgotado: {
    background: '#FFF1F3',
    text: '#C83E59',
  },
  Inativo: {
    background: '#EEF1F5',
    text: '#667085',
  },
};

function decimal(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCritical(product: Product) {
  return (
    product.is_active &&
    decimal(product.stock_quantity) <=
    decimal(product.min_stock_quantity)
  );
}

function formatCurrency(value: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(decimal(value));
}

function formatQuantity(value: string) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 3,
  }).format(decimal(value));
}

type ProductCardProps = {
  product: Product;
  width: number;
  onPress: () => void;
};

function ProductCard({
  product,
  width,
  onPress,
}: ProductCardProps) {
  const statusColors = STATUS_COLORS[product.status];

  return (
    <Pressable
      accessibilityHint="Abre os dados para edição"
      accessibilityLabel={`Editar ${product.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.productCard,
        { width },
        pressed && styles.productCardPressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeading}>
          <Text style={styles.category}>
            {productCategoryLabels[product.category]}
          </Text>

          <Text style={styles.productName}>
            {product.name}
          </Text>

          <Text style={styles.productType}>
            {productTypeLabels[product.product_type]}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                statusColors.background,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: statusColors.text },
            ]}
          >
            {product.status}
          </Text>
        </View>
    </View>

      {
    product.description ? (
      <Text style={styles.description}>
        {product.description}
      </Text>
    ) : null
  }

      <View style={styles.divider} />

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>
            Preço
          </Text>

          <Text style={styles.metricValue}>
            {formatCurrency(product.price)}
          </Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metric}>
          <Text style={styles.metricLabel}>
            Estoque atual
          </Text>

          <Text
            style={[
              styles.metricValue,
              isCritical(product) &&
              styles.criticalValue,
            ]}
          >
            {formatQuantity(
              product.stock_quantity
            )}{' '}
            {productUnitLabels[
              product.unit_of_measure
            ]}
          </Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metric}>
          <Text style={styles.metricLabel}>
            Estoque mínimo
          </Text>

          <Text style={styles.metricValue}>
            {formatQuantity(
              product.min_stock_quantity
            )}{' '}
            {productUnitLabels[
              product.unit_of_measure
            ]}
          </Text>
        </View>
      </View>
    </Pressable >
  );
}

export function ProductsScreen() {
  const router = useRouter();
  const {
    pageWidth,
    readableContentWidth,
  } = useResponsiveLayout();

  const {
    products,
    loading,
    refreshing,
    error,
    retry,
    refresh,
  } = useProducts();

  const [query, setQuery] = useState('');
  const [filter, setFilter] =
    useState<ProductFilter>('all');

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLocaleLowerCase('pt-BR');

    return products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          product.name,
          product.description ?? '',
          productCategoryLabels[product.category],
          product.status,
        ]
          .join(' ')
          .toLocaleLowerCase('pt-BR')
          .includes(normalizedQuery);

      const matchesFilter =
        filter === 'all' ||
        (filter === 'critical' &&
          isCritical(product)) ||
        (filter === 'available' &&
          product.status === 'Disponível') ||
        (filter === 'inactive' &&
          !product.is_active);

      return matchesQuery && matchesFilter;
    });
  }, [filter, products, query]);

  const criticalCount = useMemo(
    () =>
      products.filter((product) =>
        isCritical(product)
      ).length,
    [products]
  );

  const showInitialLoading =
    loading && products.length === 0;

  const showInitialError =
    Boolean(error) && products.length === 0;

  return (
    <SafeAreaView
      edges={['top']}
      style={styles.screen}
    >
      <StatusBar style="light" />

      <FlatList
        contentContainerStyle={[
          styles.content,
          { width: pageWidth },
        ]}
        data={visibleProducts}
        keyExtractor={(product) => product.id}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[sereneColors.primary]}
            onRefresh={refresh}
            progressBackgroundColor={
              sereneColors.sheetSurface
            }
            refreshing={refreshing}
            tintColor={sereneColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <SereneHeader
              actions={
                <Pressable
                  accessibilityLabel="Cadastrar produto"
                  accessibilityRole="button"
                  onPress={() =>
                    router.push('/product-entry')
                  }
                  style={({ pressed }) => [
                    styles.newProductButton,
                    pressed &&
                    styles.newProductButtonPressed,
                  ]}
                >
                  <Ionicons
                    color={sereneColors.text}
                    name="add"
                    size={22}
                  />
                </Pressable>
              }
              description="Acompanhe catálogo, preços e níveis de estoque."
              eyebrow="Catálogo operacional"
              title="Produtos"
            />

            <SereneSheet style={styles.productsSheet}>
              <TextInput
                accessibilityLabel="Buscar produtos"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                onChangeText={setQuery}
                placeholder="Nome, categoria ou situação"
                placeholderTextColor={
                  sereneColors.sheetTextMuted
                }
                returnKeyType="search"
                selectionColor={sereneColors.primary}
                style={styles.searchInput}
                value={query}
              />

              <View style={styles.filterRow}>
                {FILTERS.map((option) => {
                  const selected =
                    filter === option.value;

                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: selected,
                      }}
                      key={option.value}
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
                          styles.filterText,
                          selected &&
                          styles.filterTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {error && products.length > 0 ? (
                <View
                  accessibilityRole="alert"
                  style={styles.warningCard}
                >
                  <View style={styles.warningDot} />

                  <Text style={styles.warningText}>
                    {error} Os produtos já carregados
                    foram mantidos.
                  </Text>
                </View>
              ) : null}

              <View style={styles.summary}>
                <Text style={styles.resultCount}>
                  {visibleProducts.length}{' '}
                  {visibleProducts.length === 1
                    ? 'produto encontrado'
                    : 'produtos encontrados'}
                </Text>

                <Text style={styles.criticalCount}>
                  {criticalCount}{' '}
                  {criticalCount === 1
                    ? 'estoque crítico'
                    : 'estoques críticos'}
                </Text>
              </View>
            </SereneSheet>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {showInitialLoading ? (
              <>
                <ActivityIndicator
                  color={sereneColors.primary}
                  size="large"
                />

                <Text style={styles.emptyTitle}>
                  Carregando produtos
                </Text>

                <Text style={styles.emptyDescription}>
                  Estamos organizando seu catálogo.
                </Text>
              </>
            ) : showInitialError ? (
              <>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    color={sereneColors.danger}
                    name="cloud-offline-outline"
                    size={25}
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  Não foi possível carregar
                </Text>

                <Text style={styles.emptyDescription}>
                  {error}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  onPress={retry}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed &&
                    styles.retryButtonPressed,
                  ]}
                >
                  <Text style={styles.retryText}>
                    Tentar novamente
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    color={sereneColors.primary}
                    name="cube-outline"
                    size={25}
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  Nenhum produto encontrado
                </Text>

                <Text style={styles.emptyDescription}>
                  {products.length === 0
                    ? 'Os produtos cadastrados aparecerão aqui.'
                    : 'Tente alterar a busca ou o filtro selecionado.'}
                </Text>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard
            onPress={() =>
              router.push({
                pathname: '/product-entry',
                params: {
                  id: item.id,
                },
              })
            }
            product={item}
            width={readableContentWidth}
          />
        )}
      />
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
    backgroundColor: sereneColors.sheet,
    flexGrow: 1,
    paddingBottom: 140,
  },

  productsSheet: {
    minHeight: 0,
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg,
  },

  searchInput: {
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    minHeight: 48,
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
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },

  filterButtonSelected: {
    backgroundColor: sereneColors.primary,
    borderColor: sereneColors.primary,
  },

  filterButtonPressed: {
    opacity: 0.76,
  },

  filterText: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },

  filterTextSelected: {
    color: sereneColors.textOnPrimary,
  },

  warningCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF7E6',
    borderColor: '#F5D495',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
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

  summary: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },

  resultCount: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
  },

  criticalCount: {
    color: sereneColors.danger,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },

  productCard: {
    alignSelf: 'center',
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.xl,
  },

  productCardPressed: {
  backgroundColor: sereneColors.sheetPressed,
  opacity: 0.9,
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

  category: {
    color: sereneColors.primary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  productName: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    marginTop: spacing.xs,
  },

  productType: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    marginTop: spacing.xs,
  },

  statusBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },

  description: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.lg,
  },

  divider: {
    backgroundColor: sereneColors.sheetBorder,
    height: 1,
    marginVertical: spacing.lg,
  },

  metrics: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },

  metric: {
    flex: 1,
  },

  metricDivider: {
    backgroundColor: sereneColors.sheetBorder,
    marginHorizontal: spacing.lg,
    width: 1,
  },

  metricLabel: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
  },

  metricValue: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.body,
    fontWeight: '600',
    marginTop: spacing.sm,
  },

  criticalValue: {
    color: sereneColors.danger,
  },

  empty: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },

  emptyIcon: {
    alignItems: 'center',
    backgroundColor: sereneColors.sheetPressed,
    borderRadius: radii.pill,
    height: 52,
    justifyContent: 'center',
    width: 52,
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
    maxWidth: 340,
    textAlign: 'center',
  },

  retryButton: {
    backgroundColor: sereneColors.primary,
    borderRadius: radii.pill,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },

  retryButtonPressed: {
    backgroundColor: sereneColors.primaryPressed,
  },

  retryText: {
    color: sereneColors.textOnPrimary,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  newProductButton: {
    alignItems: 'center',
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },

  newProductButtonPressed: {
    opacity: 0.72,
  },
});