/* ============================================================
   ELYSIAN PCS — Quote Request Page Logic
   ============================================================ */

async function submitQuoteRequest() {
  var button = document.getElementById('quote-submit');
  var payload = {
    name: document.getElementById('quote-name').value.trim(),
    email: document.getElementById('quote-email').value.trim(),
    budget: document.getElementById('quote-budget').value.trim(),
    timeframe: document.getElementById('quote-timeframe').value.trim(),
    useCase: document.getElementById('quote-use-case').value,
    notes: document.getElementById('quote-notes').value.trim(),
  };

  if (!payload.name || !payload.email || !payload.notes) {
    Toast.error('Name, email, and requirements are required.');
    return;
  }

  button.disabled = true;
  button.textContent = 'Submitting...';

  try {
    var response = await fetch('/api/quotes/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Unable to submit your quote request.');
    }

    document.getElementById('quote-form-state').style.display = 'none';
    document.getElementById('quote-success').classList.add('visible');
    document.getElementById('quote-success-id').textContent = 'Quote ID: ' + data.quoteId;
    Toast.success('Quote request submitted.');
  } catch (error) {
    Toast.error(error.message || 'Unable to submit your quote request.');
  } finally {
    button.disabled = false;
    button.textContent = 'Submit Quote Request';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('quote-submit')?.addEventListener('click', submitQuoteRequest);
});
