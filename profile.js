// profile.js - toggles the profile fields dropdown and handles basic keyboard accessibility

document.addEventListener('DOMContentLoaded', function () {
  const toggle = document.getElementById('profile-toggle');
  const details = document.getElementById('profile-details');
  const cancel = document.getElementById('cancel-button');

  if (!toggle || !details) return;

  function setOpen(open) {
    if (open) {
      details.classList.add('open');
      details.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.textContent = 'Hide profile fields';
      // move focus into first input for convenience
      const firstInput = details.querySelector('input, textarea, select, button');
      if (firstInput) firstInput.focus();
    } else {
      details.classList.remove('open');
      details.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'Show profile fields';
      toggle.focus();
    }
  }

  // initialize closed
  setOpen(false);

  toggle.addEventListener('click', function () {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    setOpen(!isOpen);
  });

  // keyboard: support Space / Enter when toggle is focused (button normally handles this but explicit handler helps)
  toggle.addEventListener('keydown', function (ev) {
    if (ev.key === ' ' || ev.key === 'Spacebar' || ev.key === 'Enter') {
      ev.preventDefault();
      toggle.click();
    }
  });

  // cancel button closes the panel without submitting
  if (cancel) {
    cancel.addEventListener('click', function () {
      setOpen(false);
    });
  }

  // close when user clicks outside the open panel (optional, helpful UX)
  document.addEventListener('click', function (ev) {
    const isClickInside = details.contains(ev.target) || toggle.contains(ev.target);
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    if (!isClickInside && isOpen) {
      setOpen(false);
    }
  });

  // Escape key closes the panel if open
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      if (isOpen) setOpen(false);
    }
  });
});
