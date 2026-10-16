// Turns an error from the backend into text you can show on screen.
// Django sends errors like {"bio": ["Too long."]} or {"detail": "Not allowed."}.
export function errorMessage(err) {
  if (!err) return 'Something went wrong. Please try again.'
  if (typeof err === 'string') return err
  if (err.message) return err.message
  if (err.detail) return err.detail
  const messages = Object.values(err).flat().filter((m) => typeof m === 'string')
  return messages.join('\n') || 'Something went wrong. Please try again.'
}
