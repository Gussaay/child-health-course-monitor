/* global process */
// Builds src/assets/sudanMiniMap.json: one small SVG outline per state for the
// main menu's greeting card. The full map file (public/geo/sudan.json) is
// 1.9 MB; at card size the outlines need only a few points each, so they are
// projected once here, rounded to whole units and stored as path strings.
// Run again only if public/geo/sudan.json changes:
//   node scripts/build-mini-map.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { geoMercator, geoPath } from 'd3-geo';

const SIZE = 160;
const geo = JSON.parse(readFileSync('public/geo/sudan.json', 'utf8'));
const projection = geoMercator().fitSize([SIZE, SIZE], geo);

// Rounds each projected point and drops points that land on the previous one.
function roundedContext() {
    let d = '';
    let last = null;
    const pt = (x, y) => [Math.round(x), Math.round(y)];
    return {
        moveTo(x, y) { const p = pt(x, y); d += `M${p[0]} ${p[1]}`; last = p; },
        lineTo(x, y) {
            const p = pt(x, y);
            if (last && p[0] === last[0] && p[1] === last[1]) return;
            d += `L${p[0]} ${p[1]}`; last = p;
        },
        closePath() { d += 'Z'; last = null; },
        arc() {},
        result() { return d; },
    };
}

const states = {};
for (const feature of geo.features) {
    const ctx = roundedContext();
    geoPath(projection, ctx)(feature);
    // Rings that rounded down to a dot or a line are dropped.
    states[feature.properties.name] = ctx.result().split('M').filter(r => (r.match(/L/g) || []).length >= 2).map(r => `M${r}`).join('');
}

const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(geo);
const viewBox = [Math.floor(x0), Math.floor(y0), Math.ceil(x1 - x0), Math.ceil(y1 - y0)].join(' ');
writeFileSync('src/assets/sudanMiniMap.json', JSON.stringify({ viewBox, states }));
process.stdout.write(`viewBox ${viewBox}\n`);
