# Excel Sheet Mapping

Source file: `SK MOBILE SHOP MAY (Autosaved).xlsx`

## Sheet → Database

| Sheet | Purpose | Import target |
|-------|---------|---------------|
| Sheet1 | Dashboard summary (formulas) | Computed via `getDashboard()` — not imported directly |
| Sheet2 | Money transfer daily grid | `MoneyTransferDay` (columns 1–14 = DMT services) |
| Sheet3 / Recharge | Operator daily totals | `RechargeDay` (18 operator columns) |
| Repair | Daily repair totals | `RepairDay` via `RepairJob` rollup |
| Mobile | Accessories sales | `MobileAccessoryDay` via `Sale` rollup |

## Golden validation (May 2026)

| Metric | Expected |
|--------|----------|
| Total income | 127352.03 |
| Net profit | 925633.03 |
| Recharge+Transfer profit | 49142.03 |

Import API: `POST /api/v1/import/excel` returns `validation` object with match flags.

## Operational layer

New entries use:

- `RechargeEntry` → rolls up to `RechargeDay`
- `TransferEntry` → rolls up to `MoneyTransferDay`
- `RepairJob` → rolls up to `RepairDay`
- `Sale` / `SaleLine` → rolls up to `MobileAccessoryDay`
