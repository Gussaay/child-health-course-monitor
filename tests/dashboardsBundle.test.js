// @vitest-environment node
// The server runs the dashboards' calculations from a bundle built from
// src/dashboards/ (functions/generated/dashboards.cjs). It must match the
// source: rebuild with  node scripts/build-dashboards-bundle.mjs
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDashboardsBundle } from '../scripts/build-dashboards-bundle.mjs';

describe('server bundle of the dashboard calculations', () => {
    it('is up to date with src/dashboards/', async () => {
        const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dash-')), 'dashboards.cjs');
        await buildDashboardsBundle(tmp);
        const fresh = fs.readFileSync(tmp, 'utf8');
        const committed = fs.readFileSync(path.resolve(__dirname, '../functions/generated/dashboards.cjs'), 'utf8');
        expect(committed === fresh, 'functions/generated/dashboards.cjs is stale: run node scripts/build-dashboards-bundle.mjs').toBe(true);
    });
});
