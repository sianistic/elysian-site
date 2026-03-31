/* ============================================================
   ELYSIAN PCS — Support Page Logic
   ============================================================ */

// EmailJS Init
(function () {
  if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: '9CNRBFJzrjkM4BrNT' });
  }
})();

// Progress tracker
var supportFields = ['ticket-name', 'ticket-email', 'ticket-subject', 'ticket-message'];

function updateProgress() {
  var filled = supportFields.filter(function (id) {
    var el = document.getElementById(id);
    return el && el.value.trim();
  }).length;
  var ps1 = document.getElementById('ps1');
  var ps2 = document.getElementById('ps2');
  var ps3 = document.getElementById('ps3');
  if (ps1) ps1.classList.toggle('filled', filled >= 1);
  if (ps2) ps2.classList.toggle('filled', filled >= 2);
  if (ps3) ps3.classList.toggle('filled', filled >= 4);
}

document.addEventListener('DOMContentLoaded', function () {
  supportFields.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', updateProgress);
  });
});

// FAQ toggle
function toggleFaq(el) {
  var item = el.closest('.faq-item');
  if (item) item.classList.toggle('open');
}

// Show/hide form states
function showTicketForm() {
  var wrapper = document.getElementById('ticket-form-wrapper');
  var success = document.getElementById('ticket-success');
  var error = document.getElementById('ticket-error');
  if (wrapper) wrapper.style.display = 'block';
  if (success) success.classList.remove('visible');
  if (error) error.classList.remove('visible');
}

function resetTicketForm() {
  supportFields.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var catEl = document.getElementById('ticket-category');
  if (catEl) catEl.selectedIndex = 0;
  var lowPri = document.querySelector('input[name="priority"][value="Low"]');
  if (lowPri) lowPri.checked = true;
  updateProgress();
  showTicketForm();
}

// Submit ticket via EmailJS
function submitTicket() {
  if (typeof emailjs === 'undefined' || typeof emailjs.send !== 'function') {
    Toast.error('Support email service is unavailable right now. Please try again later.');
    return;
  }

  var name     = document.getElementById('ticket-name').value.trim();
  var email    = document.getElementById('ticket-email').value.trim();
  var orderId  = document.getElementById('ticket-order').value.trim();
  var category = document.getElementById('ticket-category').value;
  var priEl    = document.querySelector('input[name="priority"]:checked');
  var priority = priEl ? priEl.value : 'Low';
  var subject  = document.getElementById('ticket-subject').value.trim();
  var message  = document.getElementById('ticket-message').value.trim();

  if (!name || !email || !category || !subject || !message) {
    Toast.error('Please fill in all required fields.');
    return;
  }

  var emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) {
    Toast.error('Please enter a valid email address.');
    return;
  }

  var btn = document.getElementById('ticket-submit');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending…';
  }

  var ticketId  = 'ELYS-' + Date.now().toString(36).toUpperCase();
  var timestamp = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  var params = {
    to_email:  'd4yohero@gmail.com',
    from_name: name,
    from_email: email,
    ticket_id: ticketId,
    order_id:  orderId || 'N/A',
    category:  category,
    priority:  priority,
    subject:   subject,
    message:   message,
    timestamp: timestamp,
    reply_to:  email
  };

  emailjs.send('service_tl3ndnq', 'template_us6x8o2', params)
    .then(function () {
      var wrapper = document.getElementById('ticket-form-wrapper');
      if (wrapper) wrapper.style.display = 'none';
      var success = document.getElementById('ticket-success');
      if (success) success.classList.add('visible');
      Toast.success('Ticket submitted successfully!');
    })
    .catch(function (err) {
      var wrapper = document.getElementById('ticket-form-wrapper');
      if (wrapper) wrapper.style.display = 'none';
      var errMsg = document.getElementById('ticket-error-msg');
      if (errMsg) errMsg.textContent = (err && err.text) ? err.text : 'An unexpected error occurred. Please try again.';
      var errEl = document.getElementById('ticket-error');
      if (errEl) errEl.classList.add('visible');
      Toast.error('Failed to submit ticket.');
      console.error('EmailJS error:', err);
    })
    .finally(function () {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Submit Ticket';
      }
    });
}
