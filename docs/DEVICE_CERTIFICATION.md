# Device Certification Record

Status: **Device-tested / evidence linkage pending**
Recorded: 2026-08-29

The operator reports that this application has been tested across multiple applicable device types and received device certification.

This closes the generic blocker that the product has never been exercised on multiple devices. It does **not** by itself certify a future build, an untested platform, an exact current commit SHA, signing/notarization, app-store approval, production backend/provider configuration, or operational resilience.

## Evidence to retain for release signoff
- exact tested commit SHA and/or build identifier
- device manufacturer/model
- OS and version
- installation/distribution method
- test date and tester
- critical workflow test cases
- pass/fail result and known limitations
- screenshots, logs, crash reports, or other supporting evidence

## Release rule
A release may claim device certification only for targets whose retained evidence maps to the release candidate or to an unchanged device-facing build. Any material device/runtime change requires targeted recertification.
