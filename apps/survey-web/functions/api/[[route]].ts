import apiApp from '../../../api/src/index'

// Mounts the full survey API at /api/* so site and API are same-origin.
// Same-origin avoids the * .workers.dev domain, which is unreachable from
// many mobile/carrier networks even though the *.pages.dev site loads fine.
export const onRequest = async (ctx: any) => {
  const url = new URL(ctx.request.url)
  url.pathname = url.pathname.replace(/^\/api/, '') || '/'
  const request = new Request(url.toString(), ctx.request)
  return apiApp.fetch(request, ctx.env, ctx.executionCtx)
}