// Where to go after logging in: back to the page you were sent away from
// (like a shared post link), or your profile.
// Only paths inside this site are allowed, never another website.
export function afterLoginPath(location) {
  const from = location.state?.from
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/user-page'
}
