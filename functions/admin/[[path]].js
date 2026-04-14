import { getAdminSession } from "../_lib/session.js";

function isLoginPath(pathname) {
  return pathname === "/admin/login" || pathname === "/admin/login/";
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (isLoginPath(url.pathname)) {
    const session = await getAdminSession(context.env, context.request);
    if (session) {
      return Response.redirect(new URL("/admin/", url), 302);
    }
    return context.next();
  }

  const session = await getAdminSession(context.env, context.request);
  if (!session) {
    return Response.redirect(new URL("/admin/login/", url), 302);
  }

  return context.next();
}
