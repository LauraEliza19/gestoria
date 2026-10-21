import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { useAuth } from '@/features/auth/context/useAuth';
import {
  fontSizes,
  radii,
  sereneColors,
  spacing,
} from '@/theme/tokens';

import type {
  FinanceCategory,
  FinanceEntryStatus,
  FinanceEntryType,
} from '../financeTypes';
import {
  createFinanceCategory,
  createFinanceEntry,
  getFinanceCategories,
} from '../services/financeService';

const STATUS_OPTIONS: {
  label: string;
  value: FinanceEntryStatus;
}[] = [
  { label: 'Pendente', value: 'pending' },
  { label: 'Realizado', value: 'paid' },
  { label: 'Cancelado', value: 'cancelled' },
];

function getToday() {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

function parseDate(value: string) {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseAmount(value: string) {
  const compact = value
    .replace(/R\$/gi, '')
    .replace(/\s/g, '');
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact;
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed.toFixed(2);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

export function FinanceEntryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const canManage =
    session?.role === 'owner' || session?.role === 'admin';

  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(canManage);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [entryType, setEntryType] =
    useState<FinanceEntryType>('income');
  const [status, setStatus] =
    useState<FinanceEntryStatus>('pending');
  const [transactionDate, setTransactionDate] = useState(getToday);
  const [notes, setNotes] = useState('');
  const [categoryPickerVisible, setCategoryPickerVisible] =
    useState(false);
  const [newCategoryVisible, setNewCategoryVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    if (!canManage) {
      return () => {
        active = false;
      };
    }

    void getFinanceCategories()
      .then((response) => {
        if (active) {
          setCategories(response.filter((category) => category.is_active));
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            getErrorMessage(
              requestError,
              'Não foi possível carregar as categorias.'
            )
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoadingCategories(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canManage]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId]
  );

  const statusLabel =
    STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    'Pendente';

  function validateForm() {
    const trimmedDescription = description.trim();
    const normalizedAmount = parseAmount(amount);
    const normalizedDate = parseDate(transactionDate);

    if (!trimmedDescription) {
      setError('Informe uma descrição para o lançamento.');
      return null;
    }

    if (!normalizedAmount) {
      setError('Informe um valor maior que zero.');
      return null;
    }

    if (!categoryId) {
      setError('Selecione uma categoria financeira.');
      return null;
    }

    if (!normalizedDate) {
      setError('Informe uma data válida no formato DD/MM/AAAA.');
      return null;
    }

    setError('');

    return {
      amount: normalizedAmount,
      category_id: categoryId,
      description: trimmedDescription,
      entry_type: entryType,
      notes: notes.trim() || null,
      status,
      transaction_date: normalizedDate,
    };
  }

  function requestConfirmation() {
    if (validateForm()) {
      setConfirmationVisible(true);
    }
  }

  async function saveEntry() {
    const payload = validateForm();

    if (!payload) {
      setConfirmationVisible(false);
      return;
    }

    setSaving(true);
    setError('');

    try {
      await createFinanceEntry(payload);
      setSaved(true);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'Não foi possível registrar o lançamento.'
        )
      );
      setConfirmationVisible(false);
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory() {
    const name = newCategoryName.trim();

    if (!name) {
      setError('Informe o nome da nova categoria.');
      return;
    }

    setCreatingCategory(true);
    setError('');

    try {
      const category = await createFinanceCategory({
        description: null,
        name,
      });

      setCategories((current) => [...current, category]);
      setCategoryId(category.id);
      setNewCategoryName('');
      setNewCategoryVisible(false);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'Não foi possível criar a categoria.'
        )
      );
    } finally {
      setCreatingCategory(false);
    }
  }

  if (!canManage) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <SereneHeader
          actions={
            <Pressable
              accessibilityLabel="Voltar"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.headerAction}
            >
              <Ionicons color={sereneColors.text} name="close" size={21} />
            </Pressable>
          }
          eyebrow="Controle executivo"
          title="Novo lançamento"
        />
        <SereneSheet style={styles.deniedSheet}>
          <View style={styles.deniedIcon}>
            <Ionicons
              color={sereneColors.primary}
              name="lock-closed-outline"
              size={25}
            />
          </View>
          <Text style={styles.deniedTitle}>Ação restrita</Text>
          <Text style={styles.deniedDescription}>
            Somente proprietários e administradores podem registrar
            movimentações financeiras.
          </Text>
        </SereneSheet>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardArea}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SereneHeader
            actions={
              <Pressable
                accessibilityLabel="Voltar ao financeiro"
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
            description="Registre uma entrada ou saída com segurança."
            eyebrow="Controle executivo"
            title="Novo lançamento"
          />

          <SereneSheet style={styles.formSheet}>
            <Text style={styles.sectionEyebrow}>MOVIMENTAÇÃO</Text>
            <Text style={styles.sectionTitle}>Dados do lançamento</Text>
            <Text style={styles.sectionDescription}>
              O tipo define se o valor entra ou sai do caixa da empresa.
            </Text>

            <View style={styles.typeSelector}>
              {(
                [
                  { label: 'Entrada', value: 'income' },
                  { label: 'Saída', value: 'expense' },
                ] as const
              ).map((option) => {
                const selected = entryType === option.value;

                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={option.value}
                    onPress={() => setEntryType(option.value)}
                    style={({ pressed }) => [
                      styles.typeOption,
                      selected && styles.typeOptionSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      color={
                        selected
                          ? sereneColors.textOnPrimary
                          : sereneColors.sheetTextMuted
                      }
                      name={
                        option.value === 'income'
                          ? 'arrow-down'
                          : 'arrow-up'
                      }
                      size={16}
                    />
                    <Text
                      style={[
                        styles.typeOptionText,
                        selected && styles.typeOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Descrição</Text>
              <TextInput
                accessibilityLabel="Descrição do lançamento"
                autoCapitalize="sentences"
                maxLength={200}
                onChangeText={setDescription}
                placeholder="Ex.: Venda do dia"
                placeholderTextColor={sereneColors.sheetTextMuted}
                selectionColor={sereneColors.primary}
                style={styles.input}
                value={description}
              />
            </View>

            <View style={styles.twoColumns}>
              <View style={styles.column}>
                <Text style={styles.fieldLabel}>Valor</Text>
                <TextInput
                  accessibilityLabel="Valor do lançamento"
                  inputMode="decimal"
                  keyboardType="decimal-pad"
                  maxLength={16}
                  onChangeText={setAmount}
                  placeholder="0,00"
                  placeholderTextColor={sereneColors.sheetTextMuted}
                  selectionColor={sereneColors.primary}
                  style={styles.input}
                  value={amount}
                />
              </View>

              <View style={styles.column}>
                <Text style={styles.fieldLabel}>Data</Text>
                <TextInput
                  accessibilityLabel="Data do lançamento"
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={10}
                  onChangeText={(value) =>
                    setTransactionDate(formatDateInput(value))
                  }
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={sereneColors.sheetTextMuted}
                  selectionColor={sereneColors.primary}
                  style={styles.input}
                  value={transactionDate}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.fieldHeading}>
                <Text style={styles.fieldLabel}>Categoria</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setError('');
                    setCategoryPickerVisible(false);
                    setNewCategoryVisible(true);
                  }}
                >
                  <Text style={styles.inlineAction}>Nova categoria</Text>
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={loadingCategories}
                onPress={() => {
                  setError('');
                  setCategoryPickerVisible(true);
                }}
                style={({ pressed }) => [
                  styles.selectField,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.selectValue,
                    !selectedCategory && styles.selectPlaceholder,
                  ]}
                >
                  {loadingCategories
                    ? 'Carregando categorias...'
                    : selectedCategory?.name ?? 'Selecionar categoria'}
                </Text>
                {loadingCategories ? (
                  <ActivityIndicator
                    color={sereneColors.primary}
                    size="small"
                  />
                ) : (
                  <Ionicons
                    color={sereneColors.primary}
                    name="chevron-down"
                    size={18}
                  />
                )}
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Situação</Text>
              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map((option) => {
                  const selected = status === option.value;

                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      key={option.value}
                      onPress={() => setStatus(option.value)}
                      style={({ pressed }) => [
                        styles.statusOption,
                        selected && styles.statusOptionSelected,
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
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.fieldHint}>
                Apenas lançamentos realizados compõem o saldo exibido.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Observações</Text>
              <TextInput
                accessibilityLabel="Observações do lançamento"
                maxLength={5000}
                multiline
                onChangeText={setNotes}
                placeholder="Informações adicionais, se necessário"
                placeholderTextColor={sereneColors.sheetTextMuted}
                selectionColor={sereneColors.primary}
                style={[styles.input, styles.notesInput]}
                textAlignVertical="top"
                value={notes}
              />
            </View>

            {error ? (
              <View accessibilityRole="alert" style={styles.errorBanner}>
                <View style={styles.errorDot} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={saving || loadingCategories}
              onPress={requestConfirmation}
              style={({ pressed }) => [
                styles.submitButton,
                (saving || loadingCategories) && styles.buttonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.submitButtonText}>
                Revisar lançamento
              </Text>
              <Ionicons
                color={sereneColors.textOnPrimary}
                name="arrow-forward"
                size={18}
              />
            </Pressable>
          </SereneSheet>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        animationType="fade"
        onRequestClose={() => setCategoryPickerVisible(false)}
        transparent
        visible={categoryPickerVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar categorias"
            onPress={() => setCategoryPickerVisible(false)}
            style={styles.modalBackdrop}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>ORGANIZAÇÃO</Text>
                <Text style={styles.modalTitle}>Selecionar categoria</Text>
              </View>
              <Pressable
                accessibilityLabel="Fechar"
                onPress={() => setCategoryPickerVisible(false)}
                style={styles.modalClose}
              >
                <Ionicons
                  color={sereneColors.sheetTextMuted}
                  name="close"
                  size={20}
                />
              </Pressable>
            </View>

            {categories.length ? (
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                style={styles.categoryList}
              >
                {categories.map((category, index) => {
                  const selected = category.id === categoryId;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={category.id}
                      onPress={() => {
                        setCategoryId(category.id);
                        setError('');
                        setCategoryPickerVisible(false);
                      }}
                      style={[
                        styles.modalOption,
                        index === categories.length - 1 &&
                          styles.modalOptionLast,
                      ]}
                    >
                      <View style={styles.categoryText}>
                        <Text
                          style={[
                            styles.modalOptionText,
                            selected && styles.modalOptionTextSelected,
                          ]}
                        >
                          {category.name}
                        </Text>
                        {category.description ? (
                          <Text
                            numberOfLines={1}
                            style={styles.categoryDescription}
                          >
                            {category.description}
                          </Text>
                        ) : null}
                      </View>
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
              </ScrollView>
            ) : (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyTitle}>
                  Nenhuma categoria ativa
                </Text>
                <Text style={styles.modalEmptyText}>
                  Crie uma categoria para organizar este lançamento.
                </Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setError('');
                setCategoryPickerVisible(false);
                setNewCategoryVisible(true);
              }}
              style={styles.secondaryButton}
            >
              <Ionicons
                color={sereneColors.primary}
                name="add"
                size={19}
              />
              <Text style={styles.secondaryButtonText}>Nova categoria</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setNewCategoryVisible(false)}
        transparent
        visible={newCategoryVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar nova categoria"
            onPress={() => setNewCategoryVisible(false)}
            style={styles.modalBackdrop}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>ORGANIZAÇÃO</Text>
            <Text style={styles.modalTitle}>Nova categoria</Text>
            <Text style={styles.modalDescription}>
              Use um nome simples, como Vendas, Fornecedores ou Impostos.
            </Text>
            <TextInput
              accessibilityLabel="Nome da nova categoria"
              autoFocus
              maxLength={120}
              onChangeText={setNewCategoryName}
              placeholder="Nome da categoria"
              placeholderTextColor={sereneColors.sheetTextMuted}
              selectionColor={sereneColors.primary}
              style={[styles.input, styles.modalInput]}
              value={newCategoryName}
            />
            {error ? (
              <View accessibilityRole="alert" style={styles.errorBanner}>
                <View style={styles.errorDot} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={creatingCategory}
                onPress={() => setNewCategoryVisible(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={creatingCategory}
                onPress={() => void saveCategory()}
                style={styles.confirmButton}
              >
                {creatingCategory ? (
                  <ActivityIndicator
                    color={sereneColors.textOnPrimary}
                    size="small"
                  />
                ) : (
                  <Text style={styles.confirmButtonText}>Criar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!saving && !saved) {
            setConfirmationVisible(false);
          }
        }}
        transparent
        visible={confirmationVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar confirmação"
            disabled={saving || saved}
            onPress={() => setConfirmationVisible(false)}
            style={styles.modalBackdrop}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.modalHandle} />

            {saved ? (
              <View style={styles.successContent}>
                <View style={styles.successIcon}>
                  <Ionicons
                    color={sereneColors.success}
                    name="checkmark"
                    size={28}
                  />
                </View>
                <Text style={styles.successTitle}>Lançamento registrado</Text>
                <Text style={styles.successDescription}>
                  O fluxo financeiro e o saldo já podem ser atualizados.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.replace('/finance')}
                  style={styles.submitButton}
                >
                  <Text style={styles.submitButtonText}>Ver financeiro</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.modalEyebrow}>CONFIRMAÇÃO</Text>
                <Text style={styles.modalTitle}>Revisar lançamento</Text>
                <View style={styles.reviewCard}>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Movimentação</Text>
                    <Text style={styles.reviewValue}>
                      {entryType === 'income' ? 'Entrada' : 'Saída'}
                    </Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Valor</Text>
                    <Text style={styles.reviewValue}>R$ {amount}</Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Categoria</Text>
                    <Text style={styles.reviewValue}>
                      {selectedCategory?.name}
                    </Text>
                  </View>
                  <View style={[styles.reviewRow, styles.reviewRowLast]}>
                    <Text style={styles.reviewLabel}>Situação</Text>
                    <Text style={styles.reviewValue}>{statusLabel}</Text>
                  </View>
                </View>
                <Text style={styles.confirmationHint}>
                  Confirme para registrar esta movimentação financeira.
                </Text>
                <View style={styles.modalActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => setConfirmationVisible(false)}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelButtonText}>Voltar</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => void saveEntry()}
                    style={styles.confirmButton}
                  >
                    {saving ? (
                      <ActivityIndicator
                        color={sereneColors.textOnPrimary}
                        size="small"
                      />
                    ) : (
                      <Text style={styles.confirmButtonText}>Confirmar</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
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
    maxWidth: 560,
    width: '100%',
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
    minHeight: 720,
    paddingBottom: spacing.xxxl,
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
  typeSelector: {
    backgroundColor: '#EAF0F8',
    borderRadius: radii.lg,
    flexDirection: 'row',
    marginTop: spacing.xl,
    padding: 4,
  },
  typeOption: {
    alignItems: 'center',
    borderRadius: radii.md,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 44,
  },
  typeOptionSelected: {
    backgroundColor: sereneColors.primary,
  },
  typeOptionText: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  typeOptionTextSelected: {
    color: sereneColors.textOnPrimary,
  },
  fieldGroup: {
    marginTop: spacing.xl,
  },
  fieldHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.caption,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  fieldHint: {
    color: sereneColors.sheetTextMuted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  inlineAction: {
    color: sereneColors.primary,
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
  twoColumns: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  column: {
    flex: 1,
  },
  selectField: {
    alignItems: 'center',
    backgroundColor: sereneColors.sheetSurface,
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  selectValue: {
    color: sereneColors.sheetText,
    flex: 1,
    fontSize: fontSizes.bodySmall,
  },
  selectPlaceholder: {
    color: sereneColors.sheetTextMuted,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusOption: {
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusOptionSelected: {
    backgroundColor: '#EAF1FF',
    borderColor: '#EAF1FF',
  },
  statusOptionText: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },
  statusOptionTextSelected: {
    color: sereneColors.primary,
  },
  notesInput: {
    minHeight: 112,
  },
  errorBanner: {
    alignItems: 'flex-start',
    backgroundColor: '#FDECEF',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
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
  buttonDisabled: {
    opacity: 0.55,
  },
  deniedSheet: {
    alignItems: 'center',
    flex: 1,
  },
  deniedIcon: {
    alignItems: 'center',
    backgroundColor: '#EAF1FF',
    borderRadius: radii.pill,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  deniedTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    marginTop: spacing.lg,
  },
  deniedDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 21,
    marginTop: spacing.sm,
    maxWidth: 330,
    textAlign: 'center',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(4, 15, 33, 0.48)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  bottomSheet: {
    alignSelf: 'center',
    backgroundColor: sereneColors.sheetSurface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '82%',
    maxWidth: 560,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    width: '100%',
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: sereneColors.sheetBorder,
    borderRadius: radii.pill,
    height: 4,
    marginBottom: spacing.lg,
    width: 40,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
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
  modalDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  modalClose: {
    alignItems: 'center',
    backgroundColor: '#F1F4F9',
    borderRadius: radii.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  modalOption: {
    alignItems: 'center',
    borderBottomColor: sereneColors.sheetBorder,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
  },
  categoryList: {
    maxHeight: 300,
  },
  modalOptionLast: {
    borderBottomWidth: 0,
  },
  modalOptionText: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  modalOptionTextSelected: {
    color: sereneColors.primary,
  },
  categoryText: {
    flex: 1,
    minWidth: 0,
  },
  categoryDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: 10,
    marginTop: 3,
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  modalEmptyTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  modalEmptyText: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
  },
  secondaryButtonText: {
    color: sereneColors.primary,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  modalInput: {
    marginTop: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
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
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: sereneColors.primary,
    borderRadius: radii.lg,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  confirmButtonText: {
    color: sereneColors.textOnPrimary,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  reviewCard: {
    backgroundColor: '#F8FAFD',
    borderColor: sereneColors.sheetBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  reviewRow: {
    alignItems: 'center',
    borderBottomColor: sereneColors.sheetBorder,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  reviewRowLast: {
    borderBottomWidth: 0,
  },
  reviewLabel: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
  },
  reviewValue: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.bodySmall,
    fontWeight: '600',
  },
  confirmationHint: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  successContent: {
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: '#E5F6EE',
    borderRadius: radii.pill,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  successTitle: {
    color: sereneColors.sheetText,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    marginTop: spacing.lg,
  },
  successDescription: {
    color: sereneColors.sheetTextMuted,
    fontSize: fontSizes.bodySmall,
    lineHeight: 20,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
