import { useState } from 'react'
import type { FormEvent } from 'react'
import { login } from '../../services/auth.service'

function isValidEmail(value: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function LoginPage() {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [remember, setRemember] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [error, setError] = useState('')
	const [emailError, setEmailError] = useState(false)
	const [passwordError, setPasswordError] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const invalidEmail = !isValidEmail(email.trim())
		const invalidPassword = password.length === 0

		setEmailError(invalidEmail)
		setPasswordError(invalidPassword)
		setError('')

		if (invalidEmail || invalidPassword) return

		setIsSubmitting(true)
		try {
			const response = await login(email.trim(), password)
			const storage = remember ? localStorage : sessionStorage
			localStorage.removeItem('gestoria_token')
			sessionStorage.removeItem('gestoria_token')
			storage.setItem('gestoria_token', response.access_token)
			window.location.href = '/dashboard'
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Não foi possível entrar.')
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<main className="login-shell">
			<section className="login-intro" aria-label="Sobre o GestorIA">
				<div>
					<div className="brand" aria-label="GestorIA">
						<span className="brand-mark" aria-hidden="true"><span /></span>
						<span>Gestor<span className="brand-accent">IA</span></span>
					</div>
					<div className="intro-copy">
						<p className="eyebrow">Gestão com clareza</p>
						<h1>Inteligência que organiza.</h1>
						<p className="intro-description">Transforme a gestão da sua empresa com uma experiência simples, rápida e orientada pelas suas decisões.</p>
					</div>
					<div className="workflow" aria-hidden="true">
						<div className="workflow-item"><span>01</span><code>&quot;cadastre a Maria como cliente&quot;</code></div>
						<div className="workflow-line" />
						<div className="workflow-item"><span>02</span><code>{'{ intent: create_customer }'}</code></div>
						<div className="workflow-line" />
						<div className="workflow-item"><span>03</span><code>cliente cadastrado com sucesso</code></div>
					</div>
				</div>
				<p className="copyright">GestorIA © 2026 — Plataforma de gestão empresarial</p>
			</section>

			<section className="login-panel">
				<div className="login-card">
					<p className="eyebrow panel-eyebrow">Área do cliente</p>
					<h2>Bem-vindo de volta</h2>
					<p className="panel-description">Entre com as credenciais da sua empresa para continuar.</p>

					<form onSubmit={handleSubmit} noValidate>
						<div className={`field ${emailError ? 'field-error' : ''}`}>
							<label htmlFor="email">E-mail</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(event) => { setEmail(event.target.value); setEmailError(false) }}
								placeholder="voce@suaempresa.com.br"
								autoComplete="email"
								aria-invalid={emailError}
							/>
							{emailError && <span className="validation-message">Informe um e-mail válido.</span>}
						</div>

						<div className={`field ${passwordError ? 'field-error' : ''}`}>
							<label htmlFor="password">Senha</label>
							<div className="password-input">
								<input
									id="password"
									type={showPassword ? 'text' : 'password'}
									value={password}
									onChange={(event) => { setPassword(event.target.value); setPasswordError(false) }}
									placeholder="Sua senha"
									autoComplete="current-password"
									aria-invalid={passwordError}
								/>
								<button type="button" onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? 'ocultar' : 'mostrar'}</button>
							</div>
							{passwordError && <span className="validation-message">A senha é obrigatória.</span>}
						</div>

						<div className="form-options">
							<label className="remember-option"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Manter conectado</label>
							<a href="#forgot-password">Esqueci minha senha</a>
						</div>

						<p className="form-status" role="alert" aria-live="polite">{error}</p>
						<button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Entrando...' : 'Entrar'}</button>
					</form>

					<div className="signup-divider"><span>novo por aqui</span></div>
					<p className="signup-copy">Ainda não é cliente GIA? <a href="#contact">Fale com a gente</a></p>
				</div>
			</section>
		</main>
	)
}
