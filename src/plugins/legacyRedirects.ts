import type { FastifyPluginAsync } from 'fastify'

const TARGET = '/tool/photoshop/'

/** 未正式上线前的旧路径兼容；canonical 以 /tool/photoshop/ 为准。 */
export const legacyRedirectsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/photoshop', async (_request, reply) => {
    return reply.redirect(TARGET, 301)
  })

  fastify.get<{ Params: { '*': string } }>('/photoshop/*', async (request, reply) => {
    const rest = request.params['*']
    const suffix = rest ? `${rest}` : ''
    const query = request.url.includes('?')
      ? request.url.slice(request.url.indexOf('?'))
      : ''
    const location = suffix
      ? `/tool/photoshop/${suffix}${query}`
      : `${TARGET}${query}`
    return reply.redirect(location, 301)
  })
}
