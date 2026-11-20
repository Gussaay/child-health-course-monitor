import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

// The mentorship forms used to keep scores and the "form complete" flag in
// state and update them from a big effect that runs after every answer.
// Each setState forced a second full re-render of these very large forms,
// which is why every tap felt slow. Scores and completeness are now derived
// from formData with useMemo during the render the answer already causes.
describe('mentorship forms derive scores instead of re-rendering for them', () => {
  it('IMNCI skills form memoises scores and completeness', () => {
    const src = read('src/components/mentorship/SkillsAssessmentForm.jsx');
    expect(src).toContain('const scores = useMemo(() => calculateScores(formData), [formData]);');
    expect(src).toContain('const isFormFullyComplete = useMemo(');
    expect(src).not.toContain('setScores(');
    expect(src).not.toContain('setIsFormFullyComplete(');
  });

  it('IMNCI cleanup effect no longer depends on visibleStep', () => {
    const src = read('src/components/mentorship/SkillsAssessmentForm.jsx');
    expect(src).not.toContain('}, [formData, visibleStep]);');
    expect(src).toContain('setVisibleStep(prev => {');
  });

  it('EENC skills form memoises scores and completeness', () => {
    const src = read('src/components/mentorship/EENCSkillsAssessmentForm.jsx');
    expect(src).toContain('const scores = useMemo(() => calculateScores(formData), [formData]);');
    expect(src).toContain('const isFormComplete = useMemo(() => checkFormCompletion(formData), [formData]);');
    expect(src).not.toContain('setScores(');
    expect(src).not.toContain('setIsFormComplete(');
  });
});
