// Daily games frame: performance probe. Paste into the DevTools console of the FRAME's page:
// - the page opened on its own (…/frame/, in a browser tab): the top context;
// - the frame inside FrontendV2 web: pick its context first (console's context dropdown,
//   the test-liveops-frame entry);
// - the frame inside FrontendV2's app: Safari's Web Inspector (iOS) or chrome://inspect
//   (Android) on the WebView's page, then paste in its console.
// Every game open is measured, from the ladder's Play (the moment the frame is told to show the
// game; whatever of it is not loaded yet loads from there) to the game closing, and logged as JSON when the game closes (see
// MEASURE-WEB.md for what each field means). The measuring ladder (MEASURE-LADDER.md): __perf.marks().
// __perf.open('daily-wheel' | 'daily-scratcher', tier?)  plays a game in this page (top level only): every step at once
// __perf.runs        every measured open        __perf.summary()   medians by setup and game (JSON)
// __perf.json()      every run as one JSON string, to copy out (copy(__perf.json()) in Chrome)
// __perf.stop()      ends the measurement now (it otherwise ends when the game closes)
// __perf.reset()     forgets the runs
// __perf.marks()     the frame's ladder steps so far (code-ready, engine-ready, art-ready, ...), in ms since the page loaded
;(() => {
    if (window.__perf) return console.warn('[perf] already installed')
    // webview: in FrontendV2's app; iframe: in FrontendV2 web; top-level: the page on its own (the baseline).
    const setup = window.ReactNativeWebView ? 'webview' : window.parent === window ? 'top-level' : 'iframe'
    const runs = []
    let cur = null

    const pct = (values, p) => {
        if (!values.length) return 0
        const sorted = [...values].sort((a, b) => a - b)
        return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
    }
    const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d
    const heapMB = () => (performance.memory ? round(performance.memory.usedJSHeapSize / 2 ** 20) : null)

    // Long tasks (50 ms and over) on this page's main thread.
    try {
        new PerformanceObserver((list) => {
            if (cur) for (const entry of list.getEntries()) cur.longTasks.push(entry.duration)
        }).observe({ type: 'longtask' })
    } catch {
        console.warn('[perf] no long task timing in this browser')
    }

    // The first WebGL draw after an open: the moment the game's art reaches the canvas.
    const DRAWS = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']
    const protos = [window.WebGL2RenderingContext, window.WebGLRenderingContext].filter(Boolean).map((c) => c.prototype)
    const originals = []
    function hookFirstDraw(run) {
        for (const proto of protos) {
            for (const name of DRAWS) {
                const original = proto[name]
                if (typeof original !== 'function') continue
                originals.push([proto, name, original])
                proto[name] = function (...args) {
                    unhookDraws()
                    run.drawAt = performance.now()
                    // The frame with the draw goes to the screen at the next animation frame; a message
                    // posted from it runs once that frame is handed over: close to when it is seen.
                    requestAnimationFrame(() => {
                        const channel = new MessageChannel()
                        channel.port1.onmessage = () => (run.frameAt = performance.now())
                        channel.port2.postMessage(0)
                    })
                    return original.apply(this, args)
                }
            }
        }
    }
    function unhookDraws() {
        for (const [proto, name, original] of originals.splice(0)) proto[name] = original
    }

    // Frame times while the game plays (after its first draw). Each run has its own loop, which
    // stops as soon as its run is over: a hidden iframe pauses animation frames, so an old loop
    // would otherwise wake up with the next run and count every frame twice.
    function loop(run) {
        const tick = (t) => {
            if (cur !== run) return
            if (run.frameAt !== undefined) {
                if (run.lastT !== undefined) run.deltas.push(t - run.lastT)
                run.lastT = t
            }
            requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
    }

    function begin(game, at) {
        if (cur) return
        cur = { setup, game, openAt: at, deltas: [], longTasks: [], heapOpen: heapMB() }
        console.log(`[perf] ▶ measuring ${game} (run ${runs.length + 1}): it ends when the game closes, or with __perf.stop()`)
        hookFirstDraw(cur)
        loop(cur)
    }

    function end() {
        const run = cur
        if (!run) return
        cur = null
        unhookDraws()
        const d = run.deltas
        const playMs = d.reduce((a, b) => a + b, 0)
        // A slow frame took over 25 ms: a 60 Hz screen showed the previous picture at least twice.
        const slow = d.filter((x) => x > 25).length
        const result = {
            run: runs.length + 1,
            setup: run.setup,
            game: run.game,
            openToDrawMs: run.drawAt !== undefined ? round(run.drawAt - run.openAt) : null,
            openToFrameMs: run.frameAt !== undefined ? round(run.frameAt - run.openAt) : null,
            playSeconds: round(playMs / 1000, 2),
            frames: d.length,
            fps: playMs ? round((d.length * 1000) / playMs) : null,
            smoothFramesPercent: d.length ? round(100 * (1 - slow / d.length)) : null,
            slowFrames: slow,
            hitches: d.filter((x) => x > 50).length,
            typicalFrameMs: round(pct(d, 0.5)),
            worstFrameMs: round(d.length ? Math.max(...d) : 0),
            longTasks: run.longTasks.length,
            longTasksTotalMs: round(run.longTasks.reduce((a, b) => a + b, 0)),
            heapAtOpenMB: run.heapOpen,
            heapAtCloseMB: heapMB(),
        }
        runs.push(result)
        console.log(`[perf] ■ run ${result.run} done\n${JSON.stringify(result, null, 2)}`)
    }

    // An open: the frame is told to play a game (the ladder's Play). event.timeStamp is when.
    window.addEventListener('daily-games:open', (event) => begin(event.detail.game, event.timeStamp))
    // A close: the game's container leaves the page.
    new MutationObserver((records) => {
        for (const record of records) {
            for (const node of record.removedNodes) if (node.classList?.contains('game')) end()
        }
    }).observe(document.body, { childList: true })

    window.__perf = {
        runs,
        open(game = 'daily-wheel', tier) {
            if (setup !== 'top-level') return console.warn(`[perf] in the ${setup}, open the game from FrontendV2's lobby`)
            window.postMessage(JSON.stringify({ game, tier }), '*')
        },
        /** Ends the measurement running now, before the game closes. */
        stop() {
            if (!cur) return console.warn('[perf] nothing is being measured')
            end()
        },
        reset() {
            runs.length = 0
        },
        marks() {
            const rows = performance
                .getEntriesByType('mark')
                .filter((m) => m.name.startsWith('stage:'))
                .map((m) => ({ step: m.name.slice(6), atMs: round(m.startTime) }))
            console.table(rows)
            return rows
        },
        json() {
            return JSON.stringify(runs, null, 2)
        },
        summary() {
            const groups = {}
            for (const r of runs) (groups[`${r.setup}|${r.game}`] ??= []).push(r)
            const rows = Object.values(groups).map((rs) => {
                const med = (k) => round(pct(rs.map((r) => r[k]).filter((v) => v !== null), 0.5))
                return {
                    setup: rs[0].setup,
                    game: rs[0].game,
                    runs: rs.length,
                    median: {
                        openToDrawMs: med('openToDrawMs'),
                        openToFrameMs: med('openToFrameMs'),
                        fps: med('fps'),
                        smoothFramesPercent: med('smoothFramesPercent'),
                        slowFrames: med('slowFrames'),
                        hitches: med('hitches'),
                        typicalFrameMs: med('typicalFrameMs'),
                        worstFrameMs: med('worstFrameMs'),
                        longTasksTotalMs: med('longTasksTotalMs'),
                        heapAtCloseMB: med('heapAtCloseMB'),
                    },
                }
            })
            console.log(`[perf] summary\n${JSON.stringify(rows, null, 2)}`)
            return rows
        },
    }
    console.info(`[perf] ready (${setup}). Each game open is measured from the ladder's Play until the game closes.`)
})()
