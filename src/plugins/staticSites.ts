import fs from 'node:fs'
import path from 'node:path'

import fastifyStatic from '@fastify/static'
import type { FastifyPluginAsync } from 'fastify'

import { config, webStaticPath } from '../config.js'

const PHOTOSHOP_PREFIX = '/tool/photoshop'
const LTC_PREFIX = '/leavethechair/homepage'

/**
 * 静态：/ → geekkawaHome；/leavethechair/homepage/ → LTC；/tool/ → geekkawaWeb MPA
 */
export const staticSitesPlugin: FastifyPluginAsync = async (fastify) => {
  const toolRoot = webStaticPath(config.geekkawaWebDir)
  const ltcRoot = webStaticPath(config.leavetheChairHomepageDir)
  const brandRoot = webStaticPath(config.geekkawaHomeDir)
  const photoshopRoot = path.join(toolRoot, 'photoshop')

  await fastify.register(fastifyStatic, {
    root: toolRoot,
    prefix: '/tool/',
    decorateReply: true,
  })

  await fastify.register(fastifyStatic, {
    root: ltcRoot,
    prefix: '/leavethechair/homepage/',
    decorateReply: false,
  })

  await fastify.register(fastifyStatic, {
    root: brandRoot,
    prefix: '/',
    decorateReply: false,
  })

  fastify.setNotFoundHandler(async (request, reply) => {
    const pathname = request.url.split('?')[0] ?? ''

    if (pathname.startsWith(PHOTOSHOP_PREFIX)) {
      const indexPath = path.join(photoshopRoot, 'index.html')
      if (fs.existsSync(indexPath)) {
        return reply.sendFile('index.html', photoshopRoot)
      }
    }

    if (pathname === '/tool' || pathname.startsWith('/tool/')) {
      const toolIndex = path.join(toolRoot, 'index.html')
      if (fs.existsSync(toolIndex)) {
        return reply.sendFile('index.html', toolRoot)
      }
    }

    if (
      pathname === LTC_PREFIX ||
      pathname.startsWith(`${LTC_PREFIX}/`)
    ) {
      const indexPath = path.join(ltcRoot, 'index.html')
      if (fs.existsSync(indexPath)) {
        return reply.sendFile('index.html', ltcRoot)
      }
    }

    return reply.code(404).type('text/plain; charset=utf-8').send('Not Found')
  })
}
