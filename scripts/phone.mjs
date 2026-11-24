#!/usr/bin/env node
/**
 * Runs the mock host for a real phone: `npm run phone` from the liveops folder.
 *
 * Starts what `npm run dev` starts (the SDK's watch, the games server on 8888, the mock host
 * on 8080), makes both reachable from the phone, and prints the mock host's address as a QR
 * code. Open it in the phone's browser, or in the mini-games-mock-host app (Expo Go), which
 * plays the haptics with the phone's own.
 *
 *   npm run phone              Cloudflare quick tunnels: any network, https, nothing to set up
 *                              but cloudflared (brew install cloudflared; else it is fetched with npx).
 *   npm run phone -- --lan     The Mac's own address on the Wi-Fi: faster, the phone on the same network.
 *   npm run phone -- --app     Also starts the Expo app's server (mini-games-mock-host/native-app),
 *                              opened on this mock host. Add --tunnel to reach Expo Go off the Wi-Fi.
 *
 * Quick tunnels have random addresses, new every run, and no account: anyone with the address
 * reaches the dev servers while this runs. Stop it (Ctrl+C) when done.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const lan = args.has('--lan')
const withApp = args.has('--app')
const expoTunnel = args.has('--tunnel')

const GAMES_PORT = 8888
const HOST_PORT = 8080

const colours = { sdk: 35, games: 32, host: 36, tunnel: 33, app: 34 }
const children = []

/** Runs `command` with its output prefixed by `name`; `onLine` sees every line. */
function run(name, command, commandArgs, { env = {}, cwd = root, onLine, inherit = false } = {}) {
    const child = spawn(command, commandArgs, {
        cwd,
        env: { ...process.env, ...env },
        stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    })
    children.push(child)
    if (!inherit) {
        const prefix = `\x1b[${colours[name] ?? 37}m[${name}]\x1b[0m `
        for (const stream of [child.stdout, child.stderr]) {
            let rest = ''
            stream.on('data', (chunk) => {
                const lines = (rest + chunk).split('\n')
                rest = lines.pop() ?? ''
                for (const line of lines) {
                    onLine?.(line)
                    if (line.trim()) process.stdout.write(prefix + line + '\n')
                }
            })
        }
    }
    child.on('exit', (code) => {
        if (code && !stopping) console.error(`[${name}] stopped (${code})`)
    })
    return child
}

let stopping = false
function stop() {
    if (stopping) return
    stopping = true
    for (const child of children) child.kill('SIGTERM')
    setTimeout(() => process.exit(0), 300)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

/** The Mac's address on the local network. */
function lanAddress() {
    for (const list of Object.values(networkInterfaces())) {
        for (const net of list ?? []) {
            if (net.family === 'IPv4' && !net.internal) return net.address
        }
    }
    return undefined
}

function hasCommand(command) {
    return spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { stdio: 'ignore' }).status === 0
}

