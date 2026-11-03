# MoneroFlow Cross-Platform App — Architecture

## 1. Goal

Build a brand-new cross-platform MoneroFlow app (iOS + Android + Web) whose UI is the
existing, working MoneroFlow React frontend, wrapped in a Capacitor native shell. We
borrow **the structure** of Cake Wallet's UI framework and **the plumbing** of its
native shell, but **Monero colours are the dominant and only theme** — Cake's blue is
never used.

## 2. Origin of the source (REA reverse-engineering)

`../reverse-engineering/REVERSE-ENGINEERING.md` (produced via the REA MCP tool against
Cake_Wallet_v6.5.2-arm64-v8a.apk) concludes:

- Cake Wallet is a **Flutter AOT app**. Its UI framework = Flutter + a Material 3
  design system defined in Dart. JADX sees only the native shell (MainActivity +
  platform plugins); the widget/theme Dart is in `libapp.so` (not JADX-readable), so
  the design system is recovered from the open-source repo (`lib/themes/`).
- Native shell: one `MainActivity extends FlutterActivity` with ~8 private
  MethodChannel helpers — i.e. a thin **platform-channel bridge** for device
  capabilities only. No bespoke UI in Java.
- Plugins (the "plumbing"): inappwebview, imagepicker, share_plus, url_launcher,
  camera, biometrics (fingerprint + Face ID), background work, Room DB, boot-restore.
- Design language: Material 3 (`useMaterial3: true`), radius ~12 (cards) / 18
  (buttons, inputs), elevation 0-1, font Wix Madefor Text + IBM Plex Mono, theme
  families Light/Dark/Black with a `ThemeStore` for persistence.

We adopt this *pattern* in React:

- Material-3-style token slots → Tailwind CSS variables (`--primary/--accent/
  --background/--foreground/--surface*`).
- Thin native shell → Capacitor + `src/lib/native.ts`.
- Light/Dark theme persistence → React theme toggle backed by `localStorage`
  (`mf-theme`), restricted to Monero palette.

## 3. Directory map

```
moneroflow-app/
├── reverse-engineering/          # REA findings + vendored Cake Dart design-system files
└── app/                          # the cross-platform app
    ├── src/                      # full MoneroFlow React frontend (verbatim from xmr-pay-hub-on-akash)
    │   ├── App.tsx               # HashRouter + all routes (unchanged routes, changed router)
    │   ├── index.css             # Monero-only Tailwind theme tokens + utilities
    │   ├── main.tsx              # mount + native-bridge init + runtime detection
    │   ├── lib/native.ts         # ★ native bridge (the plumbing layer)
    │   ├── components/, pages/, hooks/, lib/, ui/   # unchanged app code
    ├── android/                  # Capacitor-generated Gradle project
    ├── ios/                      # Capacitor-generated Xcode project
    ├── dist/                     # webDir build output (Capacitor webDir)
    ├── capacitor.config.ts       # appId com.moneroflow.app, webDir dist, dark bg, plugins
    └── package.json / vite.config.ts / tailwind.config.ts
```

## 4. Key decisions

### 4.1 HashRouter (native deep links)
`BrowserRouter` does not work under Capacitor Android's `https://localhost` scheme /
iOS `capacitor://` scheme because there is no real server to serve deep-link paths.
Switched to React Router `HashRouter` so `/pay/:id/...` etc. resolve from the single
bundled `index.html`. **All route URLs are unchanged** (only the router type changed).

### 4.2 Relative asset base
`vite.config.ts` sets `build.base = './'` so the built `index.html` references assets
relatively, loadable from the native `file://`/`capacitor://` webview. This is the
standard Capacitor requirement.

### 4.3 Monero-only theme
- The base palette is Monero (dark charcoal + monero orange `24 100% 50%`), inherited
  from the working app.
- The dashboard theme picker was trimmed to **Dark / Light only** (removed rose,
  lavender, mint, peach alternates) in `DashboardLayout.tsx`.
- Tron-branded payment/POS pages keep MoneroFlow's own USDT palette (that palette is
  the app's, not Cake's).
- No Cake colour (`#2D9EFA`) appears anywhere.

### 4.4 Native bridge isolation
All device capability lives in `src/lib/native.ts`. React components never import
Capacitor directly. Each method feature-detects:
`Capacitor.isNativePlatform()` → plugin, else Web API fallback. This keeps the browser
build fully functional and makes the native layer swappable.

## 5. Native shell (the "plumbing")

- `android/app/src/main/java/com/moneroflow/app/MainActivity.java` extends
  `BridgeActivity` (Capacitor's standard — analogous to Cake's FlutterActivity).
- appId `com.moneroflow.app`, monero charcoal `#0a0a0a` splash + webview background.
- 6 plugins: browser, camera, network, share, toast, capgo native-biometric.
- Permissions (camera, biometric) are applied by the plugins' AndroidManifest /
  iOS Info.plist at compile time; `cap sync` keeps them current.

## 6. Build & run matrix

| Target | How | Where |
|--------|-----|-------|
| Web     | `npm run dev` / `npm run build` | this host |
| Sync    | `npm run build && npx cap sync` | this host (copies dist → android+iOS) |
| Android | `npx cap open android` → Run | build machine w/ Android Studio + JDK + SDK |
| iOS     | `npx cap open ios` → Run | macOS w/ Xcode |

This host has no JDK/Android SDK/Xcode, so the Android APK / iOS IPA are compiled on a
proper build machine (user self-deploys) or in CI. All scaffolding, plugin wiring, and
web-asset sync are complete.

## 7. Next steps (when continuing)

1. Wire `native.biometricUnlock` into an App-Lock gate (Cake-style) on the dashboard.
2. Wire `native.pickImage` + a QR decoder (jsQR) for scan-to-pay.
3. Move secure key storage from `localStorage` to a keystore-backed plugin
   (e.g. capacitor-secure-storage) for the self-custody wallet.
4. Set real Android `scheme` + iOS URL Scheme for universal payment links.
5. Icon / splash assets in Monero orange.
