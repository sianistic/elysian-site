function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  return header.split(";").reduce((cookies, part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) return cookies;
    cookies[name] = decodeURIComponent(rest.join("="));
    return cookies;
  }, {});
}

function buildCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure !== false) parts.push("Secure");
  parts.push(`Path=${options.path || "/"}`);

  return parts.join("; ");
}

export {
  buildCookie,
  jsonResponse,
  parseCookies,
};
