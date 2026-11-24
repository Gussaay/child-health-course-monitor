/* global process, console */
// scripts/build-dashboards-bundle.mjs
//
// Builds functions/generated/dashboards.cjs from src/dashboards/index.js, so
// the server runs exactly the calculations the pages run. Run after changing
// anything in src/dashboards/:  node scripts/build-dashboards-bundle.mjs
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function buildDashboardsBundle(outfile = path.join(root, 'functions/generated/dashboards.cjs')) {
    await build({
        entryPoints: [path.join(root, 'src/dashboards/index.js')],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node22',
        outfile,
        legalComments: 'none',
        banner: { js: '// GENERATED from src/dashboards/ by scripts/build-dashboards-bundle.mjs. Do not edit.' },
        logLevel: 'silent',
    });
    return outfile;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const out = await buildDashboardsBundle();
    console.log('built', path.relative(root, out));
}
