/* ============================================================
   ELYSIAN PCS — Support Page Logic
   ============================================================ */

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
  var successId = document.getElementById('ticket-success-id');
  if (successId) successId.textContent = 'TKT-...';
  var successMeta = document.getElementById('ticket-success-meta');
  if (successMeta) successMeta.textContent = 'We will use your submitted email address for follow-up updates.';
  updateProgress();
  showTicketForm();
}

// Submit ticket to the internal support API
async function submitTicket() {
  var name     = document.getElementById('ticket-name').value.trim();
  var email    = document.getElementById('ticket-email').value.trim();
  var reference = document.getElementById('ticket-order').value.trim();
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
    btn.textContent = 'Sending...';
  }

  try {
    var response = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        email: email,
        reference: reference,
        category: category,
        priority: priority,
        subject: subject,
        message: message
      })
    });
    var data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Unable to create your support ticket.');
    }

    var wrapper = document.getElementById('ticket-form-wrapper');
    if (wrapper) wrapper.style.display = 'none';
    var success = document.getElementById('ticket-success');
    if (success) success.classList.add('visible');
    var successId = document.getElementById('ticket-success-id');
    if (successId) successId.textContent = data.ticketId || 'TKT-UNKNOWN';
    var successMeta = document.getElementById('ticket-success-meta');
    if (successMeta) {
      if (reference && data.referenceType === 'order') {
        successMeta.textContent = 'We matched your reference to an existing order and attached it to the ticket.';
      } else if (reference && data.referenceType === 'quote') {
        successMeta.textContent = 'We matched your reference to an existing quote and attached it to the ticket.';
      } else if (reference) {
        successMeta.textContent = 'We saved the reference exactly as entered so support can review it manually.';
      } else {
        successMeta.textContent = 'We will use your submitted email address for follow-up updates.';
      }
    }
    Toast.success('Ticket submitted successfully!');
  } catch (err) {
    var wrapper = document.getElementById('ticket-form-wrapper');
    if (wrapper) wrapper.style.display = 'none';
    var errMsg = document.getElementById('ticket-error-msg');
    if (errMsg) errMsg.textContent = (err && err.message) ? err.message : 'An unexpected error occurred. Please try again.';
    var errEl = document.getElementById('ticket-error');
    if (errEl) errEl.classList.add('visible');
    Toast.error('Failed to submit ticket.');
    console.error('Support ticket error:', err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Submit Ticket';
    }
  }
}