/** A quick tunnel to `port`: resolves with its https address once cloudflared prints it. */
function tunnel(port) {
    const [command, prefix] = hasCommand('cloudflared') ? ['cloudflared', []] : ['npx', ['--yes', 'cloudflared@0.7.3']]
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no tunnel to ${port} after 60 s`)), 60_000)
        run('tunnel', command, [...prefix, 'tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], {
            onLine: (line) => {
                // The tunnel's own address, not cloudflared's API (api.trycloudflare.com) it also names.
                const found = line.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/)
                if (found) {
                    clearTimeout(timer)
                    resolve(found[0])
                }
            },
        })
    })
}

/** True when something already listens on `port` (a `npm run dev` left running). */
async function inUse(port) {
    try {
        await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1500) })
        return true
    } catch {
        return false
    }
}

/** Resolves once `url` answers. */
async function reachable(url, seconds = 60) {
    for (let i = 0; i < seconds * 2; i++) {
        try {
            const response = await fetch(url)
            if (response.ok || response.status < 500) return
        } catch {
            // Not up yet.
        }
        await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new Error(`${url} did not answer`)
}

async function printQr(url) {
    try {
        const { default: qrcode } = await import('qrcode-terminal')
        qrcode.generate(url, { small: true }, (code) => console.log('\n' + code))
    } catch {
        console.log('(npm install for a QR code here)')
    }
}

async function main() {
    console.log('Building the SDK…')
    if (spawnSync('npm', ['run', 'build', '-w', '@betty-mini-games/sdk'], { cwd: root, stdio: 'inherit' }).status !== 0) {
        process.exit(1)
    }
    // A server already on a port would be the one the phone reaches, without this run's settings.
    for (const port of [GAMES_PORT, HOST_PORT]) {
        if (await inUse(port)) {
            console.error(`Port ${port} is taken (is \`npm run dev\` still running?). Stop it, then run this again.`)
            process.exit(1)
        }
    }
    run('sdk', 'npm', ['run', 'dev', '-w', '@betty-mini-games/sdk', '--', '--preserveWatchOutput'])

    const address = lan ? lanAddress() : 'localhost'
    if (lan && !address) {
        console.error('No network address found: is the Mac on Wi-Fi?')
        stop()
        return
    }
    // On the LAN the dev servers listen on every interface; behind a tunnel, on localhost alone.
    const listen = lan ? ['--host', '0.0.0.0'] : []

    run('games', 'npm', ['run', 'dev:games', '-w', '@betty-mini-games/library', '--', ...listen])
    await reachable(`http://localhost:${GAMES_PORT}/dev/`)
    if (!lan) console.log('Opening the games tunnel…')
    const gamesUrl = lan ? `http://${address}:${GAMES_PORT}` : await tunnel(GAMES_PORT)

    run('host', 'npm', ['run', 'dev', '-w', '@betty-mini-games/mock-host', '--', ...listen], { env: { VITE_GAMES_URL: gamesUrl } })
    await reachable(`http://localhost:${HOST_PORT}/`)
    if (!lan) console.log('Opening the mock host tunnel…')
    const hostUrl = lan ? `http://${address}:${HOST_PORT}` : await tunnel(HOST_PORT)

    // What the phone will do: the games through their address, and the mock host pointing at it.
    // The mock host this run started must load the games from their public address: read on
    // the Mac itself, so it does not wait on a new tunnel's DNS.
    const served = await fetch(`http://localhost:${HOST_PORT}/src/games.ts`).then((response) => response.text()).catch(() => '')
    if (!served.includes(gamesUrl)) {
        console.error(`\x1b[31mThe mock host on ${HOST_PORT} does not load the games from ${gamesUrl}: the phone would get a blank game. Is another mock host running?\x1b[0m`)
    }

    const phoneUrl = `${hostUrl}/?mode=phone`
    // The Expo app opens on this address (Expo loads .env.local as it starts).
    const appDir = join(root, 'mini-games-mock-host/native-app')
    if (existsSync(appDir)) {
        writeFileSync(
            join(appDir, '.env.local'),
            `# Written by npm run phone: the mock host the app opens on.\nEXPO_PUBLIC_MOCK_HOST_URL=${phoneUrl}\n`,
        )
    }

    console.log('\n\x1b[1mMock host for the phone\x1b[0m')
    console.log(`  ${phoneUrl}`)
    console.log(`  games: ${gamesUrl}`)
    await printQr(phoneUrl)
    console.log('Scan with the camera to open it in the phone’s browser, or paste it in the mini-games-mock-host app.')
    console.log('Ctrl+C stops everything.\n')

    // From outside, in the background: a new tunnel can take a minute to answer everywhere.
    if (!lan) {
        Promise.allSettled([reachable(`${gamesUrl}/dev/`, 120), reachable(`${hostUrl}/`, 120)]).then((checks) => {
            const failed = checks.flatMap((check, index) => (check.status === 'rejected' ? [index ? hostUrl : gamesUrl] : []))
            if (failed.length) {
                console.error(`\x1b[31mNot reachable from this Mac yet: ${failed.join(', ')}. If the phone shows the same, run npm run phone again.\x1b[0m`)
            } else {
                console.log('\x1b[32mBoth tunnels answer.\x1b[0m')
            }
        })
    }

    if (withApp) {
        run('app', 'npx', ['expo', 'start', ...(expoTunnel ? ['--tunnel'] : [])], {
            cwd: join(root, 'mini-games-mock-host/native-app'),
            env: { EXPO_PUBLIC_MOCK_HOST_URL: phoneUrl },
            inherit: true,
        })
    }
}

main().catch((error) => {
    console.error(error.message)
    stop()
})
