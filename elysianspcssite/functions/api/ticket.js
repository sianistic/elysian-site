export async function onRequestPost(context) {
  const { name, email, message } = await context.request.json();

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: "default_service",
      template_id: "YOUR_TEMPLATE_ID", // Get this from EmailJS Dashboard
      user_id: "9CNRBFJzrjkM4BrNT",    // Your Public Key
      template_params: {
        from_name: name,
        from_email: email,
        message: message,
        to_email: "d4yohero@gmail.com"
      }
    })
  });

  return new Response(JSON.stringify({ success: response.ok }));
}