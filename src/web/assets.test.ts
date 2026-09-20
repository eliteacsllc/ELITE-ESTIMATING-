import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { indexHtml, appJs, appCss } from './assets.js';

test('universal workspace browser script parses and exposes all first-class asset classes', () => {
  assert.doesNotThrow(() => new Script(appJs, { filename: 'elite-estimating-workspace.js' }));
  for (const assetClass of [
    'heavy_equipment','agricultural_equipment','material_handling_equipment',
    'industrial_machinery','rv','marine','residential_property','commercial_property',
  ]) assert.match(indexHtml, new RegExp('value="'+assetClass+'"'));
});

test('domain workflow is a usable server-backed review process, not a decorative progress bar', () => {
  assert.match(indexHtml, /id="pane-workflow"/);
  assert.match(indexHtml, /id="workflowSteps"/);
  assert.match(indexHtml, /id="initializeDomain"/);
  assert.match(appJs, /domain-workflow\/steps/);
  assert.match(appJs, /method:'PATCH'/);
  assert.match(appJs, /evidenceRefs:refs/);
  assert.match(appJs, /if\(select\.value==='complete'&&!refs\.length\)/);
  assert.match(appJs, /if\(select\.value==='not_applicable'&&step\.required&&!noteInput\.value\.trim\(\)\)/);
});

test('the estimate editor does not silently approve lines or synthesize safety procedures', () => {
  assert.match(indexHtml, /id="reviewLine"/);
  assert.match(indexHtml, /id="procedureRef"/);
  assert.match(appJs, /humanApproved:\$\('reviewLine'\)\.checked/);
  assert.match(appJs, /if\(safety&&!procedureRef\)/);
  assert.match(appJs, /if\(linesDirty\)throw new Error/);
  assert.doesNotMatch(appJs, /humanApproved:true/);
  assert.doesNotMatch(appJs, /procedureRefs:[^\n]*\['human_procedure_review_required'\]/);
});

test('an existing estimate is reloadable without pretending that local edits were saved', () => {
  assert.match(indexHtml, /id="loadEstimateId"/);
  assert.match(indexHtml, /id="loadEstimate"/);
  assert.match(appJs, /Discard unsaved line edits/);
  assert.match(appJs, /Discard unsaved draft line edits and create a new estimate/);
  assert.match(appJs, /fresh\.revision!==estimate\.revision/);
  assert.match(appJs, /lines=loaded\.lines\|\|\[\]/);
  assert.match(appJs, /linesDirty=false/);
  assert.match(appCss, /workflowSteps/);
});
