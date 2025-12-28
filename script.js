(function () {
  const root = document.documentElement;
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  const themeToggle = document.getElementById("themeToggle");

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Theme
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    root.setAttribute("data-theme", savedTheme);
  } else {
    // Default to dark, but respect OS preference if you want:
    // const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    // root.setAttribute("data-theme", prefersLight ? "light" : "dark");
    root.setAttribute("data-theme", "dark");
  }

  function toggleTheme() {
    const current = root.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  themeToggle?.addEventListener("click", toggleTheme);

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

  form?.addEventListener("submit", (e) => {
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

    // No backend included. This is where you'd POST to your server.
    if (statusEl) statusEl.textContent = "Looks good! Use the email fallback, or wire this to a backend endpoint.";
    form.reset();
  });
})();
