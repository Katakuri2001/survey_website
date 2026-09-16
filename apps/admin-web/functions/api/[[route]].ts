import apiApp from '../../../api/src/index'

// Same-origin Pages Functions wrapper for admin-web.
export const onRequest = async (ctx: any) => {
  const url = new URL(ctx.request.url)
  url.pathname = url.pathname.replace(/^\/api/, '') || '/'
  const request = new Request(url.toString(), ctx.request)
  return apiApp.fetch(request, ctx.env, ctx.executionCtx)
}