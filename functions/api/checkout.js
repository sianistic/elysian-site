<script src="https://js.stripe.com/v3/"></script>
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

<script>
  // Initialize EmailJS with your provided Public Key
  emailjs.init("9CNRBFJzrjkM4BrNT");

  // 1. GLOBAL ADMIN SYNC
  // Replaces your old loadData() to fetch from Cloudflare KV instead of local storage
  async function loadData() {
    const response = await fetch('/api/pcs');
    const globalPcs = await response.json();
    if (globalPcs.length > 0) {
      pcs = globalPcs; // Update the local 'pcs' array used by your card generator
      renderPCs();
    }
  }

  // 2. STRIPE CHECKOUT
  async function handleCheckout() {
    const stripe = Stripe('pk_test_51T7SnfLAAINeFFlcIKP0QSIMwWTg5t4fL3ejZfi7huzcdohMdnxpDmIujc7T0kOuC11enUWIblN7DPcVU9CvirOW008lA920Ps');
    
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart: cartItems })
    });
    
    const session = await response.json();
    await stripe.redirectToCheckout({ sessionId: session.id });
  }

  // 3. EMAIL TICKET SYSTEM
  async function sendTicket(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.textContent = "Sending...";

    const params = {
      from_name: document.getElementById('ticket-name').value,
      from_email: document.getElementById('ticket-email').value,
      message: document.getElementById('ticket-msg').value,
      to_email: 'd4yohero@gmail.com'
    };

    emailjs.send("default_service", "template_id_here", params)
      .then(() => {
        showToast("Ticket sent to Elysian support!");
        e.target.reset();
        btn.textContent = "Send Ticket";
      });
  }
</script>