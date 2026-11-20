import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/components/mentorship/SkillsMentorshipView.jsx'), 'utf8');

// State, locality, facility and health worker are chosen once when entering
// the forms page. The first form's setup confirms the selection; every later
// form's setup then shows that selection as a summary and starts straight
// from it, instead of each form asking for the selection again.
describe('mentorship entry selection is shared by all forms', () => {
  it('keeps a page-level entry selection', () => {
    expect(src).toContain('const [entrySelection, setEntrySelection] = useState(null);');
  });

  it('confirms the selection when proceeding from a setup', () => {
    expect(src).toContain('setEntrySelection({');
    expect(src).toContain('service: activeService,');
  });

  it('setup shows the confirmed selection as a summary with a change option', () => {
    expect(src).toContain('const entrySelectionUsable = ');
    expect(src).toContain('entrySelectionUsable ? (');
    expect(src).toContain('onClick={() => setEntrySelection(null)}');
  });
});
