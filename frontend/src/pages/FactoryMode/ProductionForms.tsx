import { useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { FormExit, SaveButton } from '../../components/forms/FormActions'
import { FormHeader, RequiredMark } from '../../components/forms/FormHeader'
import { useFormChanges } from '../../components/forms/useFormState'
import { IngredientPicker } from './IngredientPicker'
import { compatible, reference, units } from './productionTypes'
import type {
  Ingredient,
  IngredientChoice,
  Recipe,
  RecipeDraft,
  StockDraft,
  StockItem,
  Unit,
} from './productionTypes'

export function StockForm({
  stock,
  ingredients,
  busy,
  saving,
  onAttempt,
  onSave,
  onCancel,
}: {
  stock: StockItem | null
  ingredients: Ingredient[]
  busy: boolean
  saving: boolean
  onAttempt: () => void
  onSave: (draft: StockDraft) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(stock?.name ?? '')
  const [quantity, setQuantity] = useState(stock?.quantity ?? '')
  const [unit, setUnit] = useState<Unit>(stock?.unit ?? 'kg')
  const [choice, setChoice] = useState<IngredientChoice>(
    stock
      ? { id: stock.ingredient_id, name: stock.ingredient_name, confirmed: true }
      : { name: '', confirmed: false },
  )
  const [error, setError] = useState('')
  const { dirty } = useFormChanges({ name, quantity, unit, choice })
  const selected = ingredients.find((item) => item.id === choice.id)
  function clearErrors() {
    setError('')
    onAttempt()
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    clearErrors()
    if (!choice.confirmed) {
      setError('Escolha uma sugestão ou confirme o novo ingrediente antes de salvar.')
      return
    }
    onSave({ name, quantity, unit, ...reference(choice) })
  }
  return (
    <form
      onSubmit={submit}
      onInvalidCapture={clearErrors}
      aria-busy={saving}
      className="mb-6 rounded-lg border border-line bg-paper p-4"
    >
      <FormHeader
        module="Produção · Estoque"
        title={stock ? 'Editar item de estoque' : 'Novo item de estoque'}
        description="Informe o saldo e associe o item ao ingrediente usado nas receitas."
        mode={stock ? 'edit' : 'create'}
        heading="h3"
        dirty={dirty}
        blocked={saving}
        back={{ onClick: onCancel, label: 'Voltar ao estoque' }}
      />
      <fieldset disabled={busy} className="grid gap-4">
        <label className="form-label">
          <span>
            Nome do item ou marca
            <RequiredMark />
          </span>
          <input
            className="form-input"
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Farinha Santa Amália"
          />
        </label>
        <IngredientPicker
          label="Corresponde ao ingrediente"
          ingredients={ingredients}
          value={choice}
          suggestionQuery={name}
          onChange={(next, ingredient) => {
            setChoice(next)
            setError('')
            if (ingredient && !compatible(ingredient.unit).includes(unit)) setUnit(ingredient.unit)
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="form-label">
            <span>
              Quantidade em estoque
              <RequiredMark />
            </span>
            <input
              className="form-input"
              type="number"
              min="0"
              max="1000000000"
              step="0.001"
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="Ex.: 2"
            />
          </label>
          <label className="form-label">
            Unidade
            <select
              aria-label="Unidade do estoque"
              className="form-input"
              value={unit}
              onChange={(event) => setUnit(event.target.value as Unit)}
            >
              {(selected ? compatible(selected.unit) : units).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
      <p className="mt-3 text-xs text-muted">
        Informe o saldo total nesta unidade. Marcas associadas ao mesmo ingrediente são somadas na
        consulta das receitas.
      </p>
      {stock && (
        <p className="mt-2 text-xs text-muted">
          Ao trocar a associação, este saldo passa a atender o ingrediente escolhido. As receitas
          permanecem iguais.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-[#a52c42]">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <SaveButton saving={saving} disabled={busy}>
          Salvar item
        </SaveButton>
        <FormExit onClick={onCancel} blocked={saving}>
          Cancelar
        </FormExit>
      </div>
    </form>
  )
}

export function RecipeForm({
  recipe,
  ingredients,
  busy,
  saving,
  onAttempt,
  onSave,
  onCancel,
}: {
  recipe: Recipe | null
  ingredients: Ingredient[]
  busy: boolean
  saving: boolean
  onAttempt: () => void
  onSave: (draft: RecipeDraft) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(recipe?.name ?? '')
  const [yieldQuantity, setYieldQuantity] = useState(recipe?.yield_quantity ?? '')
  const [yieldUnit, setYieldUnit] = useState(recipe?.yield_unit ?? 'unidades')
  const [error, setError] = useState('')
  const [items, setItems] = useState(() =>
    recipe
      ? recipe.items.map((item) => ({
          key: crypto.randomUUID(),
          choice: {
            id: item.ingredient_id,
            name: item.ingredient_name,
            confirmed: true,
          } as IngredientChoice,
          quantity: item.quantity,
          unit: item.unit,
        }))
      : [
          {
            key: crypto.randomUUID(),
            choice: { name: '', confirmed: false } as IngredientChoice,
            quantity: '',
            unit: 'g' as Unit,
          },
        ],
  )
  const { dirty } = useFormChanges({
    name,
    yieldQuantity,
    yieldUnit,
    items: items.map(({ key: _key, ...item }) => item),
  })
  function clearErrors() {
    setError('')
    onAttempt()
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    clearErrors()
    if (items.some((item) => !item.choice.confirmed)) {
      setError('Escolha uma sugestão ou confirme o nome de cada novo ingrediente antes de salvar.')
      return
    }
    onSave({
      name,
      yield_quantity: yieldQuantity,
      yield_unit: yieldUnit,
      items: items.map((item) => ({
        ...reference(item.choice),
        quantity: item.quantity,
        unit: item.unit,
      })),
    })
  }
  return (
    <form
      onSubmit={submit}
      onInvalidCapture={clearErrors}
      aria-busy={saving}
      className="mb-6 rounded-lg border border-line bg-paper p-4"
    >
      <FormHeader
        module="Produção · Receitas"
        title={recipe ? 'Editar receita' : 'Nova receita'}
        description="Defina os ingredientes, as quantidades e o rendimento da receita."
        mode={recipe ? 'edit' : 'create'}
        heading="h3"
        dirty={dirty}
        blocked={saving}
        back={{ onClick: onCancel, label: 'Voltar às receitas' }}
      />
      <fieldset disabled={busy} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="form-label">
            <span>
              Nome da receita
              <RequiredMark />
            </span>
            <input
              className="form-input"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Pão de queijo"
            />
          </label>
          <label className="form-label">
            <span>
              Rendimento por receita
              <RequiredMark />
            </span>
            <input
              className="form-input"
              type="number"
              min="0.001"
              max="1000000"
              step="0.001"
              required
              value={yieldQuantity}
              onChange={(event) => setYieldQuantity(event.target.value)}
              placeholder="Ex.: 30"
            />
          </label>
          <label className="form-label">
            <span>
              Medida do rendimento
              <RequiredMark />
            </span>
            <input
              className="form-input"
              required
              maxLength={40}
              value={yieldUnit}
              onChange={(event) => setYieldUnit(event.target.value)}
              placeholder="Ex.: unidades, porções, kg"
            />
          </label>
        </div>
        <p className="text-sm text-muted">
          Cadastre a receita mesmo sem estoque. Digite os ingredientes, escolha as sugestões ou
          confirme novos nomes. Para xícaras e colheres, informe a equivalência em g ou ml.
        </p>
        {items.map((item, index) => {
          const ingredient = ingredients.find((value) => value.id === item.choice.id)
          const update = (changes: Partial<typeof item>) =>
            setItems((current) =>
              current.map((value) => (value.key === item.key ? { ...value, ...changes } : value)),
            )
          return (
            <div key={item.key} className="min-w-0 rounded-lg border border-line bg-white p-3">
              <IngredientPicker
                label={`Ingrediente ${index + 1}`}
                ingredients={ingredients}
                value={item.choice}
                onChange={(choice, selected) =>
                  update({
                    choice,
                    ...(selected && !compatible(selected.unit).includes(item.unit)
                      ? { unit: selected.unit }
                      : {}),
                  })
                }
              />
              <div className="mt-3 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label className="form-label">
                  <span>
                    Quantidade
                    <RequiredMark />
                  </span>
                  <input
                    aria-label={`Quantidade do ingrediente ${index + 1}`}
                    className="form-input"
                    type="number"
                    min="0.001"
                    max="1000000"
                    step="0.001"
                    required
                    value={item.quantity}
                    onChange={(event) => update({ quantity: event.target.value })}
                  />
                </label>
                <label className="form-label">
                  Unidade
                  <select
                    aria-label={`Unidade do ingrediente ${index + 1}`}
                    className="form-input"
                    value={item.unit}
                    onChange={(event) => update({ unit: event.target.value as Unit })}
                  >
                    {(ingredient ? compatible(ingredient.unit) : units).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="secondary-button disabled:opacity-50"
                  disabled={items.length === 1}
                  aria-label={`Remover ingrediente ${index + 1}`}
                  onClick={() =>
                    setItems((current) => current.filter((value) => value.key !== item.key))
                  }
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          )
        })}
        <button
          type="button"
          className="secondary-button justify-self-start gap-2 disabled:opacity-50"
          disabled={items.length >= 100}
          onClick={() =>
            setItems((current) => [
              ...current,
              {
                key: crypto.randomUUID(),
                choice: { name: '', confirmed: false },
                quantity: '',
                unit: 'g',
              },
            ])
          }
        >
          <Plus size={16} aria-hidden="true" />
          Adicionar ingrediente
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="mt-3 text-sm text-[#a52c42]">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <SaveButton saving={saving} disabled={busy}>
          Salvar receita
        </SaveButton>
        <FormExit onClick={onCancel} blocked={saving}>
          Cancelar
        </FormExit>
      </div>
    </form>
  )
}
