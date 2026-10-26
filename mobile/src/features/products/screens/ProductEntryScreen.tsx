import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  SereneHeader,
  SereneSheet,
} from '@/components/serene/SereneLayout';
import { useAuth } from '@/features/auth/context/useAuth';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  fontSizes,
  radii,
  sereneColors,
  spacing,
} from '@/theme/tokens';

import {
  createProduct,
  deleteProduct,
  getProduct,
  updateProduct,
} from '../services/productService';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_TYPES,
  PRODUCT_UNITS,
  productCategoryLabels,
  productTypeLabels,
  productUnitLabels,
  type ProductCategory,
  type ProductType,
  type ProductUnit,
} from '../productTypes';

type ChoiceOption<T extends string> = {
  label: string;
  value: T;
};

type ChoiceGroupProps<T extends string> = {
  label: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: ChoiceGroupProps<T>) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <View style={styles.choiceRow}>
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  selected && styles.choiceTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function normalizeDecimal(value: string) {
  const trimmed = value.trim().replace(/\s/g, '');

  if (trimmed.includes(',')) {
    return trimmed.replace(/\./g, '').replace(',', '.');
  }

  return trimmed;
}

function parseNonNegativeDecimal(value: string) {
  const normalized = normalizeDecimal(value);

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return normalized;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Não foi possível salvar o produto. Tente novamente.';
}

