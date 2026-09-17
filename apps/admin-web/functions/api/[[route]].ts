import apiApp from '../../../api/src/index'

type ApiEnv = Parameters<typeof apiApp.fetch>[1]
type ApiExecutionContext = Parameters<typeof apiApp.fetch>[2]

interface PagesContext {
  request: Request
  env: unknown
  executionCtx: unknown
}

// Same-origin Pages Functions wrapper for admin-web.
export const onRequest = async (ctx: PagesContext) => {
  const url = new URL(ctx.request.url)
  url.pathname = url.pathname.replace(/^\/api/, '') || '/'
  const request = new Request(url.toString(), ctx.request)
  return apiApp.fetch(request, ctx.env as ApiEnv, ctx.executionCtx as ApiExecutionContext)
}
