import { useId } from 'react'
import { Check, Search } from 'lucide-react'
import { normalizeIngredientName, suggestIngredients } from './ingredientSuggestions'
import type { Ingredient, IngredientChoice } from './productionTypes'

export function IngredientPicker({ label, ingredients, value, onChange, suggestionQuery = '' }: {
  label: string
  ingredients: Ingredient[]
  value: IngredientChoice
  onChange: (choice: IngredientChoice, ingredient?: Ingredient) => void
  suggestionQuery?: string
}) {
  const id = useId()
  const query = value.name || suggestionQuery
  const suggestions = suggestIngredients(query, ingredients)
  const exact = ingredients.some(item => normalizeIngredientName(item.name) === normalizeIngredientName(value.name))
  return <div className="min-w-0">
    <label className="form-label" htmlFor={id}>{label}</label>
    <div className="relative mt-2">
      <Search size={16} aria-hidden="true" className="absolute left-3 top-3.5 text-muted" />
      <input id={id} className="form-input pl-9" autoComplete="off" maxLength={120} required
        value={value.name} placeholder="Digite, escolha ou cadastre um ingrediente"
        aria-describedby={id + '-help'}
        onChange={event => onChange({ name: event.target.value, confirmed: false })} />
    </div>
    <p id={id + '-help'} className="mt-2 text-xs text-muted">
      {value.confirmed ? <span className="flex items-center gap-1 text-[#28745b]"><Check size={14} aria-hidden="true" />{value.id ? 'Ingrediente associado' : 'Novo ingrediente confirmado; será criado ao salvar'}</span>
        : 'Escolha uma sugestão ou confirme um novo ingrediente. Nomes parecidos precisam da sua escolha.'}
    </p>
    {!value.confirmed && <div className="mt-2 rounded-lg border border-line bg-white p-2">
      {suggestions.length > 0 && <>
        <p className="px-2 py-1 text-xs text-muted">{value.name ? 'Você quis dizer?' : suggestionQuery ? 'Sugestões para o nome do item' : 'Ingredientes já cadastrados'}</p>
        <ul aria-label={`Sugestões de ${label.toLowerCase()}`} className="grid gap-1">
          {suggestions.map(({ ingredient, exact: isExact }) => <li key={ingredient.id}>
            <button type="button" className="flex w-full items-start justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-paper"
              onClick={() => onChange({ id: ingredient.id, name: ingredient.name, confirmed: true }, ingredient)}>
              <span className="min-w-0 break-words font-semibold text-signal-dark">{ingredient.name}</span>
              <span className="shrink-0 text-xs text-muted">{isExact ? 'Mesmo nome' : ingredient.unit}</span>
            </button>
          </li>)}
        </ul>
      </>}
      {value.name.trim() && !exact && <button type="button" className="mt-1 w-full break-words rounded-md border border-dashed border-line px-3 py-2 text-left text-sm text-signal-dark"
        onClick={() => onChange({ name: value.name.trim(), confirmed: true })}>Cadastrar “{value.name.trim()}” como novo ingrediente</button>}
      {!query.trim() && suggestions.length === 0 && <p className="p-2 text-xs text-muted">Digite o nome, por exemplo “Farinha de trigo”. Não é necessário ter esse ingrediente em estoque.</p>}
    </div>}
  </div>
}
