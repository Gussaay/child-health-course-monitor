// Weight-for-height/length z-score from the WHO reference rows.
import zScoreData from '../zscore_reference_data.json';

// Returns { zScore, status } with the status the recording form ticks.
// A weight below the -3 line is extrapolated past -3 (it used to be clamped
// to exactly -3, which read as "Between -3 and -2 Z" and hid severe wasting).
export function weightForHeight({ sex, ageMonths, weightKg, lengthCm }, data = zScoreData) {
    const weight = parseFloat(weightKg); const length = parseFloat(lengthCm); const age = parseFloat(ageMonths);
    if (!weight || !length || !age || !sex) return { zScore: null, status: 'Incomplete Data' };

    const groupKey = (sex === 'male') ? (age < 24 ? 'boys_0_2' : 'boys_2_5') : (age < 24 ? 'girls_0_2' : 'girls_2_5');
    const groupData = data[groupKey];
    if (!groupData) return { zScore: null, status: 'Group Error' };

    const lengthKey = (Math.round(length * 2) / 2).toFixed(1);
    const row = groupData[lengthKey];
    if (!row) return { zScore: null, status: 'Length out of range' };

    const thresholds = ['-3', '-2', '-1', '0', '1', '2', '3'];
    let z = null;
    if (weight < row['-3']) z = -3 - (row['-3'] - weight) / (row['-2'] - row['-3']);
    else if (weight > row['3']) z = 3 + (weight - row['3']) / (row['3'] - row['2']);
    else {
        for (let i = 0; i < thresholds.length - 1; i++) {
            if (weight >= row[thresholds[i]] && weight <= row[thresholds[i + 1]]) {
                z = parseFloat(thresholds[i]) + (weight - row[thresholds[i]]) / (row[thresholds[i + 1]] - row[thresholds[i]]);
                break;
            }
        }
    }
    let status = '-2 Z or more';
    if (z !== null) { if (z < -3) status = 'Less than -3Z'; else if (z < -2) status = 'Between -3 and -2 Z'; }
    return { zScore: z?.toFixed(2), status };
}
