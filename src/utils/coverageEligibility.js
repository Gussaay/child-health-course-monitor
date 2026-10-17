// Facilities whose IMNCI status is 'Unknown' (for example ones added from a
// facility list that had no service data) are left out of every coverage
// calculation, so they neither raise nor lower the percentages until someone
// records their services.
export const IMNCI_FIELD = 'وجود_العلاج_المتكامل_لامراض_الطفولة';
export const IMNCI_UNKNOWN = 'Unknown';

export const countsForCoverage = (f) => f?.[IMNCI_FIELD] !== IMNCI_UNKNOWN;
