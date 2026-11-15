// src/utils/dateRange.js
//
// The date filter used by the mentorship and supervision lists: a custom
// start/end wins over a named range (today, this_week, last_month, ...).
// Dates are 'YYYY-MM-DD' strings.

export const DATE_RANGE_OPTIONS = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'last_year'];

export const isDateInRange = (dateString, filterType, customStart, customEnd) => {
    if (!dateString || dateString === 'N/A') return false;
    const dParts = dateString.split('-');
    if (dParts.length !== 3) return false;
    const dateToCompare = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
    if (customStart || customEnd) {
        let isValid = true;
        if (customStart) {
            const sDate = new Date(customStart);
            sDate.setHours(0,0,0,0);
            if (dateToCompare < sDate) isValid = false;
        }
        if (customEnd) {
            const eDate = new Date(customEnd);
            eDate.setHours(23,59,59,999);
            if (dateToCompare > eDate) isValid = false;
        }
        return isValid;
    }
    if (!filterType) return true;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (filterType) {
        case 'today': return dateToCompare.getTime() === today.getTime();
        case 'yesterday': const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1); return dateToCompare.getTime() === yesterday.getTime();
        case 'this_week': const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - today.getDay()); return dateToCompare >= startOfWeek;
        case 'last_week': const startOfLastWeek = new Date(today); startOfLastWeek.setDate(today.getDate() - today.getDay() - 7); const endOfLastWeek = new Date(startOfLastWeek); endOfLastWeek.setDate(startOfLastWeek.getDate() + 6); return dateToCompare >= startOfLastWeek && dateToCompare <= endOfLastWeek;
        case 'this_month': return dateToCompare.getMonth() === today.getMonth() && dateToCompare.getFullYear() === today.getFullYear();
        case 'last_month': const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1); return dateToCompare.getMonth() === lastMonth.getMonth() && dateToCompare.getFullYear() === lastMonth.getFullYear();
        case 'this_year': return dateToCompare.getFullYear() === today.getFullYear();
        case 'last_year': return dateToCompare.getFullYear() === today.getFullYear() - 1;
        default: return true;
    }
};

