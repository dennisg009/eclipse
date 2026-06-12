// Headless smoke test: load the app, exercise each view, capture console errors
// and screenshots. Verifies the Three.js + orrery app actually runs.
import puppeteer from 'puppeteer-core'

const URL = 'http://localhost:5174/projects/eclipse/'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--ignore-gpu-blocklist', '--window-size=1400,900']
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise((r) => setTimeout(r, 1500))

async function shot(name) { await new Promise((r) => setTimeout(r, 1200)); await page.screenshot({ path: `/tmp/eclipse-${name}.png` }) }

// 1. Orrery (default) + computation log
await shot('orrery')
const logText = await page.$eval('#log', (el) => el.innerText).catch(() => '')
const eclipseCount = await page.$$eval('#eclipse-list li', (els) => els.length)

// 2. Click first eclipse -> scan animation -> auto ground POV (totality)
await page.$$eval('#eclipse-list li', (els) => els[0].click())
await new Promise((r) => setTimeout(r, 2800)) // wait out the scan
await shot('ground')
const groundInfo = await page.$eval('#info', (el) => el.innerText).catch(() => '')
const groundView = await page.$$eval('#view-tabs .tab', (els) => els.find((b) => b.classList.contains('active'))?.dataset.view)

// 3. Earth bonus view
await page.$$eval('#view-tabs .tab', (els) => els.find((b) => b.dataset.view === 'earth').click())
await shot('earth')
const earthInfo = await page.$eval('#info', (el) => el.innerText).catch(() => '')

// 4. Back to orrery, play a bit
await page.$$eval('#view-tabs .tab', (els) => els.find((b) => b.dataset.view === 'orrery').click())
await page.click('#play')
await new Promise((r) => setTimeout(r, 1500))
await shot('orrery-playing')

console.log(JSON.stringify({ eclipseCount, autoGroundView: groundView, logText, groundInfo, earthInfo, errors }, null, 2))
await browser.close()
process.exit(errors.length ? 1 : 0)
