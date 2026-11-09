import compress from '@fastify/compress'
import Fastify from 'fastify'

import { config } from './config.js'
import { legacyRedirectsPlugin } from './plugins/legacyRedirects.js'
import { leavethechairRedirectsPlugin } from './plugins/leavethechairRedirects.js'
import { rootSeoPlugin } from './plugins/rootSeo.js'
import { staticSitesPlugin } from './plugins/staticSites.js'
import { apiV1Routes } from './routes/api/v1/index.js'

const app = Fastify({
  logger: true,
  trustProxy: true,
})

await app.register(compress)

await app.register(legacyRedirectsPlugin)
await app.register(leavethechairRedirectsPlugin)
await app.register(rootSeoPlugin)
await app.register(apiV1Routes, { prefix: '/api/v1' })
await app.register(staticSitesPlugin)

try {
  await app.listen({ host: config.host, port: config.port })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
