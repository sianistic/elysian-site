const FEATURE_REQUIREMENTS = {
  admin_auth: {
    label: "Admin login",
    requirements: [
      { key: "DB", kind: "binding", label: "D1 binding `DB`" },
      { key: "ADMIN_PASSWORD", kind: "secret", label: "ADMIN_PASSWORD secret" },
    ],
  },
  support_tickets: {
    label: "Support tickets",
    requirements: [
      { key: "DB", kind: "binding", label: "D1 binding `DB`" },
    ],
  },
  quote_requests: {
    label: "Quote requests",
    requirements: [
      { key: "DB", kind: "binding", label: "D1 binding `DB`" },
    ],
  },
  checkout: {
    label: "Checkout",
    requirements: [
      { key: "DB", kind: "binding", label: "D1 binding `DB`" },
      { key: "STRIPE_SECRET_KEY", kind: "secret", label: "STRIPE_SECRET_KEY secret" },
      { key: "SITE_URL", kind: "var", label: "SITE_URL variable" },
    ],
  },
  payment_links: {
    label: "Manual payment links",
    requirements: [
      { key: "DB", kind: "binding", label: "D1 binding `DB`" },
      { key: "STRIPE_SECRET_KEY", kind: "secret", label: "STRIPE_SECRET_KEY secret" },
      { key: "SITE_URL", kind: "var", label: "SITE_URL variable" },
    ],
  },
  stripe_webhooks: {
    label: "Stripe webhooks",
    requirements: [
      { key: "DB", kind: "binding", label: "D1 binding `DB`" },
      { key: "STRIPE_WEBHOOK_SECRET", kind: "secret", label: "STRIPE_WEBHOOK_SECRET secret" },
    ],
  },
};

function hasConfiguredValue(env, key) {
  const value = env?.[key];
  if (value === undefined || value === null) return false;
  if (typeof value === "object") return true;
  return String(value).trim() !== "";
}

function getFeatureRequirementProblems(env, featureKey) {
  const feature = FEATURE_REQUIREMENTS[featureKey];
  if (!feature) return [];

  return feature.requirements
    .filter((requirement) => !hasConfiguredValue(env, requirement.key))
    .map((requirement) => ({
      key: requirement.key,
      kind: requirement.kind,
      label: requirement.label,
    }));
}

function getFeatureConfigError(env, featureKey) {
  const feature = FEATURE_REQUIREMENTS[featureKey];
  if (!feature) {
    throw new Error(`Unknown runtime feature "${featureKey}".`);
  }

  const missing = getFeatureRequirementProblems(env, featureKey);
  if (!missing.length) return null;

  return `${feature.label} requires ${missing.map((item) => item.label).join(", ")}.`;
}

function assertFeatureConfig(env, featureKey) {
  const message = getFeatureConfigError(env, featureKey);
  if (message) {
    throw new Error(message);
  }
}

function isLikelyProductionUrl(value) {
  const url = String(value || "").trim();
  return Boolean(url) && !/localhost|127\.0\.0\.1/i.test(url);
}

function buildRuntimeChecks(env) {
  const checks = [];

  checks.push({
    key: "db",
    label: "D1 database",
    status: hasConfiguredValue(env, "DB") ? "ok" : "error",
    scope: "core",
    message: hasConfiguredValue(env, "DB")
      ? "DB binding is available to Pages Functions."
      : "Core workflows require the D1 binding `DB`.",
  });

  checks.push({
    key: "admin_password",
    label: "Admin password",
    status: hasConfiguredValue(env, "ADMIN_PASSWORD") ? "ok" : "error",
    scope: "admin",
    message: hasConfiguredValue(env, "ADMIN_PASSWORD")
      ? "Admin password secret is configured."
      : "Set the ADMIN_PASSWORD secret before relying on admin login.",
  });

  checks.push({
    key: "stripe_secret",
    label: "Stripe secret key",
    status: hasConfiguredValue(env, "STRIPE_SECRET_KEY") ? "ok" : "error",
    scope: "commerce",
    message: hasConfiguredValue(env, "STRIPE_SECRET_KEY")
      ? "Stripe checkout calls can be created server-side."
      : "Checkout and manual payment links require STRIPE_SECRET_KEY.",
  });

  checks.push({
    key: "stripe_webhook_secret",
    label: "Stripe webhook secret",
    status: hasConfiguredValue(env, "STRIPE_WEBHOOK_SECRET") ? "ok" : "error",
    scope: "commerce",
    message: hasConfiguredValue(env, "STRIPE_WEBHOOK_SECRET")
      ? "Stripe webhook signature verification is configured."
      : "Webhook-confirmed payment state requires STRIPE_WEBHOOK_SECRET.",
  });

  const siteUrl = String(env?.SITE_URL || "").trim();
  checks.push({
    key: "site_url",
    label: "Site URL",
    status: isLikelyProductionUrl(siteUrl) ? "ok" : (siteUrl ? "warning" : "error"),
    scope: "ops",
    message: isLikelyProductionUrl(siteUrl)
      ? `Customer links and notifications use ${siteUrl}.`
      : siteUrl
        ? "SITE_URL is set, but it still looks like a local development URL."
        : "SITE_URL should point at the public site domain for checkout and notification links.",
  });

  const hasEmailBase = hasConfiguredValue(env, "RESEND_API_KEY") && hasConfiguredValue(env, "NOTIFY_FROM_EMAIL");
  checks.push({
    key: "customer_notifications",
    label: "Customer email notifications",
    status: hasEmailBase ? "ok" : "warning",
    scope: "notifications",
    message: hasEmailBase
      ? "Customer-facing notifications can be sent with Resend."
      : "Set RESEND_API_KEY and NOTIFY_FROM_EMAIL to deliver customer emails.",
  });

  const hasInternalAlerting =
    (hasEmailBase && hasConfiguredValue(env, "ADMIN_ALERT_EMAIL")) ||
    hasConfiguredValue(env, "NOTIFY_WEBHOOK_URL");

  checks.push({
    key: "internal_alerting",
    label: "Internal alerting",
    status: hasInternalAlerting ? "ok" : "warning",
    scope: "notifications",
    message: hasInternalAlerting
      ? "Operational alerts can reach the team."
      : "Configure ADMIN_ALERT_EMAIL or NOTIFY_WEBHOOK_URL so ticket, quote, and payment alerts reach someone.",
  });

  return checks;
}

function summarizeRuntimeChecks(checks = []) {
  return checks.reduce((summary, check) => {
    if (check.status === "error") summary.errors += 1;
    else if (check.status === "warning") summary.warnings += 1;
    else summary.ok += 1;
    return summary;
  }, { ok: 0, warnings: 0, errors: 0 });
}

export {
  assertFeatureConfig,
  buildRuntimeChecks,
  getFeatureConfigError,
  getFeatureRequirementProblems,
  summarizeRuntimeChecks,
};
