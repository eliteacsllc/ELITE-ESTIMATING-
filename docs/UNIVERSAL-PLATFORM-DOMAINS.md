# Universal Estimating Domains

Elite Estimating is one platform with optional domain packs and optional intelligence modules. The manual estimating core must remain usable without premium data providers or AI modules.

## Domain adapters

The canonical domain registry covers:

- Collision: passenger vehicles, commercial vehicles, emergency vehicles.
- Commercial Truck: medium/heavy truck, tractor/trailer, emergency upfits.
- Heavy Equipment: construction/agricultural/industrial equipment and cranes.
- Powersports: motorcycle and ATV/UTV.
- RV: chassis plus coach/body/property-like systems.
- Marine: hull, deck, propulsion and onboard systems.
- Property: residential and commercial structures.
- Contents: item inventory, restoration and valuation.
- Specialty: custom/special-purpose assets that require manufacturer/upfitter logic.

Each adapter supplies an allowed operation set, a domain blueprint checklist and the universe of provider capabilities that can enhance that domain. It does not force those providers to be enabled.

## Optionality model

Every advanced module is an entitlement: damage AI, VIN/build, OEM procedures, MOTOR/RACED, DEG intelligence, I-CAR blueprinting, parts optimization, labor intelligence, ADAS/diagnostics, repair-vs-replace, total loss, market comps, salvage, fraud/anomaly, estimate audit, supplements, carrier compliance, screen copilot, collaboration, analytics and API access.

Automation is independently selectable: manual, assisted, copilot, automated draft or governed autonomy.

Feature dependencies are resolved automatically. For example MOTOR/RACED enables labor intelligence; ADAS enables OEM procedures. Enabling a module creates provider-capability requirements only for that module and applicable domain. Disabled modules do not become hidden hard dependencies.

## Safety invariant

Optional features remain optional, but once a feature or repair condition invokes an OEM/ADAS/structural/EV-HV safety requirement, the safety gate cannot be suppressed by a carrier rule, entitlement or automation setting.

## Provider neutrality

Domain adapters are not vendor adapters. MOTOR, OEM publishers, parts networks, valuation providers, property pricing systems and other data vendors connect through the governed provider adapter contract and must pass production certification before use.
