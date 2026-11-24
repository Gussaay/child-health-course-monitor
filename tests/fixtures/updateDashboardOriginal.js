// The page's original calculation (UpdateDashboard.jsx before src/dashboards/facilityUpdate.js), unchanged.
// Robust Date Extractors (UPGRADED)
const getValidDate = (val) => {
    if (!val) return null;
    // 1. If it's a native Firebase Timestamp with the prototype still attached
    if (val.toDate && typeof val.toDate === 'function') return val.toDate();
    // 2. CRITICAL FIX: If it's a raw/serialized Firebase Timestamp object
    if (typeof val === 'object' && val !== null) {
        if ('seconds' in val) return new Date(val.seconds * 1000);
        if ('_seconds' in val) return new Date(val._seconds * 1000);
    }
    // 3. Fallback for ISO strings or epoch numbers
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

const getUpdateDate = (f) => {
    return getValidDate(f.lastSnapshotAt) || getValidDate(f['اخر تحديث']) || getValidDate(f.updatedAt);
};

const getCreationDate = (f) => {
    return getValidDate(f.createdAt) || getValidDate(f.created_at);
};

// --- USER NAME NORMALIZATION HELPERS ---
// Pass 1: Build a map of email -> Name from facilities that have the format "Name (email)"
const buildEmailToNameMap = (facilities) => {
    const map = {};
    facilities.forEach(f => {
        const raw = f.updated_by;
        if (!raw) return;
        const cleaned = raw.replace(/^Cleaned by\s+/i, '').trim();
        const match = cleaned.match(/^(.*?)\s*\((.*?@.*?)\)$/);
        if (match) {
            const name = match[1].trim();
            const email = match[2].trim().toLowerCase();
            if (name && email) map[email] = name;
        }
    });
    return map;
};

// Pass 2: Normalize the string using the map
const normalizeUpdater = (raw, emailMap) => {
    if (!raw) return 'System / Unknown';
    
    // Remove 'Cleaned by ' prefix
    let s = raw.replace(/^Cleaned by\s+/i, '').trim();
    
    // Group system/unknown variants
    const lower = s.toLowerCase();
    if (lower === 'system' || lower === 'unknown uploader' || lower === 'unknown / system' || lower === 'unknown') {
        return 'System / Unknown';
    }

    // Extract Name if format is "Name (email)"
    const match = s.match(/^(.*?)\s*\((.*?@.*?)\)$/);
    if (match) {
        return match[1].trim(); 
    }

    // If it's an email, check if we have mapped it to a name, otherwise use email prefix
    if (s.includes('@')) {
        const email = s.trim().toLowerCase();
        if (emailMap[email]) return emailMap[email];
        return email.split('@')[0];
    }

    return s;
};


export function originalDashboardData(facilities, stateFilter, localityFilter, timeFilter) {
        if (!facilities || facilities.length === 0) return null;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let updatedThisMonth = 0;
        
        const stateStats = {};
        const localityStats = {};
        const updaterStats = {};

        // Generate email->name dictionary for robust grouping
        const emailToNameMap = buildEmailToNameMap(facilities);

        // Helper: Check if a specific service form has data
        const hasServiceData = (f, service) => {
            switch(service) {
                case 'IMNCI': return f['وجود_العلاج_المتكامل_لامراض_الطفولة'] != null && f['وجود_العلاج_المتكامل_لامراض_الطفولة'] !== '';
                case 'EENC': return f.eenc_provides_essential_care != null && f.eenc_provides_essential_care !== '';
                case 'Neonatal': return (f.neonatal_level_of_care && Object.keys(f.neonatal_level_of_care).length > 0) || f.neonatal_level_primary != null || f.neonatal_level_secondary != null || f.neonatal_level_tertiary != null;
                case 'ETAT': return f.etat_has_service != null && f.etat_has_service !== '';
                default: return false;
            }
        };

        // Helper: Verify if facility was updated AFTER initial creation safely
        const isUpdatedAfterCreation = (f) => {
            // 1. Unambiguous structural markers of an update
            if (f.revision && f.revision > 1) return true;
            if (Array.isArray(f.history) && f.history.length > 0) return true;
            if (typeof f.updated_by === 'string' && f.updated_by.toLowerCase().includes('cleaned by')) return true;

            const uDate = getUpdateDate(f);
            const cDate = getCreationDate(f);
            
            const updatedMs = uDate ? uDate.getTime() : 0;
            const createdMs = cDate ? cDate.getTime() : 0;

            // 2. Timestamp comparisons
            if (createdMs > 0 && updatedMs > 0) {
                // If updated at least 10 seconds after creation, it's a confirmed update
                if ((updatedMs - createdMs) > 10000) return true;
                return false; 
            }

            // 3. Fallback: If we somehow have an update date but missing creation date
            if (createdMs === 0 && updatedMs > 0) return true;

            return false;
        };

        // Apply Core Filters
        const filteredFacilities = facilities.filter(f => {
            if (!isUpdatedAfterCreation(f)) return false;

            if (stateFilter && f['الولاية'] !== stateFilter) return false;
            if (localityFilter && f['المحلية'] !== localityFilter) return false;

            const updatedDate = getUpdateDate(f);
            if (!updatedDate) return false;

            const uMonth = updatedDate.getMonth();
            const uYear = updatedDate.getFullYear();

            if (timeFilter === 'THIS_MONTH') {
                if (uMonth !== currentMonth || uYear !== currentYear) return false;
            } else if (timeFilter === 'LAST_MONTH') {
                const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
                if (uMonth !== lastMonth || uYear !== lastMonthYear) return false;
            } else if (timeFilter === 'THIS_YEAR') {
                if (uYear !== currentYear) return false;
            } else if (timeFilter === 'LAST_YEAR') {
                if (uYear !== currentYear - 1) return false;
            }

            return true;
        });

        // Calculate Metrics on the Filtered Subset
        filteredFacilities.forEach(f => {
            const updatedDate = getUpdateDate(f);
            
            if (updatedDate && updatedDate.getMonth() === currentMonth && updatedDate.getFullYear() === currentYear) {
                updatedThisMonth++;
            }

            // Aggregate by State
            const stateKey = f['الولاية'] || 'Unknown';
            if (!stateStats[stateKey]) stateStats[stateKey] = { total: 0, IMNCI: 0, EENC: 0, Neonatal: 0, ETAT: 0 };
            stateStats[stateKey].total++;

            // Aggregate by Locality (For KPI box)
            const locKey = f['المحلية'] || 'Unknown';
            if (!localityStats[locKey]) localityStats[locKey] = { total: 0 };
            localityStats[locKey].total++;

            // Aggregate by Normalized Updater Name
            const updaterName = normalizeUpdater(f.updated_by, emailToNameMap);
            if (!updaterStats[updaterName]) updaterStats[updaterName] = { total: 0, IMNCI: 0, EENC: 0, Neonatal: 0, ETAT: 0 };
            updaterStats[updaterName].total++;

            // Tally Service Updates
            ['IMNCI', 'EENC', 'Neonatal', 'ETAT'].forEach(svc => {
                if (hasServiceData(f, svc)) {
                    stateStats[stateKey][svc]++;
                    updaterStats[updaterName][svc]++;
                }
            });
        });

        // Top KPIs computation
        const topState = Object.entries(stateStats).sort((a, b) => b[1].total - a[1].total)[0];
        const topLocality = Object.entries(localityStats).sort((a, b) => b[1].total - a[1].total)[0];
        const topUpdater = Object.entries(updaterStats).sort((a, b) => b[1].total - a[1].total)[0];

        return { 
            updatedThisMonth, 
            stateStats, 
            updaterStats,
            topState,
            topLocality,
            topUpdater
        };
}
