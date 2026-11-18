// Writes booklet.json (the Sudan chart booklet tables the colour cards are made from):
//   node dump-booklet.mjs > booklet.json
const m = await import(new URL('../../src/components/chartBooklet.js', import.meta.url));
console.log(JSON.stringify(m.CHART_BOOKLET, null, 1));
