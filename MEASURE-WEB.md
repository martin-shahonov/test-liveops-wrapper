# Measure the iframe's cost (web)

The question: does running the daily games inside FrontendV2's iframe make them

1. **less smooth** while playing,
2. **slower to open**,
3. **heavier** (memory, CPU), or
4. does it **slow the lobby down** around them?

Everything below compares the same game, from the same build, with and without the iframe.

## The setups

| | Setup | Open | What it tells you |
|---|---|---|---|
| **A** | The game alone, no iframe (the baseline) | `https://test-liveops-frame.pages.dev/frame/` | What the game costs by itself |
| **B** | The game in FrontendV2's iframe | `https://betty-web-pixi.pages.dev` → log in → lobby → tap a game | A + the iframe |
| **D** | FrontendV2 with no frame loaded | B, with the frame blocked (below) | What the lobby costs by itself |

**B − A** is the iframe's cost to the game. **B − D** (with no game open) is what keeping the iframe
loaded costs the lobby.

**Use the deployed sites, not localhost.** Both are production builds, and they are two different
sites (`pages.dev` addresses count as separate sites), so Chrome puts the iframe in its own process,
as it will be with the real CDN. Local FrontendV2 (`npm run web:pixi`) is a development build of
React: fine for trying things, wrong for numbers about the lobby.

To get **D**: DevTools → *More tools* → *Network request blocking* → add `test-liveops-frame.pages.dev`
→ reload. The iframe stays empty.

## Before every session

- **Chrome, an Incognito window** (no extensions), nothing else running, laptop on power.
- **Same window size and zoom for every run** (say 1280×800, 100%): the canvas fills the window,
  and its size changes how much the GPU draws. Undock DevTools (⋮ → *Dock side* → separate window)
  so it does not shrink the page.
- **Warm up**: open and close each game once before measuring. The first open of a session
  downloads and decodes the art. Measure that **cold** open separately (reload the page, then
  open), and the **warm** opens after it.
- **At least 5 runs** per game and setup. Compare **medians** (the middle value of the runs).
- **DevTools costs performance while it records.** For the probe below, paste it, then leave
  DevTools idle (or close it) while you play, and read the results afterwards.

## Tool 1: the probe (numbers for each open)

[`perf/frame-perf.js`](perf/frame-perf.js) is pasted into the console of the **game's page**.
It measures each open, from the open message to the game closing, and logs the result as JSON
when the game closes. It works the same in A and B, so its numbers compare directly.

**In A:** open `https://test-liveops-frame.pages.dev/frame/`, open the console (⌥⌘J), paste the
file, then open games from the console:

```js
__perf.open('daily-wheel', 'Diamond')   // or 'daily-scratcher'
```

**In B:** open the lobby, open the console, and in the console's **context dropdown** (top left,
"top" by default) pick **test-liveops-frame.pages.dev**. Paste the file there, then open games by
tapping the widgets as a player would.

### Starting and ending a measurement

There is nothing to start by hand: **each game open is one measurement.**

1. **Get ready:** paste the probe (above). The console says
   `[perf] ready (top-level)` in A, or `[perf] ready (iframe)` in B.
2. **Start:** open a game. In A, type `__perf.open('daily-wheel', 'Diamond')` (or
   `'daily-scratcher'`); in B, tap the widget in the lobby. The console says
   `[perf] ▶ measuring daily-wheel (run 1)`.
3. **Play** it the same way every run: the wheel, press **SPIN** and wait for it to close by
   itself; the scratcher, press **QUICK SCRATCH**, then **COLLECT**.
4. **End:** the measurement ends by itself when the game closes (after the spin, after COLLECT, or
   with the ✕). The console says `[perf] ■ run 1 done` and prints its JSON. To end it earlier,
   with the game still open, type `__perf.stop()`.
5. Repeat from step 2 for the next run (at least 5 per game).
6. **Results:** `__perf.summary()` prints the averages (medians) of all runs so far, per setup and
   game. `copy(__perf.json())` puts every run on the clipboard as JSON. `__perf.reset()` forgets
   the runs and starts the count again.

The probe stays until the page reloads. A reload removes it: paste it again.

### One run

