function createNotifier(env) {
  return {
    async send({ template, to, subject, data }) {
      if (!env.EMAILJS_SERVICE_ID || !env.EMAILJS_TEMPLATE_ID || !env.EMAILJS_PUBLIC_KEY) {
        console.warn("Notification provider not configured", { template, to, subject });
        return {
          delivered: false,
          provider: "noop",
          reason: "missing_notification_configuration",
        };
      }

      console.warn("EmailJS server-side delivery is not configured in this pass", {
        template,
        to,
        subject,
        hasData: Boolean(data),
      });

      return {
        delivered: false,
        provider: "emailjs-placeholder",
        reason: "server_delivery_not_implemented",
      };
    },
  };
}

export {
  createNotifier,
};
