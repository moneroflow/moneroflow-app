# MoneroFlow — Cross-Platform App

Brand-new cross-platform MoneroFlow application built **around the existing, working
React frontend** (`xmr-pay-hub-on-akash`) wrapped in a **Capacitor** native shell.

This is the "Option A" architecture: reuse the entire React codebase verbatim, add a
thin native app-shell (the analog of the platform-channel shell we reverse-engineered
from Cake Wallet), and enforce a **Monero-only** colour scheme.

## Layout

```
moneroflow-app/
├── reverse-engineering/      ← Cake Wallet UI-framework post-mortem (REA) + vendored Dart design system
└── app/                      ← THIS cross-platform app
    ├── src/                  ← the full MoneroFlow React frontend (copied from xmr-pay-hub-on-akash)
    │   └── lib/native.ts     ← the native bridge (Capacitor plumbing layer)
    ├── android/              ← generated Android Studio project (Gradle)
    ├── ios/                  ← generated Xcode project
    ├── dist/                 ← production web build (webDir for Capacitor)
    ├── capacitor.config.ts   ← app id/name, webDir, dark #0a0a0a bg, plugins
    └── package.json          ← npm scripts (build / cap:*)
```

## Tech stack

- React 18 + TypeScript + Vite 5 + Tailwind 3 + shadcn/ui (unchanged)
- monero-ts (in-browser Monero WASM), tronweb, ethers, qrcode.react (unchanged)
- Capacitor 8.6 (cross-platform native shell) + 6 native plugins
- React Router **HashRouter** (required for native `file://` webview deep links)

## Architecture: how Cake's UI framework maps to this app

From `reverse-engineering/REVERSE-ENGINEERING.md`: Cake Wallet = Flutter UI +
Material 3 design system + a thin native shell (MainActivity with platform channels)
for device capabilities. We adopt **the structure, not Flutter, and not Cake's colours**:

| Cake (REA findings)                           | MoneroFlow equivalent                          |
|-----------------------------------------------|-----------------------------------------------|
| Flutter widgets / Dart UI layer               | React components (unchanged)                  |
| Material 3 theme (`light_theme.dart` etc.)    | Tailwind design tokens in `src/index.css`     |
| `MainActivity` + platform-channel helpers     | `android/…/MainActivity.java` (BridgeActivity) |
| Plugins: inappwebview, imagepicker, share_plus, url_launcher, camera, biometrics | capacitor: browser, camera, share, network, toast, biometric |
| — native capabilities reachable from UI       | `src/lib/native.ts` bridge                     |

## Monero-only colour scheme

The user's hard requirement: **Monero colours are the dominant and ONLY scheme —
never Cake's blue.** This is enforced at two levels:

1. `src/index.css` — the base palette is Monero: dark charcoal background
   (`240 10% 3.9%`), primary/accent/ring = monero orange (`24 100% 50%`), with
   `.glow-orange` / `.text-gradient-orange` utilities. This file is inherited from
   the working MoneroFlow app — it never contained Cake colours.
2. `src/components/DashboardLayout.tsx` — the theme toggle now offers **only**
   Monero Dark and Monero Light. The non-Monero alternates (rose / lavender /
   mint / peach) were removed from the selector. Tron-branded payment/POS pages keep
   the app's own USDT branding (that is MoneroFlow's palette, not Cake's).

Cake's light/dark/black *theme-structure* pattern (surface / on-surface / primary /
accent tokens) maps onto Tailwind's `--background / --foreground / --primary / --accent`
slots, which the app already follows.

## Native plumbing (`src/lib/native.ts`)

Every capability auto-detects the runtime: native device → Capacitor plugin,
plain browser → Web API fallback. The same React code runs in both.

- `biometricUnlock(reason)` — fingerprint / Face ID (Cake app-lock analog); no-op on web
- `share(payload)` — native share sheet → Web Share API → (no browser fallback)
- `openExternal(url)` — Capacitor Browser → `window.open`
- `pickImage(forCamera)` — camera / photo picker → file-input fallback
- `toast(msg)` / `getNetworkStatus()` / `getItem/setItem/removeItem` (secure storage)

## Development workflow

```bash
# Web (browser dev loop) — unchanged
cd moneroflow-app/app
npm run dev            # http://localhost:8080

# Build web bundle + sync to both native platforms
npm run build
npx cap sync

# Android — needs Android Studio / JDK + SDK on a build machine
npx cap open android   # then Run ▶

# iOS — needs macOS + Xcode
npx cap open ios       # then Run ▶
```

> This host has **no JDK / Android SDK / Xcode**, so native binaries must be built on
> a machine with those (or in CI). The Android/iOS projects are fully scaffolded and
> `cap sync` keeps `dist/` assets in sync; only Gradle/Xcode compile is required.

## Self-deploy note

The React frontend talks to its own (`CREATOR_SERVER_FQDN`) backend and the Monero
remote-node manager. Those endpoints are unchanged from `xmr-pay-hub-on-akash`; the
native app reaches them over HTTPS (`androidScheme: 'https'`, `cleartext: false`).
See `src/lib/mock-data.ts` and `src/lib/node-manager.ts` for the current hosts.

## Docs

- `reverse-engineering/REVERSE-ENGINEERING.md` — Cake Wallet UI-framework post-mortem
- `ARCHITECTURE.md` — this app's structure + theming decisions