```json
{
  "run": 3,
  "setup": "iframe",
  "game": "daily-wheel",
  "openToDrawMs": 142.6,
  "openToFrameMs": 161.3,
  "playSeconds": 14.82,
  "frames": 887,
  "fps": 59.9,
  "smoothFramesPercent": 99.3,
  "slowFrames": 6,
  "hitches": 1,
  "typicalFrameMs": 16.7,
  "worstFrameMs": 50.1,
  "longTasks": 2,
  "longTasksTotalMs": 131,
  "heapAtOpenMB": 21.4,
  "heapAtCloseMB": 23.0
}
```
(The values show the shape, not a measurement.)

| Field | Meaning | How to read it |
|---|---|---|
| `run` | The open's number since the paste (or the last `reset()`) | To match a run with your notes |
| `setup` | `top-level`: the game is the page itself (setup A, no iframe). `iframe`: the game is inside FrontendV2's frame (setup B) | Compare A runs with B runs |
| `game` | `daily-wheel` or `daily-scratcher` | |
| `openToDrawMs` | Milliseconds from the open reaching the game's page to the game's **first drawing**: its picture is ready, not yet on screen. Includes setting the game up and loading its art | Lower is better |
| `openToFrameMs` | The same start, to that picture **reaching the screen**: about what the player waits for. In B it starts when the open reaches the iframe (the hop from the tap in the lobby: Tool 2) | **The open time.** Compare A and B. The first open after a page load also downloads the art, so keep it apart from the others |
| `playSeconds` | How long the game was measured: from its first picture on screen to its close | A run where you waited before tapping is longer; that's fine |
| `frames` | How many pictures the game drew in that time | Context for `fps` |
| `fps` | Pictures per second: `frames ÷ playSeconds`. 60 on a 60 Hz screen when nothing stutters, 120 on a 120 Hz screen | **Smoothness.** Higher is better. A steady gap of more than 1–2 between A and B matters |
| `smoothFramesPercent` | The share of pictures that came in time: 25 ms or less each | **Smoothness, in one number.** Near 100 is smooth |
| `slowFrames` | Pictures that took over 25 ms: the screen showed the previous picture again (on a 60 Hz screen) | Small stutters. Fewer is better |
| `hitches` | Pictures that took over 50 ms: a stall long enough for anyone to see | **Visible stutters.** Should be 0 or close |
| `typicalFrameMs` | The usual time between two pictures (half are faster, half slower). 16.7 ms = 60 fps, 8.3 ms = 120 fps | Should match the screen's refresh |
| `worstFrameMs` | The single longest wait between two pictures | One-off stalls; varies a lot between runs, look at several |
| `longTasks` | How many times the game's page was busy for 50 ms or more in one go (scripts, layout) while it played | The usual cause of `slowFrames` and `hitches` |
| `longTasksTotalMs` | The total time of those busy stretches | Compare A and B |
| `heapAtOpenMB` | The game page's JavaScript memory when the game opened | **Rough only**: Chrome rounds it. Use Tool 3 for memory |
| `heapAtCloseMB` | The same, when the game closed | Rough only. Climbing over many runs hints at a leak: confirm with Tool 3 |

### The summary

`__perf.summary()` groups the runs by `setup` and `game`, and for each field gives the **median**:
the middle value when the runs are sorted, so one odd run does not move it.

```json
[
  {
    "setup": "iframe",
    "game": "daily-wheel",
    "runs": 5,
    "median": {
      "openToDrawMs": 0, "openToFrameMs": 0, "fps": 0,
      "smoothFramesPercent": 0, "slowFrames": 0, "hitches": 0,
      "typicalFrameMs": 0, "worstFrameMs": 0,
      "longTasksTotalMs": 0, "heapAtCloseMB": 0
    }
  }
]
```

`runs` is how many opens the medians come from. Each page only knows its own runs: take A's
summary from the game page on its own, and B's from the frame's context inside the lobby.

## Tool 2: the Performance panel (why a number differs)

DevTools → **Performance** → tick **Screenshots** → record (●) → tap a game in the lobby, play it
through → stop.

- **Frames** (top): one block per frame; red or partially presented frames are the stutters. Hover
  for their duration.
