import { defineConfig } from 'vite'

// Where the app is mounted. Default is the /projects/eclipse path on
// dennisgavrilenko.com — a front-door Worker (dg-router) strips this prefix
// before the request reaches the Pages project, so client asset paths are
// base-relative. Override for other layouts, e.g. ECLIPSE_BASE=/ for a subdomain.
const BASE = process.env.ECLIPSE_BASE || '/projects/eclipse/'

export default defineConfig({
  base: BASE,
  server: { port: 5174, open: BASE }
})
