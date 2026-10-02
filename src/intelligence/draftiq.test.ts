import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDraftIQDraft, draftIqCanAdvanceToReview } from './draftiq.js';

test('DraftIQ keeps human approval and flags safety-critical work', () => {
  const draft = buildDraftIQDraft({
    requiredEvidenceKinds: ['photo', 'procedure'],
    now: new Date('2026-10-01T00:00:00Z'),
    candidates: [{
      component: 'front radar',
      operation: 'calibrate',
      description: 'Calibrate forward radar after impact repair',
      confidence: 0.94,
      safetyCritical: true,
      evidence: [
        { id: 'p1', kind: 'photo' },
        { id: 'oem1', kind: 'procedure', source: 'licensed-oem' },
      ],
    }],
  });
  assert.equal(draft.requiresHumanApproval, true);
  assert.equal(draft.lines[0]?.status, 'needs-review');
  assert.deepEqual(draft.missingEvidence, []);
  assert.equal(draftIqCanAdvanceToReview(draft), true);
});

test('DraftIQ fails completeness when required evidence is absent', () => {
  const draft = buildDraftIQDraft({
    requiredEvidenceKinds: ['photo', 'procedure'],
    candidates: [{
      component: 'bumper cover',
      operation: 'repair',
      description: 'Repair bumper cover',
      confidence: 0.88,
      evidence: [{ id: 'p1', kind: 'photo' }],
    }],
  });
  assert.deepEqual(draft.missingEvidence, ['missing_procedure']);
  assert.equal(draftIqCanAdvanceToReview(draft), false);
});


test('DraftIQ flags missing labor and pricing provenance', () => {
  const draft = buildDraftIQDraft({
    candidates: [
      {
        component: 'quarter panel',
        operation: 'repair',
        description: 'Repair quarter panel',
        confidence: 0.91,
        evidence: [{ id: 'photo-1', kind: 'photo' }],
      },
      {
        component: 'bumper cover',
        operation: 'replace',
        description: 'Replace bumper cover',
        confidence: 0.92,
        partPrice: 500,
        evidence: [{ id: 'photo-2', kind: 'photo' }],
      },
    ],
  });
  assert.ok(draft.lines[0]?.reviewReasons.includes('labor_time_required'));
  assert.ok(draft.lines[1]?.reviewReasons.includes('pricing_provenance_required'));
});
