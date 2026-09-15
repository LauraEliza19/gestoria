import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSession } from '../../services/auth.service'
import { apiFetch } from '../../services/api'

const fields = ['name', 'document', 'state_registration', 'municipal_registration', 'phone', 'postal_code', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'] as const
const fieldLabels: Record<typeof fields[number], string> = {
	name: 'Nome da empresa',
	document: 'CNPJ',
	state_registration: 'Inscrição estadual',
	municipal_registration: 'Inscrição municipal',
	phone: 'Telefone',
	postal_code: 'CEP',
	street: 'Rua',
	number: 'Número',
	complement: 'Complemento',
	neighborhood: 'Bairro',
	city: 'Cidade',
	state: 'Estado',
}
type Company = Record<typeof fields[number], string | null>

export function CompanyPage() {
	const navigate = useNavigate()
	const [data, setData] = useState<Company>(() => Object.fromEntries(fields.map((field) => [field, ''])) as Company)
	const [status, setStatus] = useState('')
	useEffect(() => { getSession().then((session) => setData((current) => ({ ...current, ...session.organization, name: session.organization.name === 'Empresa Demo GestorIA' ? '' : session.organization.name }))).catch((error) => setStatus(error.message)) }, [])
	function update(field: typeof fields[number], value: string) { setData((current) => ({ ...current, [field]: value })) }
	async function submit(event: FormEvent) { event.preventDefault(); if (!data.name?.trim()) { setStatus('O nome da empresa é obrigatório.'); return } try { await apiFetch('/api/organization', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(fields.map((field) => [field, data[field] || null]))) }); navigate('/dashboard') } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível salvar.') } }
	return <div className="mx-auto w-full max-w-[1180px] p-7 md:p-16"><header className="mb-9 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end"><div><p className="mb-3 font-mono text-[11px] uppercase tracking-[.08em] text-signal">Configurações</p><h1 className="font-display text-[clamp(28px,4vw,42px)] font-semibold tracking-[-.04em]">Dados da empresa</h1><p className="mt-2 text-sm text-muted">Mantenha as informações da organização atualizadas.</p></div><Link className="inline-flex items-center justify-center rounded-lg border border-line bg-white px-4 py-3 text-[13px] font-bold text-[#354064]" to="/dashboard">Voltar</Link></header><form className="grid max-w-[850px] grid-cols-1 gap-[18px] rounded-[10px] border border-line bg-white p-6 shadow-[0_8px_24px_rgba(17,25,54,.04)] md:grid-cols-2" onSubmit={submit}>{fields.map((field) => <label className="grid gap-2 text-[13px] font-bold text-[#354064]" key={field}>{fieldLabels[field]}<input className="w-full rounded-lg border-[1.5px] border-[#dde2f0] bg-white p-3 text-ink outline-none focus:border-signal focus:ring-4 focus:ring-[rgba(61,99,245,.12)]" value={data[field] || ''} onChange={(event) => update(field, event.target.value)} /> </label>)}{status && <p className="col-span-full text-[13px] text-[#d84f62]">{status}</p>}<button className="inline-flex w-fit items-center justify-center rounded-lg bg-signal px-4 py-3 text-[13px] font-bold text-white transition hover:bg-signal-dark" type="submit">Salvar alterações</button></form></div>
}
