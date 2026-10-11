# ProcureLab

ProcureLab is a multi-market vendor management and RFP platform with three roles: administrator, procurement manager and vendor. It is the system under test for the agentic test automation platform demo.

It covers 4 markets (NL, BE, DK, DE) and 4 languages (English, Dutch, Danish, German). All companies and people in it are fictional.

The full step-by-step guide is `docs/ProcureLab-Installation-Guide.pdf`.

## Quick start

```bash
npm install
npm start            # http://localhost:3000
```

On first start the app creates `data/` with JSON files and demo PDFs.

**Login:** `admin@procurelab.test` / `Demo123!`

## Accounts

All demo accounts use the password `Demo123!`.

| Email | Role | Notes |
|---|---|---|
| admin@procurelab.test | Administrator | Everything a procurement manager can do, plus Users and Data |
| buyer@procurelab.test | Procurement manager | Dashboard, projects, vendors, RFPs, comparison |
| vendor.nl@ / vendor.be@ / vendor.dk@ / vendor.de@procurelab.test | Vendor | Vendor portal only, locked to its own company and market |
| locked@procurelab.test | Procurement manager (deactivated) | Login is refused with a "deactivated" message |

## Where data is stored

| Path | Contents |
|---|---|
| `data/users.json` | Users. Passwords are scrypt-hashed and never stored in plain text |
| `data/vendors.json`, `projects.json`, `requirements.json`, `rfps.json`, `proposals.json`, `questions.json`, `activity.json` | One JSON file per collection |
| `data/files.json` | Metadata for every uploaded file: name, size, owner, uploaded by |
| `data/uploads/` | The uploaded files themselves |
| `data/meta.json` | ID counters and the last-saved time |

**How saving works.** Every change is written immediately, and atomically: the app writes a temp file, then renames it. Restarting the app keeps all data. If you open `data/users.json` right after creating a user in the UI, the new user is there.

**Resetting.** Admins can reset from **Data → Reset demo data**. From the command line, use `npm run reset-data`. Deleting the `data/` folder also works; the demo data is recreated on the next start.

**Changing the location.** Set `DATA_DIR` to store data elsewhere, for example a mounted disk.

## Features

| Area | What you can do | Good test scenarios |
|---|---|---|
| Dashboard | KPI cards (projects, active RFPs, proposals, vendors) and recent activity per market | KPIs match `/api`, activity appears after an action, role permissions |
| Projects | Create, edit, archive and restore, search, filter by status | Mandatory fields, end date before start date, duplicate name per market |
| Requirements | Add and remove requirements with Must, Should or Could priority | An RFP is blocked until the project has a requirement |
| Vendors | Add, remove, search, filter by expertise and minimum rating, view details, assign to a project | Validation, assignment shows on the project |
| RFPs | Choose requirements, invite vendors, set a deadline, upload attachments | Upload type and size limits, invitation count |
| Vendor portal | My RFPs, requirements, document download, questions, proposal with price, delivery and documents | Multi-role flow, duplicate proposal (409), closed RFP, not-invited RFP (404) |
| Comparison | Sort, filter by rating, open a proposal, compare 2–3 side by side, select or reject | Selecting one marks the others "not selected" |
| AI Proposal Analyzer | Score, risk level and missing-information flags; optional LLM summary | Exact scores, recommended badge, missing document raises risk |
| Users (admin) | Create admin, procurement or vendor users; activate and deactivate | User is saved to `users.json`, a deactivated user is signed out immediately |
| Data (admin) | See JSON files and record counts, download a JSON export, reset demo data | Counts change after actions; the export contains no password hashes |

**Downloads are permission-checked.** A vendor can download documents of RFPs they are invited to and their own proposal files, never a competitor's.

## Markets, languages and flags

| Market | Default language | Currency | VAT | vatBreakdown | aiAnalyzer | vendorQuestions |
|---|---|---|---|---|---|---|
| NL | nl | EUR | 21% | on | on | on |
| BE | nl | EUR | 21% | off | off | on |
| DK | da | DKK | 25% | on | on | off |
| DE | de | EUR | 19% | on | off | off |

**Formatting locale.** Number and date formatting combines the UI language with the market: `en-DK` means English text with Danish currency and dates.

**Switching market.** This resets the language to that market's default. Adding `?lang=` overrides it.

## Test hooks

**Deep links.** `?market=DK` and `?lang=en`. Vendor users ignore `?market`.

**Flag overrides per session.**
- `?ff_vatBreakdown=on|off`
- `?ff_aiAnalyzer=on|off`
- `?ff_vendorQuestions=on|off`
- `?ff_reset=1` clears all overrides.

**Stable selectors.** Every interactive and asserted element has a `data-testid`. `<body>` also exposes `data-market`, `data-lang`, `data-locale` and `data-role`.

**Intentional defect.** The German "Send RFP" button is left in English. Your LLM-as-judge translation check should catch it.

**Seeded data.**
- Each market has an open RFP where its vendor login has been invited but hasn't responded yet.
- Each market also has a closed RFP.
- NL "Cloud Migration RFP" has 3 proposals. One of them (DigitalWorks) has no document, so the analyzer flags it.

## Test data API

`/api/health`, `/api/config` and `/api/i18n` are public. Everything else requires the header `x-test-token: $TEST_API_TOKEN`.

| Method | Path | Notes |
|---|---|---|
| POST | /api/test/reset | Restore demo data |
| GET | /api/stats | Data files, record counts, upload size |
| GET / POST / DELETE | /api/users | POST takes `{name, email, role, market, vendorId?, password}` |
| GET / POST / DELETE | /api/projects | POST takes `{market, name, owner, budget, startDate, endDate, ...}`. DELETE cascades to RFPs, proposals and files |
| POST | /api/projects/:id/requirements | `{name, priority}` |
| GET / POST / DELETE | /api/vendors | POST takes `{market, name, city, contact, expertise[], rating, ...}` |
| POST | /api/projects/:id/rfps | `{title, requirementIds[], vendorIds[], deadline}`. Past deadlines are allowed, for closed-RFP tests |
| POST | /api/rfps/:id/files | multipart, field `files` |
| GET | /api/rfps/:id | RFP with state, proposals, questions and files |
| POST | /api/rfps/:id/proposals | `{vendorId, priceNet, deliveryMonths, note?}` |

## Configuration

See `.env.example` for all variables: `APP_NAME`, `DATA_DIR`, `MAX_UPLOAD_MB`, `DEMO_PASSWORD`, `TEST_API_TOKEN`, `ANTHROPIC_API_KEY`, and more.

## Known limits

This is a demo application.
- It runs as a single process with JSON files and no database.
- There is no CSRF protection, no email delivery and no password reset flow.
- Uploads are checked by file extension and size, not scanned for viruses.
