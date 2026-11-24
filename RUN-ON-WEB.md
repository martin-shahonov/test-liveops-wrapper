# Run on web (locally)

The games run in FrontendV2's web app, inside one hidden full-window `<iframe>` of the frame.
A widget tap shows the iframe and sends `{ "game": "daily-wheel", "tier": "Ruby" }`; the frame
answers `"closed"` when the player is done. Prizes are the games' mocks: no balance changes.

## 1. Once per machine

- Node 22.18 or later.
- The repos, cloned as in the [README](README.md), then `npm install` in this folder.
- FrontendV2 checked out on `feat/frames`, with `npm install` done. FrontendV2 still needs a
  GitHub Packages token with `read:packages` in `~/.npmrc` (for its existing `@betty-gaming/*` packages).
- A QA account for `qa.playbetty.com`.

## 2. Start the frame (this folder)

Pick one:

```sh
npm run frame        # dev server, live reload:  http://localhost:8888/frame/
npm run frame:prod   # the built frame, as a CDN would serve it:  http://localhost:8890/frame/
```

**Measure with `frame:prod`.** The dev server sends hundreds of unbundled modules, which says
more about Vite than about the iframe.

Check that it works on its own: `http://localhost:8890/frame/?game=daily-wheel&tier=Diamond`
(or `:8888` for the dev server). That URL, opened directly, is also the **baseline** for the
comparison: the same game, with no iframe around it.

## 3. Start FrontendV2 web (FrontendV2 folder)

```sh
npm run web:pixi                                               # uses http://localhost:8888/frame/
DAILY_GAMES_URL=http://127.0.0.1:8890/frame/ npm run web:pixi   # the built frame (recommended)
```

Open `http://localhost:3000`, log in with the QA account, go to the lobby, and tap **Daily Wheel**
or **Daily Scratcher**. QA builds always show both widgets as ready, so you can open them again
and again.

## Notes for the measurements

- **Same-site vs cross-site.** `localhost:3000` and `localhost:8890` count as the same site, so
  Chrome runs the iframe in the page's own process. In production the frame comes from another
  domain (a CDN), which Chrome runs in a separate process. Use `http://127.0.0.1:8890/frame/` (as
  above) to get the production setup: `127.0.0.1` is a different site from `localhost`.
- **Where to look.** Chrome DevTools: the Performance panel records the page and the iframe
  together (the iframe's frames appear as their own track). `chrome://tracing` or the Memory
  panel for memory; the iframe's console is in the console's context dropdown.
- **The iframe is loaded at startup and stays loaded**, hidden, so a tap only shows it. Its
  page load is part of the app's startup, not of the tap.

## If something is off

- **"The daily games frame is not loaded" or nothing opens:** the browser may remember another
  frame address. Open `http://localhost:3000/?dailyGamesUrl=` once to forget it (or
  `?dailyGamesUrl=http://127.0.0.1:8890/frame/` to set one). Check the iframe's `src` in
  DevTools → Elements.
- **Port 8888 or 8890 busy:** something else is running there; stop it, the scripts need those ports.
- **No sound before the first tap:** browsers allow audio only after a user gesture.
