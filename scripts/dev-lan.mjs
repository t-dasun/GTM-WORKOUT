import { networkInterfaces } from 'node:os'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import net from 'node:net'

const preferredPort = Number(process.env.PORT || '3000')
const host = '0.0.0.0'

function canUsePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', () => {
      resolve(false)
    })

    server.once('listening', () => {
      server.close(() => resolve(true))
    })

    server.listen(port, host)
  })
}

async function getFreePort(startPort, maxTries = 30) {
  for (let i = 0; i < maxTries; i += 1) {
    const candidate = startPort + i
    // eslint-disable-next-line no-await-in-loop
    const free = await canUsePort(candidate)
    if (free) return candidate
  }
  throw new Error(`No free port found between ${startPort} and ${startPort + maxTries - 1}`)
}

function parseLockInfo(raw) {
  const pid = Number(raw.match(/"pid"\s*:\s*(\d+)/)?.[1])
  const port = Number(raw.match(/"port"\s*:\s*(\d+)/)?.[1])
  return {
    pid: Number.isFinite(pid) ? pid : null,
    port: Number.isFinite(port) ? port : null,
  }
}

function isProcessAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getLanIp() {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    const list = nets[name] || []
    for (const net of list) {
      const family = typeof net.family === 'string' ? net.family : String(net.family)
      if (family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return null
}

const lanIp = getLanIp()
const lockPath = '.next/dev/lock'

if (existsSync(lockPath)) {
  try {
    const raw = readFileSync(lockPath, 'utf8')
    const lock = parseLockInfo(raw)
    if (lock.pid && lock.port && isProcessAlive(lock.pid)) {
      console.log('')
      console.log(`Dev server already running (pid ${lock.pid}).`)
      console.log(`PC URL:     http://localhost:${lock.port}`)
      if (lanIp) {
        console.log(`Mobile URL: http://${lanIp}:${lock.port}`)
      }
      console.log('')
      process.exit(0)
    }
    // stale lock
    unlinkSync(lockPath)
  } catch {
    // ignore malformed lock
  }
}

const port = await getFreePort(preferredPort)

console.log('')
console.log('Starting development server for PC + mobile...')
if (port !== preferredPort) {
  console.log(`Port ${preferredPort} is in use. Using ${port} instead.`)
}
console.log(`PC URL:     http://localhost:${port}`)
if (lanIp) {
  console.log(`Mobile URL: http://${lanIp}:${port}`)
} else {
  console.log('Mobile URL: Could not detect LAN IP automatically')
}
console.log('Note: Do not use http://0.0.0.0 in phone browser.')
console.log('')

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['next', 'dev', '--hostname', host, '--port', String(port)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_DEV_ALLOWED_ORIGIN: lanIp || '',
    },
  }
)

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
