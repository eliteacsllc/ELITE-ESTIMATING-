# Legacy / Older Branches

Active lanes are `lab -> qa -> main` only. Any other remote branch is legacy/older history unless explicitly reviewed and reactivated.

Legacy branches are read-only historical references, not release/deployment targets, and must be compared against current `main` before reuse. Port only required code into `lab`, validate, then promote through `qa` to `main`.

Do not create replacement legacy/archive/final/v2/staging/production branches just to organize history. This file is the logical legacy registry until obsolete refs can be deleted.