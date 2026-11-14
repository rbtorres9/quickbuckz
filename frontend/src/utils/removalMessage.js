// Template prefilled in every mod removal prompt; the reason after it is optional
// Used in ModTools.jsx, PostCard.jsx, PostPage.jsx, UserPage.jsx

export const REMOVAL_TEMPLATE =
  'We have removed your content. Excessive violations will lead to account termination. Reason: '

// Ask the mod for the message to the user.
// Returns the message, or null when cancelled or left empty.
// A blank reason drops the trailing "Reason:" so the user doesn't see an empty label.
export function askRemovalMessage(question, reason = '') {
  const input = prompt(`${question}\n\nMessage to the user (reason is optional):`, REMOVAL_TEMPLATE + reason)
  const message = input?.trim()
  return message || null
}