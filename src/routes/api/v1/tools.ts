import type { FastifyPluginAsync } from 'fastify'

import tools from '../../../data/tools.json' with { type: 'json' }

export type ToolListItem = {
  id: string
  name: string
  description: string
  path: string
  enabled: boolean
}

export const toolsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/tools', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=300')
    return tools satisfies ToolListItem[]
  })
}
