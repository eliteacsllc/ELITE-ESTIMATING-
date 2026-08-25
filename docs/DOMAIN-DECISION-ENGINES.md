# Domain Decision Engines

Elite's decision engines operate on canonical normalized inputs rather than proprietary vendor schemas. Provider-specific adapters supply data only after certification; the decision logic remains portable.

## Parts optimizer

Ranks eligible part candidates using landed cost, lead time, quality/certification/warranty and logistics. Hard policy filters run before scoring: allowed source type, carrier authorization, OEM-procedure compatibility, safety approval, distance/lead-time limits, stock and provenance.

A cheaper candidate cannot outrank a required safety or OEM-procedure constraint because an ineligible candidate is rejected before scoring.

## Repair versus replace

Compares full repair and replacement economics including labor, materials, equipment and dependent operations. Safety procedure satisfaction and restoration feasibility are hard constraints when configured. Cycle time and part lead time can influence an otherwise economic decision.

The output is `repair`, `replace` or `manual_review`, with cost ratio, confidence, blockers and reasons. It is a decision aid; authoritative OEM procedure requirements remain controlling.

## Total-loss economics

Normalizes comparable values with provenance, computes an evidence-based ACV range, and evaluates either an explicitly configured threshold method or repair-plus-salvage formula. It never invents a jurisdiction rule. Without a jurisdiction/policy reference it returns `manual_review` rather than a legal-like total-loss conclusion.

## Domain workflow

Each optional estimating domain can attach a persistent workflow generated from its domain checklist. Required steps begin pending and store status, evidence references, completion identity/time and notes. Once attached, an incomplete required workflow blocks estimate approval. If no domain workflow is attached, manual core behavior remains unchanged.

This preserves the platform rule: advanced features are optional, but once enabled their controls are enforceable.
