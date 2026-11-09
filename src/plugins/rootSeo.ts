import fs from 'node:fs'
import path from 'node:path'

import type { FastifyPluginAsync } from 'fastify'

import { config, webStaticPath } from '../config.js'

const ROOT_SEO_FILES = ['robots.txt', 'llms.txt', 'sitemap.xml'] as const

/**
 * 站根 SEO：/robots.txt、/sitemap.xml（索引）、/sitemap-*.xml、/llms.txt
 * 来源 webStatic/.root-seo/（由 npm run build:seo 生成）
 */
export const rootSeoPlugin: FastifyPluginAsync = async (fastify) => {
  const rootSeo = webStaticPath(config.rootSeoDir)

  for (const name of ROOT_SEO_FILES) {
    fastify.get(`/${name}`, async (_request, reply) => {
      const filePath = path.join(rootSeo, name)
      if (!fs.existsSync(filePath)) {
        return reply
          .code(404)
          .type('text/plain; charset=utf-8')
          .send(`Missing ${name}. Run: npm run build:seo`)
      }
      return reply.sendFile(name, rootSeo)
    })
  }

  fastify.get('/sitemap-:name.xml', async (request, reply) => {
    const name = (request.params as { name: string }).name
    const file = `sitemap-${name}.xml`
    const filePath = path.join(rootSeo, file)
    if (!fs.existsSync(filePath)) {
      return reply.code(404).type('text/plain; charset=utf-8').send('Not Found')
    }
    return reply.sendFile(file, rootSeo)
  })
}
