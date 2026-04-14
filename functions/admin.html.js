export async function onRequest(context) {
  return Response.redirect(new URL("/admin/", context.request.url), 308);
}
