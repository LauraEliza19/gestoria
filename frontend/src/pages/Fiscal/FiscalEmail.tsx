// Exibe um e-mail permitindo quebra de linha apenas antes do "@",
// para não cortar o endereço no meio em colunas estreitas.
export function FiscalEmail({ email, link = false }: { email: string; link?: boolean }) {
  const at = email.indexOf('@')
  const content =
    at > 0 ? (
      <>
        {email.slice(0, at)}
        <wbr />
        {email.slice(at)}
      </>
    ) : (
      email
    )

  return link ? (
    <a className="fiscal-email" href={`mailto:${email}`} title={email}>
      {content}
    </a>
  ) : (
    <span className="fiscal-email" title={email}>
      {content}
    </span>
  )
}
