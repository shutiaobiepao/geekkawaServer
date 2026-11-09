import type { FastifyPluginAsync } from 'fastify'

import { config } from '../config.js'

const CANONICAL = config.leavetheChairHomePath

/** /leavethechair → /leavethechair/homepage/（301，全小写） */
export const leavethechairRedirectsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/leavethechair', async (_request, reply) => {
    return reply.redirect(CANONICAL, 301)
  })

  fastify.get('/leavethechair/', async (_request, reply) => {
    return reply.redirect(CANONICAL, 301)
  })

  fastify.get('/leavethechair/homepage', async (request, reply) => {
    const query = request.url.includes('?')
      ? request.url.slice(request.url.indexOf('?'))
      : ''
    return reply.redirect(`${CANONICAL}${query}`, 301)
  })
}
