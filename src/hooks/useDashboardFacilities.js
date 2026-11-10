// src/hooks/useDashboardFacilities.js
//
// The facility list the coverage dashboards draw from. DashboardView provides
// it (the slim Dashboard copy, or the full list when no copy can be had); used
// anywhere else it is simply the full list from the data cache, as before.
import { createContext, useContext } from 'react';
import { useDataCache } from '../DataContext';

export const DashboardFacilitiesContext = createContext(null);

export function useDashboardFacilities() {
    const provided = useContext(DashboardFacilitiesContext);
    const { healthFacilities, isLoading, fetchHealthFacilities } = useDataCache();
    if (provided) return provided;
    return {
        facilities: healthFacilities,
        loading: !!isLoading?.healthFacilities || healthFacilities === null,
        refresh: () => fetchHealthFacilities({}, 'sync'),
    };
}
