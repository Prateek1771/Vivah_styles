# VivahStyle

Staff-operated **in-store** platform for Indian wedding fashion boutiques. It is **not an ecommerce site** — customers never use it directly; store staff drive every interaction on tablets and desktops.

VivahStyle combines AI inventory management (Groq Vision auto-fill), guided customer styling sessions, a virtual try-on, billing, returns, and a sales dashboard into one in-store app — turning the usual "show random dresses" consultation into a structured flow: **onboard → explore → AI-suggested matches → try-on → bill → analyze.**

> **Status:** Complete — all 16 features shipped and verified (Phases 1–3). Full build log in [`context/progress-tracker.md`](context/progress-tracker.md).

---

## Table of Contents

- [The Problem](#the-problem)
- [Architecture](#architecture)
- [Stack](#stack)
- [Roles](#roles)
- [Core Flow](#core-flow)
- [Features](#features)
- [The Scoring Engine & Skin-Tone Matching](#the-scoring-engine--skin-tone-matching)
- [Data Model](#data-model)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Demo Login](#demo-login)
- [Invariants & Conventions](#invariants--conventions)
- [Documentation](#documentation)

---

## The Problem

Most wedding boutiques run consultations ad-hoc: a customer walks in, staff ask a few questions, show random dresses, and the customer leaves overwhelmed. VivahStyle replaces that with a guided ~2-minute onboarding, a smart-filtered inventory grid, AI-matched suggestions per customer, and a virtual try-on — so the store gains structured customer data, faster consultations, higher conversion, and visibility into what actually sells.

---

## Architecture

![VivahStyle architecture diagram](public/readme-architecture.png)

Visitors land on a static **marketing page** (`public/index.html`, served at `/`), pass the **demo email-OTP gate** (`/try` → `api/demo/*`, `demo_visitors` table, `vivah_demo` cookie), then reach the **store gate** (`/login`). `proxy.ts` (Next 16's middleware convention) is the role gate for all routes. Authenticated, role-gated pages live under a single `app/(app)/` group (dashboard, inventory, explore, billing, returns, onboarding, settings) sharing one `layout.tsx + Navbar`. Pages call **route handlers** in `app/api/` (auth, inventory, recommendations, tryon, couple) and **server actions**, which in turn use **core logic** in `lib/`:

- `lib/auth.ts` — HMAC session signing + `requireRole()` guards
- `lib/scoring/` — **pure** match logic (engine · couple · matrices · attributes · buckets)
- `lib/insforge/` — DB + storage access (`client.ts`, `server.ts`, `storage.ts`)
- `lib/constants.ts` (enums), `lib/format.ts` (`formatINR`), `lib/posthog.ts` (7 events)

External services: **InsForge** (Postgres DB + storage), **Groq Vision** (inventory auto-fill), **OpenAI gpt-image-2** (virtual try-on), **PostHog** (analytics). Detailed boundaries, data-flow diagrams, and the full schema are in [`context/architecture.md`](context/architecture.md).

---

## Stack

| Layer | Tool |
|---|---|
| Framework | **Next.js 16** (App Router) + **React 19** |
| UI | **Tailwind CSS v4** — tokens in `app/globals.css` via `@theme`; Playfair Display (headings) + Inter (body) |
| Database / Storage | **InsForge** (`@insforge/sdk`) — Postgres + file buckets |
| Inventory auto-fill | **Groq Vision** via `groq-sdk` (`meta-llama/llama-4-scout-17b-16e-instruct`) |
| Virtual try-on | **OpenAI gpt-image-2** (`/v1/images/edits`, called via plain `fetch` — no OpenAI SDK) |
| Charts | **Recharts** (financial dashboard) |
| Recommendations | Internal `lib/scoring/` — deterministic weighted matching, **no LLM** |
| Analytics | **PostHog** — 7 fixed product events |
| Auth | Custom HMAC cookie session + `bcryptjs` password hashing (no third-party auth lib) |

No component libraries (shadcn/MUI), no state managers — by design.

---

## Roles

Access is role-based, resolved from the password entered at the store gate. `proxy.ts` enforces per-route access, and every server action / route handler re-checks via `requireRole()`.

| Role | Device | Can do |
|---|---|---|
| **Stylist** | Tablet | Customer onboarding, explore inventory, Shop Suggested, virtual try-on |
| **Cashier** | Tablet / desktop | Billing, returns |
| **Owner** | Desktop | Inventory CRUD, Groq auto-fill, financial dashboard, billing, returns, staff & store settings |

On login each role lands on its home page: Stylist → `/onboarding`, Cashier → `/billing`, Owner → `/dashboard`.

---

## Core Flow

```
Landing page (/)  →  Demo OTP gate (/try)  →  Store gate (/login)
                                          ↓
              Onboarding (~2 min)  →  Explore grid
                                          → "Shop Suggested" (AI-scored matches)
                                          → Dress detail + ✨ Virtual Try-On
                                          → Billing  →  Dashboard
```

| Page | Route | Roles |
|---|---|---|
| Marketing landing page | `/` (static `public/index.html`) | Everyone |
| Demo email-OTP gate | `/try` | Everyone (pre-auth) |
| Store gate | `/login` | Everyone (pre-auth) |
| Customer onboarding | `/onboarding` | Stylist, Owner |
| Explore grid | `/explore` | Stylist, Owner |
| Dress detail + try-on | `/explore/[id]` | Stylist, Owner |
| Billing / invoice | `/billing` | Cashier, Owner |
| Returns | `/returns` | Cashier, Owner |
| Financial dashboard | `/dashboard` | Owner |
| Inventory table / add / edit | `/inventory`, `/inventory/new`, `/inventory/[id]/edit` | Owner |
| Store config + staff | `/settings` | Owner |

---

## Features

- **Store gate auth** — store code + per-staff password, role-based routing
- **Inventory management** — table UI + CRUD, with **Groq Vision auto-fill**: drop a dress photo and name / category / gender / colors / occasion tags / fabric / suggested price are populated (all editable)
- **Customer onboarding** — single-page form (name, age, shopping-for, multi-select occasions, category preference, optional skin tone, couple-combo toggle, price range) → creates a `styling_sessions` row
- **Explore grid** — sort + filter (gender, category, color, price); **"Shop Suggested"** runs the scoring engine and filters to matched items with a score badge
- **Virtual try-on** — "✨ Preview My Look": customer photo (with consent) + garment → gpt-image-2 preview, plus a per-session try-on gallery. Works in a styling session *or* as an ad-hoc walk-in preview.
- **Couple combo matching** — for couples, find harmonious bride + groom outfit pairs (color harmony, theme, fabric), plus a real-photo inspiration gallery whose looks can be **tried on directly** — one generation dresses both partners from the couple photo
- **Billing** — `dress_id` cart, quantity per line, payment modes (Cash / UPI / Card / Net Banking) with mode-specific field; tax computed server-side; printable invoice. **No payment is processed — record-keeping only.**
- **Returns** — simple `dress_id` + notes form (record-only in V1; stock is reconciled manually)
- **Financial dashboard** — revenue, order count, AOV, revenue-by-payment-mode chart, recent bills, returns count, stock summary

**Out of scope (V1):** public storefront/ecommerce, rentals, appointment scheduling, payment gateway, customer self-service, multi-store SaaS, SMS/WhatsApp.

---

## The Scoring Engine & Skin-Tone Matching

`lib/scoring/` is **pure** — no DB, no fetch, no randomness — so it's deterministic and testable. `recommend()` hard-filters by gender/category/availability/budget, then scores remaining items; everything scoring ≥ 60 is returned (no hard cap) and shown with a match badge and reason chips.

One component is **color fit by skin tone**. When a customer's skin tone is collected during onboarding (optional — fair / wheatish / medium / tan / deep), `scoreColor()` rewards items carrying a flattering color for that tone (and for the occasion), using the `SKIN_TONE_COLORS` and `OCCASION_COLORS` matrices in `lib/scoring/matrices.ts`. When skin tone is null (skipped / kids / couple), it falls back to a flat neutral score — zero regression. The matrices are derived from a color-theory reference like this:

![Colours that suit different skin tones](public/readme-skin-tone-colors.jpeg)

Couple matching (`lib/scoring/couple.ts`) scores partner outfits as `0.6 × coupleCompatibility + 0.4 × individual`, where compatibility blends a color-harmony matrix, theme, and fabric.

---

## Data Model

All data lives in **InsForge** (Postgres). Core tables:

| Table | Purpose |
|---|---|
| `store_settings` | Single store row (code, name, currency, tax %) |
| `staff` | Role-bearing accounts; `password_hash` (bcrypt), `role`, `active` |
| `inventory_items` | All dresses, keyed by unique `dress_id`; `details jsonb` for the rich detail page |
| `styling_sessions` | Onboarding data; anchors recommendations + try-ons |
| `recommendations` | Scored item list per session (Shop Suggested) |
| `tryons` | Generated try-on previews (`generating` → `ready` / `failed`) |
| `bills` + `bill_items` | Billing records; `bill_number` serial invoice number |
| `returns` | Simple record-only returns |
| `demo_visitors` | Email-OTP demo gate visitors (`/try`) |

**Storage buckets:** `inventory-images` (public), `customer-photos` (private), `tryon-previews` (private).

Full column-level schema in [`context/architecture.md`](context/architecture.md).

---

## Project Structure

```
app/
  login/                    → Store gate (staff login)
  try/                      → Demo email-OTP gate
  (app)/                    → All role-gated pages (one group, role-aware nav)
    dashboard/ inventory/ explore/ billing/ returns/ onboarding/ settings/
  api/                      → auth · demo(request-otp,verify-otp) · inventory(autofill,lookup)
                              · recommendations · tryon · couple
components/                 → ui/ layout/ auth/ inventory/ billing/ explore/ dress/
                              onboarding/ dashboard/ returns/ settings/ · PostHogProvider.tsx
lib/
  insforge/                 → client.ts · server.ts · storage.ts · types.ts
  scoring/                  → engine.ts · couple.ts · matrices.ts · attributes.ts · buckets.ts
                              · types.ts · *_check.mjs self-checks  (PURE)
  auth.ts · constants.ts · format.ts · posthog.ts · couple-looks.ts
proxy.ts                    → role gate (Next 16 middleware convention)
scripts/                    → seed.mjs · import-core.mjs · import-dresses.mjs · enrich-dresses.mjs
context/                    → project docs (see below)
public/                     → index.html (landing page) · images · skintones/ · couples/
```

> Note: the auth model uses a **single `(app)` route group** with role-aware nav rather than the three groups (`(admin)`/`(cashier)`/`(stylist)`) shown in older docs — Next.js forbids two route groups resolving to the same URL path. See `progress-tracker.md` (Feature 02).

---

## Setup

```bash
npm install
node --env-file=.env.local scripts/seed.mjs   # seed store + staff (idempotent)
npm run dev
```

Scripts: `npm run dev` · `npm run build` · `npm run start` · `npm run lint` · `npm run typecheck`.

### Environment variables (`.env.local`)

```
NEXT_PUBLIC_INSFORGE_URL
NEXT_PUBLIC_INSFORGE_ANON_KEY
INSFORGE_API_KEY          # server only — privileged key for storage writes
OPENAI_API_KEY            # server only — gpt-image-2 virtual try-on
GROQ_API_KEY              # server only
SESSION_SECRET            # server only — HMAC session signing
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
```

`GROQ_API_KEY`, `OPENAI_API_KEY`, `INSFORGE_API_KEY`, and `SESSION_SECRET` are **server-only** — never shipped to the client bundle.

### Seeding inventory (optional)

```bash
node --env-file=.env.local scripts/import-core.mjs   # 25 women + 20 men items with Groq-vision metadata
```

---

## Demo Login

Visit `/try` for the guided demo gate (email OTP), or go straight to the store gate at `/login`.

Store code: `VIVAH01`

| Role | Password |
|---|---|
| Owner | `owner123` |
| Cashier | `cashier123` |
| Stylist | `stylist123` |

> Seeded by `scripts/seed.mjs`. **Demo only — change these before any real deployment.**

---

## Invariants & Conventions

1. `lib/scoring/` is **pure** — same inputs, same outputs; no DB, no fetch, no randomness.
2. Role checks happen in `proxy.ts` **and** in every server action / route handler (`requireRole()`).
3. `GROQ_API_KEY` and `OPENAI_API_KEY` are **server-side only**; the client never calls either directly.
4. All enum strings (categories, occasions, payment modes, statuses) come from `lib/constants.ts` — one source of truth.
5. Prices are stored as ₹ numerics and rendered with `formatINR()` from `lib/format.ts`.
6. `dress_id` is unique, never reused — the primary lookup key for billing and returns.
7. Staff passwords are stored as bcrypt hashes; plaintext is never written to the DB.
8. No hex values in components — design tokens only (`context/ui-tokens.md`).

---

## Documentation

Detailed specs live in `context/` (linked, not duplicated here):

| Doc | Purpose |
|---|---|
| [`context/project-overview.md`](context/project-overview.md) | What the app is, user types, pages, flows |
| [`context/architecture.md`](context/architecture.md) | Stack, folder structure, DB schema, API patterns |
| [`context/build-plan.md`](context/build-plan.md) | Feature specs (01–16) |
| [`context/code-standards.md`](context/code-standards.md) | TypeScript rules, file naming, components, errors |
| [`context/ui-tokens.md`](context/ui-tokens.md) | Design tokens |
| [`context/ui-registry.md`](context/ui-registry.md) | Existing components |
| [`context/library-docs.md`](context/library-docs.md) | InsForge, Groq, gpt-image-2, PostHog usage |
| [`context/progress-tracker.md`](context/progress-tracker.md) | Build status & decisions |

See also [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) for the agent-facing reference.
