#!/usr/bin/env python3
"""Fail-closed adoption gate for governed shared services.

The vertical remains independently deployable. This gate approves integration
only when repo-local controls and a current approved vendor/service decision are
provided as evidence. It does not make network calls or infer missing facts.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REQUIRED_CONTROLS = (
    "tenantIsolation",
    "evidenceProvenance",
    "humanApproval",
    "auditLogging",
    "rollback",
    "soc2Evidence",
)
ALLOWED_RISK = {"low", "moderate", "high", "critical"}


def evaluate(payload: dict) -> dict:
    controls = payload.get("controls") or {}
    missing = [name for name in REQUIRED_CONTROLS if controls.get(name) is not True]

    vendor = payload.get("vendorDecision") or {}
    risk = (vendor.get("risk") or {}).get("risk")
    if risk not in ALLOWED_RISK:
        missing.append("vendor_risk_decision")
    if vendor.get("adoptionState") != "approved":
        missing.append("vendor_not_approved")
    if vendor.get("evidenceValid") is not True:
        missing.append("vendor_evidence_invalid")
    if vendor.get("questionnaireComplete") is not True:
        missing.append("vendor_questionnaire_incomplete")
    if vendor.get("humanApprovalRequired") and vendor.get("approval") != "approved":
        missing.append("vendor_human_approval_missing")

    tenant_id = str(payload.get("tenantId") or "").strip()
    vendor_tenant = str(vendor.get("tenantId") or "").strip()
    if not tenant_id:
        missing.append("tenant_identity")
    elif vendor_tenant != tenant_id:
        missing.append("tenant_mismatch")

    return {
        "schema": "elite.independent-adoption-gate.v1",
        "repo": "ELITE-ESTIMATING-",
        "pass": not missing,
        "missing": sorted(set(missing)),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence", type=Path, help="JSON evidence package")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    try:
        payload = json.loads(args.evidence.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("evidence root must be an object")
        result = evaluate(payload)
    except Exception as exc:
        result = {
            "schema": "elite.independent-adoption-gate.v1",
            "repo": "ELITE-ESTIMATING-",
            "pass": False,
            "missing": ["invalid_evidence_package"],
            "error": str(exc),
        }

    encoded = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(encoded, encoding="utf-8")
    sys.stdout.write(encoded)
    return 0 if result["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
