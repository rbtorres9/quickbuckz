export const getDateTimeString = (isoDate) => {
    const date = new Date(isoDate)
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const hours24 = date.getHours();
    const hours = String(hours24 % 12 || 12).padStart(2, '0'); // Convert to 12-hour format
    const meridiem = hours24 >= 12 ? 'PM' : 'AM';
    const minutes = String(date.getMinutes()).padStart(2, '0');

    const formattedDate = `${month}/${day}/${year} ${hours}:${minutes} ${meridiem}`;
    return formattedDate;
}

export const getTimeDiffSecs = (isoDate) => {
    const now = new Date()
    const date = new Date(isoDate)
    const diffInSeconds = Math.floor((now - date) / 1000)
    return diffInSeconds
}

export const getTimeAgoString = (isoDate) => {
    const diffInSeconds = getTimeDiffSecs(isoDate)

    const intervals = {
        "s": 1,
        "m": 60,
        "h": 60 * 60,
        "d": 60 * 60 * 24,
        "w": 60 * 24 * 24 * 7,
        "M": 60 * 24 * 24 * 30,
        "y": 60 * 60 * 24 * 365,
    };

    let unit = "s"
    let interval = 1
    for (const [currentUnit, seconds] of Object.entries(intervals)) {
        if (diffInSeconds >= seconds) {
            interval = seconds
            unit = currentUnit
        }
        else {
            break
        }
    }

    return `${Math.floor(diffInSeconds / interval)}${unit}`
}