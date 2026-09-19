import test from 'node:test';
import assert from 'node:assert/strict';
import { approveValuationRevision, createValuationRevision, validateRevisionChain } from './revisions.js';
import { calculateMarketValuation } from './market-valuation.js';

test('creates immutable negotiation revision with evidence snapshot', () => {
  const result = calculateMarketValuation({
    subject: { year: 2022, make: 'Honda', model: 'Accord' },
    comparables: [{ id: 'c1', price: 25000, year: 2022, make: 'Honda', model: 'Accord', source: 'dealer' }],
  });
  const first = createValuationRevision({ kind: 'market_value', createdBy: 'appraiser@example.com', reason: 'initial', result });
  const second = createValuationRevision({ kind: 'market_value', createdBy: 'appraiser@example.com', reason: 'carrier counteroffer review', result, supersedes: first });
  assert.equal(second.supersedesId, first.id);
  assert.deepEqual(second.selectedComparableIds, ['c1']);
  assert.equal(validateRevisionChain([first, second]).ok, true);
  const approved = approveValuationRevision(second, { approvedBy: 'reviewer@example.com' });
  assert.equal(approved.approved, true);
  assert.equal(second.approved, false);
});
