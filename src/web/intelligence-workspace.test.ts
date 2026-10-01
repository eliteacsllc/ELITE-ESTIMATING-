import test from 'node:test';import assert from 'node:assert/strict';import {intelligenceWorkspaceCss,intelligenceWorkspaceJs} from './intelligence-workspace.js';
test('intelligence workspace exposes complete governed workflow controls',()=>{
 assert.match(intelligenceWorkspaceJs,/external-estimate/);
 assert.match(intelligenceWorkspaceJs,/completeness-review/);
 assert.match(intelligenceWorkspaceJs,/estimatics-context/);
 assert.match(intelligenceWorkspaceJs,/supplement-review-draft/);
 assert.match(intelligenceWorkspaceJs,/completeness-finding/);
 assert.match(intelligenceWorkspaceJs,/data-reason/);
 assert.match(intelligenceWorkspaceCss,/intelFinding/);
});