- **Main** for the lobby, and a separate track for the iframe (**Frame — test-liveops-frame…**):
  in B the game runs on its own thread, in its own process. Long yellow (script) or purple
  (layout) blocks in the game's track are where `longTasksTotalMs` comes from.
- **Tap to first frame**: from the `click` in the lobby's track, through the `message` event in
  the frame's track, to the first screenshot showing the game. This is the full open time in B,
  hop included.
- **Interactions** track: the delay from a pointer event to the next frame. Watch it while
  scratching (the most input-heavy part).
- **GPU** track: GPU work per frame; compare A and B during the coin shower (the heaviest moment).

Also useful, live:

- **Rendering** tab (⋮ → *More tools* → *Rendering*) → **Frame Rendering Stats**: an on-page FPS
  and GPU memory meter.
- **Performance monitor** (*More tools*): CPU, JS heap and DOM nodes over time. In B with no game
  open, compare against D: a loaded, hidden iframe should cost close to nothing.

## Tool 3: Task Manager (memory and CPU per process)

Chrome menu → *More tools* → **Task manager** (right-click the header to add **GPU memory** and
**JavaScript memory**). In B, the iframe has its own row, **Subframe: https://test-liveops-frame.pages.dev**.

Write down its **Memory footprint**, **CPU** and **GPU memory**:

1. lobby open, no game opened yet (what the hidden iframe costs from startup);
2. during a game;
3. after the game closes;
4. after **10 opens and closes** (it should settle back near step 3, not keep climbing: that would
   be a leak).

For A, use the tab's own row. The iframe's overhead in memory is roughly
**B (tab + subframe) − D (tab)** compared with **A**.

## Tool 4: the Memory panel (only if step 4 above keeps climbing)

DevTools → **Memory**, the frame's context selected (dropdown) → *Heap snapshot* after 1 close and
again after 10 → *Comparison* view. Look for growing counts of `Texture`, `Application`, `Sound`,
or `Detached HTMLCanvasElement`.

## Tool 5: the lobby's own load (B vs D)

Does loading the frame at startup slow the lobby? Measure the lobby's load in B and in D (request
blocking, above): DevTools → **Lighthouse** → *Navigation*, *Desktop*, *Performance*, 3 runs each,
compare the medians of **Total Blocking Time** and **Largest Contentful Paint**. In the
**Network** panel, the frame costs about 1 MB of JavaScript (about 310 KB transferred); the art
is fetched only when a game opens.

## What matters, in order

1. **Smoothness while playing** (`fps`, `smoothFramesPercent`, `hitches`), above all during the spin, the
   scratching and the coin shower. A difference worth acting on: B consistently below A by more
   than 1–2 fps, or a lower `smoothFramesPercent`, or more `hitches`, across the runs.
2. **Open time** (`openToFrameMs` warm, plus the tap-to-message hop from Tool 2). The iframe adds one
   message and makes a hidden element visible. A gap over about 50 ms between A and B is worth a
   look in the Performance panel.
3. **Responsiveness while scratching** (Interactions track, and how it feels).
4. **Memory**: the subframe process's footprint, and that it returns to its level after closes.
5. **The lobby's cost** (B vs D with no game open): load time, idle CPU.

**Noise to ignore**: single runs, the first (cold) open mixed with warm ones, the snippet's heap
column, and anything measured over remote desktop, in a VM, or with software rendering (check
`chrome://gpu`: *WebGL: Hardware accelerated*).

**Slower machines**: Chrome's CPU slowdown (Performance panel → ⚙ → *CPU*) may not reach the
iframe's separate process. If the game's track in B does not look slowed, compare on a genuinely
slower machine instead.

## Write down

For every session: machine, Chrome version, window size and zoom, `chrome://gpu` WebGL status,
cold or warm. Then, per setup and game (the medians from `__perf.summary()`), or keep the JSON
itself (`copy(__perf.json())`) with the notes:

| Setup | Game | Runs | openToFrameMs | fps | smoothFramesPercent | slowFrames | hitches | Memory idle / play / after 10 | CPU idle |
|---|---|---|---|---|---|---|---|---|---|
| A | daily-wheel | | | | | | | | |
| B | daily-wheel | | | | | | | | |
| A | daily-scratcher | | | | | | | | |
| B | daily-scratcher | | | | | | | | |
| D | (lobby only) | | | | | | | | |
