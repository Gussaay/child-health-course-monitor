// src/components/chartSetup.js
//
// Chart.js registration, in one place.
//
// This used to run at the top of App.jsx and CommonComponents.jsx, both of
// which the entry chunk imports eagerly — so chart.js (192 KB) was downloaded
// and parsed before the login screen could render, on every visit, for every
// user, including the ones who never open a dashboard.
//
// Import this module from the components that actually draw charts. They are
// all lazy-loaded, so chart.js now arrives with the screen that needs it.
//
//   import './chartSetup';   // side-effect import, before rendering any chart
//
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
);

export { ChartJS };
