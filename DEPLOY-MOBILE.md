# Deploy the mobile app for the performance tests ("Betty Perf")

A separate app, **Betty Perf**, built from FrontendV2 on `feat/frames`. It installs **next to**
Betty QA (its own app ID, `ca.betty.app.qa.perf`), talks to QA's backend, and loads the games from
the deployed frame. Nothing goes through FrontendV2's CI, Firebase App Distribution or the QA
testers, and the installed Betty QA app is left alone.

| | Android | iOS |
|---|---|---|
| App ID | `ca.betty.app.qa.perf` | `ca.betty.app.qa.perf` |
| Build | `npm run android:perf` on your Mac | Xcode, *QARelease* with a changed bundle ID |
| Reaches the phone as | an APK file you send | installed from Xcode on a connected iPhone |
| Push notifications | no | no |

Firebase: Betty Perf ships QA's Firebase config, so its analytics, perf and push calls may be
rejected. The app itself runs normally.

## Before you build

1. **Deploy the frame** and check it plays:
   `npm run frame:deploy` here, then `https://test-liveops-frame.pages.dev/frame/?game=daily-wheel`.
   The app is a release build: Android refuses plain `http`, so the frame must be on `https`.
2. **The app takes the frame's address from FrontendV2:** `NEXT_PUBLIC_DAILY_GAMES_URL` in
   `FrontendV2/.env.qa` if set, else `https://test-liveops-frame.pages.dev/frame/`
   (`features/dailyGames/lib/config.ts`). **Remove any local address you put in `.env.qa`** for
   the local guide (`…local:8890`): it would be built into the app you send.
3. FrontendV2 on `feat/frames` with `npm install` done.

## Android

```sh
cd FrontendV2/apps/mobile
npm run android:perf
```

The APK is `apps/mobile/android/app/build/outputs/apk/qa/perf/app-qa-perf.apk`.

- **Install on a phone on USB:** `adb install -r android/app/build/outputs/apk/qa/perf/app-qa-perf.apk`
- **Send it:** share the file (Slack, Drive, email). On the phone, open it and allow *Install
  unknown apps* for the app it was opened from.

It's signed with the debug key, so no release keystore is needed, and it installs next to Betty QA.

## iOS

An iPhone app can only be installed from Xcode on iPhones your Apple team knows, and only under a
bundle ID the team has. Xcode registers both by itself if your Apple account in Betty's team
(RB324AL8QZ) may create identifiers (the *Admin* or *App Manager* role, or *Developer* with access
to Certificates, Identifiers & Profiles). If it may not, ask an admin to do steps 3–4 once.

1. `cd FrontendV2/apps/mobile/ios && bundle exec pod install`, then open `BettyApp.xcworkspace`.
2. *Product → Scheme → Edit Scheme… → Run → Build Configuration → **QARelease***.
   (QARelease reads `.env.qa`; plain *Release* reads `.env` and would break the app.)
3. Target **BettyApp** → *Build Settings*, row *Product Bundle Identifier*, **QARelease** only:
   `ca.betty.app.qa.perf`. Row *APP_DISPLAY_NAME*, **QARelease** only: `Betty Perf`.
4. Target **NotificationService** → *Product Bundle Identifier*, **QARelease** only:
   `ca.betty.app.qa.perf.NotificationService`.
5. Both targets → *Signing & Capabilities* → *Automatically manage signing* on, team **Betty**.
   Xcode registers the new IDs (with their push, app group and associated-domain capabilities).
   If it refuses a capability for lack of rights, remove that capability for the perf build: the
   test does not need it.
6. Connect the iPhone (trust the Mac; on iOS 16+ turn on *Settings → Privacy & Security →
   Developer Mode*), pick it as the run destination, press **Run**. It installs as **Betty Perf**
   next to Betty QA.
7. Undo the project edits so they never get committed:
   `git checkout -- apps/mobile/ios/BettyApp.xcodeproj` (from FrontendV2).

Each tester's iPhone is connected to a Mac and installed this way (the architect can run the same
steps on their Mac). Sending an iOS app as a file (ad hoc, TestFlight) needs the team's
distribution certificates and profiles: that is the CI route, which this deliberately avoids.

## On the phone

Open **Betty Perf**, log in with a QA account, go to the lobby and tap **Daily Wheel** or
**Daily Scratcher** (always ready in QA builds). Prizes are the games' mocks: no balance changes.

For the comparison, open `https://test-liveops-frame.pages.dev/frame/?game=daily-wheel` in the
phone's browser: the same game with no app and no WebView around it.

Being release builds, Betty Perf cannot be inspected with Safari's Web Inspector or
`chrome://inspect`: profile it with Xcode Instruments or Android Studio's profiler. For the
WebView's own timeline, use a debug build ([RUN-ON-MOBILE.md](RUN-ON-MOBILE.md)).
