# test-liveops-wrapper

The Daily Wheel and the Daily Scratcher in one static page (the frame), for measuring what
loading them in FrontendV2's iframe (web) or WebView (app) costs.

```sh
git clone https://github.com/martin-shahonov/test-liveops-wrapper.git
cd test-liveops-wrapper
git clone https://github.com/martin-shahonov/test-liveops-sdk.git
git clone https://github.com/martin-shahonov/test-liveops-mini-games.git
git clone https://github.com/martin-shahonov/test-liveops-assets.git test-liveops-mini-games/public/test-liveops-assets
npm install
npm run frame    # http://localhost:8888/frame/
```

Then in FrontendV2: `npm run web:pixi`. On its own: `http://localhost:8888/frame/?game=daily-wheel&tier=Diamond`.

`npm run frame:prod` serves the built frame on port 8890 (use it for measurements).

Step-by-step guides:

- [Run on web](RUN-ON-WEB.md): FrontendV2's web app, the games in an iframe.
- [Run on a mobile phone](RUN-ON-MOBILE.md): FrontendV2's iOS and Android app, the games in a WebView.
- [Measure the iframe's cost (web)](MEASURE-WEB.md): what to open, which tools, what matters; with the probe `perf/frame-perf.js`.
- [Deploy the mobile app](DEPLOY-MOBILE.md): "Betty Perf", a separate app next to Betty QA, for the test phones.