export function ProductEntryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const productId = Array.isArray(id) ? id[0] : id;
  const isEditing = Boolean(productId);
  const canDelete =
    session?.role === 'owner' || session?.role === 'admin';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [minStockQuantity, setMinStockQuantity] = useState('');
  const [category, setCategory] =
    useState<ProductCategory>('outros');
  const [productType, setProductType] =
    useState<ProductType>('resale');
  const [unit, setUnit] = useState<ProductUnit>('unit');
  const [isActive, setIsActive] = useState(true);
  const [perishable, setPerishable] = useState(false);
  const [shelfLifeDays, setShelfLifeDays] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] =
    useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(
    Boolean(productId)
  );

  const { pageWidth, readableContentWidth } = useResponsiveLayout();

  useEffect(() => {
    if (!productId) {
      return;
    }

    let active = true;

    getProduct(productId)
      .then((product) => {
        if (!active) {
          return;
        }

        setName(product.name);
        setDescription(product.description ?? '');
        setPrice(product.price);
        setCostPrice(product.cost_price ?? '');
        setStockQuantity(product.stock_quantity);
        setMinStockQuantity(product.min_stock_quantity);
        setCategory(product.category);
        setProductType(product.product_type);
        setUnit(product.unit_of_measure);
        setIsActive(product.is_active);
        setPerishable(product.perishable);
        setShelfLifeDays(
          product.shelf_life_days === null
            ? ''
            : String(product.shelf_life_days)
        );
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingProduct(false);
        }
      });

    return () => {
      active = false;
    };
  }, [productId]);

  async function handleSubmit() {
    if (saving) {
      return;
    }

    setError(null);

    const normalizedName = name.trim();
    const normalizedPrice = parseNonNegativeDecimal(price);
    const normalizedStock = parseNonNegativeDecimal(stockQuantity);
    const normalizedMinStock =
      parseNonNegativeDecimal(minStockQuantity);
    const normalizedCostPrice = costPrice.trim()
      ? parseNonNegativeDecimal(costPrice)
      : null;

    if (!normalizedName) {
      setError('Informe o nome do produto.');
      return;
    }

    if (normalizedPrice === null) {
      setError('Informe um preço de venda válido.');
      return;
    }

    if (costPrice.trim() && normalizedCostPrice === null) {
      setError('Informe um preço de custo válido.');
      return;
    }

    if (normalizedStock === null) {
      setError('Informe uma quantidade de estoque válida.');
      return;
    }

    if (normalizedMinStock === null) {
      setError('Informe um estoque mínimo válido.');
      return;
    }

    const normalizedShelfLife = shelfLifeDays.trim()
      ? Number(shelfLifeDays)
      : null;

    if (
      perishable &&
      (normalizedShelfLife === null ||
        !Number.isInteger(normalizedShelfLife) ||
        normalizedShelfLife <= 0)
    ) {
      setError('Informe a validade do produto em dias.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: normalizedName,
        description: description.trim() || null,
        price: normalizedPrice,
        stock_quantity: normalizedStock,
        is_active: isActive,
        category,
        product_type: productType,
        unit_of_measure: unit,
        cost_price: normalizedCostPrice,
        min_stock_quantity: normalizedMinStock,
        perishable,
        shelf_life_days: perishable ? normalizedShelfLife : null,
        barcode: null,
        ncm_code: null,
        cest_code: null,
        fiscal_origin: null,
        recipe_id: null,
      };

      if (productId) {
        await updateProduct(productId, payload);
      } else {
        await createProduct(payload);
      }

      router.replace('/products');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!productId || !canDelete || deleting) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteProduct(productId);
      setDeleteConfirmationVisible(false);
      router.replace('/products');
    } catch (requestError) {
      setDeleteConfirmationVisible(false);
      setError(
        requestError instanceof Error && requestError.message.trim()
          ? requestError.message
          : 'Não foi possível excluir o produto.'
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardArea}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { width: pageWidth },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SereneHeader
            actions={
              <Pressable
                accessibilityLabel="Voltar aos produtos"
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.headerAction,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  color={sereneColors.text}
                  name="close"
                  size={21}
                />
              </Pressable>
            }
            description={
              isEditing
                ? 'Atualize preços, estoque e informações do item.'
                : 'Cadastre um item e mantenha preços e estoque organizados.'
            }
            eyebrow="Catálogo operacional"
            title={isEditing ? 'Editar produto' : 'Novo produto'}
          />

          <SereneSheet style={styles.formSheet}>
            <View
              style={[
                styles.formContent,
                { width: readableContentWidth },
              ]}
            >
              {loadingProduct ? (
                <View style={styles.loadingCard}>
                  <ActivityIndicator
                    color={sereneColors.primary}
                    size="small"
                  />

                  <Text style={styles.loadingText}>
                    Carregando dados do produto
                  </Text>
                </View>
              ) : null}

              <Text style={styles.sectionEyebrow}>IDENTIFICAÇÃO</Text>

              <Text style={styles.sectionTitle}>Dados do produto</Text>

              <Text style={styles.sectionDescription}>
                Informe os dados comerciais e operacionais do item.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nome do produto</Text>

                <TextInput
                  autoCapitalize="sentences"
                  onChangeText={setName}
                  placeholder="Ex.: Café especial 500 g"
                  placeholderTextColor={sereneColors.sheetTextMuted}
                  selectionColor={sereneColors.primary}
                  style={styles.input}
                  value={name}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Descrição</Text>

                <TextInput
                  multiline
                  onChangeText={setDescription}
                  placeholder="Informações importantes sobre o produto"
                  placeholderTextColor={sereneColors.sheetTextMuted}
                  selectionColor={sereneColors.primary}
                  style={[styles.input, styles.descriptionInput]}
                  textAlignVertical="top"
                  value={description}
                />
              </View>

              <View style={styles.twoColumns}>
                <View style={styles.column}>
                  <Text style={styles.fieldLabel}>Preço de venda</Text>

                  <TextInput
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    onChangeText={setPrice}
                    placeholder="0,00"
                    placeholderTextColor={sereneColors.sheetTextMuted}
                    selectionColor={sereneColors.primary}
                    style={styles.input}
                    value={price}
                  />
                </View>

                <View style={styles.column}>
                  <Text style={styles.fieldLabel}>Preço de custo</Text>

                  <TextInput
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    onChangeText={setCostPrice}
                    placeholder="0,00"
                    placeholderTextColor={sereneColors.sheetTextMuted}
                    selectionColor={sereneColors.primary}
                    style={styles.input}
                    value={costPrice}
                  />
                </View>
              </View>

              <ChoiceGroup
                label="Categoria"
                onChange={setCategory}
                options={PRODUCT_CATEGORIES.map((value) => ({
                  label: productCategoryLabels[value],
                  value,
                }))}
                value={category}
              />

              <ChoiceGroup
                label="Tipo do produto"
                onChange={setProductType}
                options={PRODUCT_TYPES.map((value) => ({
                  label: productTypeLabels[value],
                  value,
                }))}
                value={productType}
              />

              <ChoiceGroup
                label="Unidade de medida"
                onChange={setUnit}
                options={PRODUCT_UNITS.map((value) => ({
                  label: productUnitLabels[value],
                  value,
                }))}
                value={unit}
              />

              <View style={styles.twoColumns}>
                <View style={styles.column}>
                  <Text style={styles.fieldLabel}>Estoque atual</Text>

                  <TextInput
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    onChangeText={setStockQuantity}
                    placeholder="0"
                    placeholderTextColor={sereneColors.sheetTextMuted}
                    selectionColor={sereneColors.primary}
                    style={styles.input}
                    value={stockQuantity}
                  />
                </View>

                <View style={styles.column}>
                  <Text style={styles.fieldLabel}>Estoque mínimo</Text>

                  <TextInput
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    onChangeText={setMinStockQuantity}
                    placeholder="0"
                    placeholderTextColor={sereneColors.sheetTextMuted}
                    selectionColor={sereneColors.primary}
                    style={styles.input}
                    value={minStockQuantity}
                  />
                </View>
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text style={styles.switchTitle}>Produto ativo</Text>

                  <Text style={styles.switchDescription}>
                    Produtos inativos não ficam disponíveis para novas
                    operações.
                  </Text>
                </View>

                <Switch
                  onValueChange={setIsActive}
                  thumbColor={sereneColors.sheetSurface}
                  trackColor={{
                    false: sereneColors.sheetBorder,
                    true: sereneColors.primary,
                  }}
                  value={isActive}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text style={styles.switchTitle}>Produto perecível</Text>

                  <Text style={styles.switchDescription}>
                    Ative para informar o prazo de validade.
                  </Text>
                </View>

                <Switch
                  onValueChange={setPerishable}
                  thumbColor={sereneColors.sheetSurface}
                  trackColor={{
                    false: sereneColors.sheetBorder,
                    true: sereneColors.primary,
                  }}
                  value={perishable}
                />
              </View>

              {perishable ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Validade em dias</Text>

                  <TextInput
                    inputMode="numeric"
                    keyboardType="number-pad"
                    onChangeText={setShelfLifeDays}
                    placeholder="Ex.: 30"
                    placeholderTextColor={sereneColors.sheetTextMuted}
                    selectionColor={sereneColors.primary}
                    style={styles.input}
                    value={shelfLifeDays}
                  />
                </View>
              ) : null}

              {error ? (
                <View accessibilityRole="alert" style={styles.errorBanner}>
                  <View style={styles.errorDot} />

                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={saving || loadingProduct}
                onPress={() => void handleSubmit()}
                style={({ pressed }) => [
                  styles.submitButton,
                  (saving || loadingProduct) && styles.buttonDisabled,
                  pressed &&
                    !saving &&
                    !loadingProduct &&
                    styles.pressed,
                ]}
              >
                {saving || loadingProduct ? (
                  <ActivityIndicator
                    color={sereneColors.textOnPrimary}
                    size="small"
                  />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>
                      {isEditing
                        ? 'Salvar alterações'
                        : 'Cadastrar produto'}
                    </Text>

                    <Ionicons
                      color={sereneColors.textOnPrimary}
                      name={isEditing ? 'checkmark' : 'arrow-forward'}
                      size={17}
                    />
                  </>
                )}
              </Pressable>

              {isEditing && canDelete ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={deleting || loadingProduct}
                  onPress={() => setDeleteConfirmationVisible(true)}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    (deleting || loadingProduct) && styles.buttonDisabled,
                    pressed &&
                      !deleting &&
                      !loadingProduct &&
                      styles.pressed,
                  ]}
                >
                  <Ionicons
                    color={sereneColors.danger}
                    name="trash-outline"
                    size={18}
                  />

                  <Text style={styles.deleteButtonText}>Excluir produto</Text>
                </Pressable>
              ) : null}
            </View>
          </SereneSheet>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) {
            setDeleteConfirmationVisible(false);
          }
        }}
        transparent
        visible={deleteConfirmationVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Cancelar exclusão"
            disabled={deleting}
            onPress={() => setDeleteConfirmationVisible(false)}
            style={styles.modalBackdrop}
          />

          <View style={styles.confirmationCard}>
            <View style={styles.deleteIcon}>
              <Ionicons
                color={sereneColors.danger}
                name="trash-outline"
                size={25}
              />
            </View>

            <Text style={styles.confirmationTitle}>Excluir produto?</Text>

            <Text style={styles.confirmationDescription}>
              O produto “{name}” será removido do catálogo. Essa ação não
              poderá ser desfeita.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => setDeleteConfirmationVisible(false)}
                style={({ pressed }) => [
                  styles.cancelButton,
                  deleting && styles.buttonDisabled,
                  pressed && !deleting && styles.pressed,
                ]}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => void handleDelete()}
                style={({ pressed }) => [
                  styles.confirmDeleteButton,
                  deleting && styles.buttonDisabled,
                  pressed && !deleting && styles.pressed,
                ]}
              >
                {deleting ? (
                  <ActivityIndicator
                    color={sereneColors.textOnPrimary}
                    size="small"
                  />
                ) : (
                  <>
                    <Ionicons
                      color={sereneColors.textOnPrimary}
                      name="trash-outline"
                      size={17}
                    />

                    <Text style={styles.confirmDeleteButtonText}>
                      Excluir
                    </Text>
                  </>
                )}
              </Pressable>
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

  keyboardArea: {
    flex: 1,
  },

  content: {
    alignSelf: 'center',
    flexGrow: 1,
  },

  headerAction: {
    alignItems: 'center',
    backgroundColor: sereneColors.surface,
    borderColor: sereneColors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },

  formSheet: {
    flexGrow: 1,
    minHeight: 620,
    paddingBottom: spacing.xxxl,
  },

  formContent: {
    alignSelf: 'center',
    width: '100%',
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

  sectionDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.sm,
  },

  fieldGroup: {
    marginTop: spacing.xl,
  },

  fieldLabel: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.caption,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },

  input: {
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  descriptionInput: {
    minHeight: 96,
  },

  twoColumns: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },

  column: {
    flex: 1,
    minWidth: 0,
  },

  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  choice: {
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: spacing.lg,
  },

  choiceSelected: {
    backgroundColor: sereneColors.primary,
    borderColor: sereneColors.primary,
  },

  choiceText: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },

  choiceTextSelected: {
    color: sereneColors.textOnPrimary,
  },

  switchRow: {
    alignItems: 'center',
    borderBottomColor: sereneColors.sheetBorder,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },

  switchText: {
    flex: 1,
  },

  switchTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },

  switchDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginTop: spacing.xs,
  },

  loadingCard: {
    alignItems: 'center',
    backgroundColor: sereneColors.sheetPressed,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },

  loadingText: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
  },

  errorBanner: {
    alignItems: 'flex-start',
    backgroundColor: '#FDECEF',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
  },

  errorDot: {
    backgroundColor: sereneColors.danger,
    borderRadius: radii.pill,
    height: 7,
    marginTop: 5,
    width: 7,
  },

  errorText: {
    color: '#A93048',
    flex: 1,
    fontSize: fontSizes.caption,
    lineHeight: 18,
  },

  submitButton: {
    alignItems: 'center',
    backgroundColor: sereneColors.primary,
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 54,
    paddingHorizontal: spacing.xl,
  },

  submitButtonText: {
    color: sereneColors.textOnPrimary,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },

  deleteButton: {
    alignItems: 'center',
    borderColor: sereneColors.danger,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.xl,
  },

  deleteButtonText: {
    color: sereneColors.danger,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },

  modalRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },

  modalBackdrop: {
    backgroundColor: sereneColors.overlay,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  confirmationCard: {
    alignItems: 'center',
    backgroundColor: sereneColors.sheetSurface,
    borderRadius: radii.xl,
    maxWidth: 440,
    padding: spacing.xl,
    width: '100%',
  },

  deleteIcon: {
    alignItems: 'center',
    backgroundColor: '#FDECEF',
    borderRadius: radii.pill,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },

  confirmationTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    marginTop: spacing.lg,
  },

  confirmationDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 21,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    width: '100%',
  },

  cancelButton: {
    alignItems: 'center',
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },

  cancelButtonText: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },

  confirmDeleteButton: {
    alignItems: 'center',
    backgroundColor: sereneColors.danger,
    borderRadius: radii.lg,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 50,
  },

  confirmDeleteButtonText: {
    color: sereneColors.textOnPrimary,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },

  buttonDisabled: {
    opacity: 0.55,
  },

  pressed: {
    opacity: 0.72,
  },
});
