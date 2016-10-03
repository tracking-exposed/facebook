export function getTimeISO8601 (date) {
    // Thanks to http://stackoverflow.com/a/17415677/597097
    const now = date || new Date();
    const tzo = -now.getTimezoneOffset();
    const dif = tzo >= 0 ? '+' : '-';
    const pad = function (num) {
        const norm = Math.abs(Math.floor(num));
        return (norm < 10 ? '0' : '') + norm;
    };
    return [now.getFullYear(), '-',
            pad(now.getMonth() + 1), '-',
            pad(now.getDate()), 'T',
            pad(now.getHours()), ':',
            pad(now.getMinutes()), ':',
            pad(now.getSeconds()), dif,
            pad(tzo / 60), ':',
            pad(tzo % 60)].join('');
}
