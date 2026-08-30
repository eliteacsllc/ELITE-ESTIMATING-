# Elite Estimating Benchmark Certification

Benchmark certification is a production launch gate, not a training score.

## Required evidence

Create a production `launch/benchmark-certification.json` from `launch/benchmark-certification.example.json` only after running the expert-reviewed benchmark suite. Every reference case must be reviewed by a qualified estimator/appraiser and traceable to its source evidence.

The certification records the market and asset classes tested, case count, expert-reviewed case count, mean line recall, mean line precision, mean absolute cost variance, safety-critical omissions, approved thresholds, expert approval and evidence reference.

## Safety policy

For collision launch certification, use zero safety-critical omissions unless a formally approved market-specific policy explicitly documents another threshold. Missing a mandatory ADAS calibration, scan, restraint operation, structural measurement, OEM procedure or similar safety-critical line must not be averaged away by good performance elsewhere.

## Commands

Build first:

```bash
npm run build
```

Validate benchmark certification only:

```bash
npm run benchmark:certify -- launch/benchmark-certification.json
```

Run the final combined production gate:

```bash
npm run launch:final -- launch/launch-manifest.json launch/benchmark-certification.json
```

`launch:final` returns green only when the production launch manifest is green, the benchmark certification is green, and the benchmark market/asset-class scope covers the requested launch scope.

## Human intervention boundary

Humans are required to provide or approve the benchmark ground truth and sign off the certification. Metric calculation, threshold enforcement, scope matching, and release blocking are automated.
