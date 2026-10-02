import test from "node:test";
import assert from "node:assert/strict";
import { toEstimateEvidence } from "./canonical-evidence.js";

test("estimating reuses canonical evidence label and note", () => {
  const result = toEstimateEvidence({
    id: "ev-1",
    claimId: "cl-1",
    storageUri: "r2://claim/ev-1.jpg",
    sequence: 3,
    label: "Right Rear",
    note: "Impact area"
  });
  assert.equal(result.label, "Right Rear");
  assert.equal(result.note, "Impact area");
});
