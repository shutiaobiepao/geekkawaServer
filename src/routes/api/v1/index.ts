import type { FastifyPluginAsync } from 'fastify'

import { toolsRoutes } from './tools.js'

export const apiV1Routes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(toolsRoutes)
}
