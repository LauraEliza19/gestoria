export const DEFAULT_ERROR_MESSAGE = 'Não foi possível concluir a operação.'

export function getErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  if (error instanceof Error) {
    const message = error.message.trim()

    if (message) {
      return message
    }
  }

  return fallback
}
