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

Deploy the frame: `npm run frame:deploy` (first time: `npx wrangler login`), then
`https://test-liveops-frame.pages.dev/frame/`.

The performance-test guides (deploying FrontendV2 and the Betty Perf app, running locally,
measuring on web and mobile) live in FrontendV2, branch `feat/frames`, folder `perf-test/`.
`perf/frame-perf.js` here is the same probe as `perf-test/frame-perf.js` there: keep them identical.
