# Wysta — E2E Tests (Playwright)

End-to-end tests for the web build of the Wysta app, running against a Convex
dev deployment.

## Prerequisites (one-time)

```bash
# 1. Install Playwright browsers
bunx playwright install chromium

# 2. Enable the test-only Convex module on your dev deployment
bunx convex env set CONVEX_E2E_ENABLED true
```

`CONVEX_E2E_ENABLED=true` unlocks `convex/testing.*` (reset, seed, etc.) on
the targeted deployment. **Never set this on the production deployment.**

## Running the suite

```bash
# Full suite
bun run test:e2e

# Single file / directory
bun run test:e2e e2e/tests/auth/login-patient.spec.ts
bun run test:e2e e2e/tests/patient

# Headed (see the browser)
bun run test:e2e:headed

# UI mode (Playwright inspector)
bun run test:e2e:ui
```

The Playwright config auto-starts `bun run web --port 8091` (Expo for web)
with `EXPO_PUBLIC_E2E=true`. Convex is the dev cloud deployment from
`.env.local` (`fiery-toucan-646` by default). Override with
`EXPO_PUBLIC_CONVEX_URL=...` to point at a different backend.

## Layout

```
e2e/
  global-setup.ts          # resets Convex + seeds users + content before suite
  fixtures/                # sample-image.png, sample-document.pdf
  helpers/
    auth.ts                # loginAs, loginViaUI, logoutViaBridge, gotoApp
    convex.ts              # ConvexHttpClient wrappers around testing.*
    triage.ts              # answerTriage(page, {topic, target}) — dynamic
    conversation.ts        # sendMessage, attachImage, attachDocument
  tests/
    auth/                  # 9 tests   — signup/login/guest/logout
    patient/               # 10 tests  — triage, conversations, education, profile, uploads
    professional/          # 5 tests   — queue, thread, internal notes, escalate, close
    admin/                 # 4 tests   — bootstrap, roles, search, seed
```

## Test data

Global setup wipes domain + auth tables, then seeds:

| Email                    | Password      | Role         | Notes                                    |
| ------------------------ | ------------- | ------------ | ---------------------------------------- |
| `patient-a@e2e.local`    | `e2e-test-pw` | patient      | Profile populated (Maria, 26-35, etc.)   |
| `patient-b@e2e.local`    | `e2e-test-pw` | patient      | Used by tests that mutate roles          |
| `prof-a@e2e.local`       | `e2e-test-pw` | professional | Auto-verified                            |
| `admin@e2e.local`        | `e2e-test-pw` | admin        |                                          |

Tests create their own conversations via `seedConversation()` to avoid
cross-test interference. The bootstrap admin spec runs serial with its own
reset/teardown.

## TestID conventions

`testID="<area>-<element>[-<key>]"`. React Native renders `testID` as
`data-testid` on web; tests use `page.getByTestId(...)`. See
`docs/superpowers/specs/2026-05-04-e2e-playwright-design.md` for the full
inventory.

## Known web-only quirks

- **`Alert.alert` is not interactive on web.** RN-web maps multi-button alerts
  to `window.alert` (single button). Tests that need to confirm a destructive
  action (logout, role change) handle this either by accepting the dialog
  (`page.once('dialog', d => d.accept())`) or bypassing UI through the
  `__E2E_AUTH__` bridge.
- **Route groups don't appear in URLs.** `/(admin)/index.tsx` renders at `/`,
  so URL-based assertions for groups don't work — assert on a unique element
  on the target screen instead.

## Troubleshooting

- **"Could not find public function for `testing:resetAll`"** — run
  `bunx convex dev --once` to push the latest code to the deployment.
- **"convex/testing.* is gated by CONVEX_E2E_ENABLED"** — set the env var
  on the deployment (`bunx convex env set CONVEX_E2E_ENABLED true`).
- **Webserver port collision** — another Expo dev server may be on 8091.
  Stop it or change `PORT` in `playwright.config.ts`.
