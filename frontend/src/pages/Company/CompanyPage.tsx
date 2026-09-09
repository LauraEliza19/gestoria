import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSession } from '../../services/auth.service'
import { apiFetch } from '../../services/api'

const fields = ['name', 'document', 'state_registration', 'municipal_registration', 'phone', 'postal_code', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'] as const
type Company = Record<typeof fields[number], string | null>

export function CompanyPage() {
	const navigate = useNavigate()
	const [data, setData] = useState<Company>(() => Object.fromEntries(fields.map((field) => [field, ''])) as Company)
	const [status, setStatus] = useState('')
	useEffect(() => { getSession().then((session) => setData((current) => ({ ...current, ...session.organization }))).catch((error) => setStatus(error.message)) }, [])
	function update(field: typeof fields[number], value: string) { setData((current) => ({ ...current, [field]: value })) }
	async function submit(event: FormEvent) { event.preventDefault(); if (!data.name?.trim()) { setStatus('O nome da empresa é obrigatório.'); return } try { await apiFetch('/api/organization', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(fields.map((field) => [field, data[field] || null]))) }); navigate('/dashboard') } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível salvar.') } }
	return <div className="page-wrap"><header className="page-header"><div><p className="eyebrow">Configurações</p><h1>Dados da empresa</h1><p>Mantenha as informações da organização atualizadas.</p></div><Link className="secondary-button" to="/dashboard">Voltar</Link></header><form className="page-card form-card form-grid" onSubmit={submit}>{fields.map((field) => <label key={field}>{field.replaceAll('_', ' ')}<input value={data[field] || ''} onChange={(event) => update(field, event.target.value)} /></label>)}{status && <p className="form-status">{status}</p>}<button className="primary-button" type="submit">Salvar alterações</button></form></div>
}
