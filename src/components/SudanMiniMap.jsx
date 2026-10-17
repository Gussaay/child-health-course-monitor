import React from 'react';
import miniMap from '../assets/sudanMiniMap.json';

// Small outline of Sudan for the main menu's greeting card. The person's own
// states are filled in; on a federal account every state is. Drawn in
// currentColor, so the card's text colour sets it. Built from
// public/geo/sudan.json by scripts/build-mini-map.mjs.
export default function SudanMiniMap({ highlight = [], all = false, className = '', title }) {
    const mine = new Set(highlight);
    return (
        <svg viewBox={miniMap.viewBox} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
            {Object.entries(miniMap.states).map(([name, d]) => {
                const on = all || mine.has(name);
                return (
                    <path
                        key={name}
                        d={d}
                        fill="currentColor"
                        fillOpacity={on ? 0.95 : 0.18}
                        stroke="currentColor"
                        strokeOpacity={0.45}
                        strokeWidth={0.6}
                        strokeLinejoin="round"
                    >
                        <title>{name}</title>
                    </path>
                );
            })}
        </svg>
    );
}
