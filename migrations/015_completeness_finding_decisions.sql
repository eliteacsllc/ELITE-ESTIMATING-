ALTER TABLE estimate_decision_records
  DROP CONSTRAINT IF EXISTS estimate_decision_records_decision_type_check;

ALTER TABLE estimate_decision_records
  ADD CONSTRAINT estimate_decision_records_decision_type_check
  CHECK (decision_type IN ('parts_optimization','repair_replace','total_loss','completeness_finding'));
