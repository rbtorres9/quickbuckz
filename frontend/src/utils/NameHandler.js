// I know this is kind of stupid but I keep having to do this so yeah
export const getName = (user) => {
    return [user?.first_name, user?.last_name].filter(Boolean).join(' ')
}
