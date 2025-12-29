(function () {
  const root = document.documentElement;
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Set a consistent theme (no toggle needed for this landing page)
  root.setAttribute("data-theme", "light");

  // Mobile nav
  function setNavOpen(open) {
    navLinks.classList.toggle("open", open);
    navToggle.setAttribute("aria-expanded", String(open));
  }

  navToggle?.addEventListener("click", () => {
    const open = !navLinks.classList.contains("open");
    setNavOpen(open);
  });

  // Close menu after clicking a link (mobile)
  navLinks?.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.tagName === "A" && navLinks.classList.contains("open")) {
      setNavOpen(false);
    }
  });

  // Close menu on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setNavOpen(false);
  });

  // Contact form validation + mailto fallback
  const form = document.getElementById("contactForm");
  const statusEl = document.getElementById("formStatus");
  const mailtoFallback = document.getElementById("mailtoFallback");

  function setError(fieldName, message) {
    const el = document.querySelector(`.error[data-for="${fieldName}"]`);
    if (el) el.textContent = message || "";
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function buildMailto(name, email, message) {
    const subject = encodeURIComponent(`Website message from ${name}`);
    const body = encodeURIComponent(`From: ${name} <${email}>\n\n${message}`);
    return `mailto:you@example.com?subject=${subject}&body=${body}`;
  }

  const submitBtn = form?.querySelector('button[type="submit"]');

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();

    setError("name", "");
    setError("email", "");
    setError("message", "");
    if (statusEl) statusEl.textContent = "";

    let ok = true;

    if (name.length < 2) {
      setError("name", "Please enter your name (at least 2 characters).");
      ok = false;
    }
    if (!validateEmail(email)) {
      setError("email", "Please enter a valid email address.");
      ok = false;
    }
    if (message.length < 10) {
      setError("message", "Please write a message (at least 10 characters).");
      ok = false;
    }

    const mailto = buildMailto(name || "Someone", email || "unknown", message || "");
    if (mailtoFallback) mailtoFallback.setAttribute("href", mailto);

    if (!ok) {
      if (statusEl) statusEl.textContent = "Fix the highlighted fields, or use the email fallback.";
      return;
    }

    if (statusEl) statusEl.textContent = "Sending your message...";
    submitBtn?.setAttribute("disabled", "true");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("message", message);

    try {
      const response = await fetch("https://formspree.io/f/meeqrlol", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data?.errors?.[0]?.message || "Something went wrong. Please try again.";
        throw new Error(errorMsg);
      }

      if (statusEl) statusEl.textContent = "Thanks! Your message has been sent.";
      form.reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send your message right now.";
      if (statusEl) statusEl.textContent = `${message} Try the email fallback if the issue persists.`;
    } finally {
      submitBtn?.removeAttribute("disabled");
    }
  });
})();
