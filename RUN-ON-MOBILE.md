# Run on a mobile phone (locally)

The games run in FrontendV2's iOS and Android app, inside one hidden, full-screen
`react-native-webview` WebView of the frame (`features/dailyGames/lib/components/DailyGamesHost/DailyGamesHost.tsx`).
A widget tap shows the WebView and sends `{ "game": "daily-wheel", "tier": "Ruby" }`; the frame
answers `"closed"` (through `window.ReactNativeWebView.postMessage`) when the player is done.
Prizes are the games' mocks: no balance changes.

The phone loads the frame from your Mac over the network, so the phone and the Mac must be able
to reach each other.

## 1. Once per machine

- Node 22.18 or later.
- The repos, cloned as in the [README](README.md), then `npm install` in this folder.
- FrontendV2 on `feat/frames`, with `npm install` done (needs a GitHub Packages token with
  `read:packages` in `~/.npmrc`).
- **iOS:** Xcode, CocoaPods (`cd FrontendV2/apps/mobile/ios && bundle exec pod install`), and your
  Apple team selected under *Signing & Capabilities* for the `BettyApp` target, so Xcode can
  install the app on your iPhone.
- **Android:** Android Studio's SDK and platform tools (`adb`), and *Developer options → USB
  debugging* turned on on the phone.
- A QA account.

## 2. Start the frame (this folder)

```sh
npm run frame:prod   # the built frame on port 8890  (measure with this one)
npm run frame        # or the dev server on port 8888, with live reload
```

Both listen on every network interface. Find the address the phone will use:

```sh
scutil --get LocalHostName    # e.g. Martins-MacBook-Pro  ->  Martins-MacBook-Pro.local
ipconfig getifaddr en0        # e.g. 192.168.1.20 (Wi-Fi)
```

Check from the phone's browser first: `http://Martins-MacBook-Pro.local:8890/frame/?game=daily-wheel`
should play the wheel. That page is also the **baseline** for the comparison: the same game in
the phone's browser, with no app or WebView around it.

## 3. Point the app at the frame

The app reads the frame's address from `FrontendV2/.env.qa` when it is **built**. Add (do not commit it):

```sh
NEXT_PUBLIC_DAILY_GAMES_URL=http://Martins-MacBook-Pro.local:8890/frame/
```

| Where the app runs | Address to use |
|---|---|
| iPhone (Wi-Fi) | `http://<LocalHostName>.local:8890/frame/` (or the Mac's IP) |
| Android phone (USB) | run `adb reverse tcp:8890 tcp:8890`, then `http://localhost:8890/frame/` |
| Android phone (Wi-Fi) | `http://<the Mac's IP>:8890/frame/` |
| iOS simulator | `http://localhost:8890/frame/` |
| Android emulator | `http://10.0.2.2:8890/frame/` |

Use port `8888` instead if you started `npm run frame`. Any change here needs a new native build
(step 4): Metro's reload does not re-read the env file.

## 4. Build and run the app (FrontendV2 folder)

Start Metro in one terminal:

```sh
npm run metro
```

**Android** (phone on USB):

```sh
npm run android        # the QA debug build (qadebug) on the connected phone
```

**iOS** (iPhone on USB or the same Wi-Fi): open `apps/mobile/ios/BettyApp.xcworkspace` in Xcode,
pick the **BettyQA** scheme and your iPhone, and press Run. (`npm run ios` runs the iPhone 16
simulator instead.)

Log in with the QA account, go to the lobby, and tap **Daily Wheel** or **Daily Scratcher**. QA
builds always show both widgets as ready, so you can open them again and again.

## Notes for the measurements

- **Inspecting the WebView.** Debug builds allow it (`webviewDebuggingEnabled`):
  - iPhone: Safari on the Mac → *Develop* → your iPhone → the frame's page (turn on *Settings →
    Safari → Advanced → Web Inspector* on the phone first). Its Timelines tab records frames,
    JavaScript and memory.
  - Android: Chrome on the Mac → `chrome://inspect` → the WebView → *inspect*; the Performance
    panel works as on desktop.
- **Debug vs release.** A debug build slows the app's own JavaScript (React Native's dev mode),
  not the game inside the WebView, which runs the same in both. For numbers about the app around
  the game (tap to show, memory of the whole app) use a release build:
  - Android: `npm run android:qa:release -w @betty/app`. Release builds refuse plain `http`, so
    the frame must be `https`: run `cloudflared tunnel --url http://localhost:8890`
    (`brew install cloudflared`) and use the `https://….trycloudflare.com/frame/` address it prints.
  - iOS: in Xcode, *Product → Scheme → Edit Scheme → Run → Build Configuration → **QARelease***
    (not *Release*, which reads `.env` instead of `.env.qa`). iOS allows `http` to `.local` names
    in release too.
  - Release builds cannot be inspected with Safari or `chrome://inspect`; use Xcode Instruments
    or Android Studio's profiler.
- **The WebView is loaded at startup and stays loaded**, hidden, so a tap only shows it. Its page
  load is part of the app's startup, not of the tap.

## If something is off

- **The phone's browser cannot open the frame:** the phone and the Mac are not on the same
  network, or the network keeps devices apart (common on office and guest Wi-Fi). Use USB with
  `adb reverse` on Android, a phone hotspot, or the `cloudflared` tunnel above.
- **The game never opens in the app, but works in the phone's browser:** the app was built
  before `.env.qa` was changed. Rebuild (step 4).
- **A blank WebView on iOS with an IP address:** use the `.local` name instead.
- **Metro not found on the phone:** the phone must reach the Mac on port 8081 too; on Android
  USB, `npm run android` sets up `adb reverse` for it.
