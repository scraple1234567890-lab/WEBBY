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

  // Quiz
  const quizForm = document.getElementById("schoolQuiz");
  const quizResult = document.getElementById("quizResult");
  const quizStatus = document.getElementById("quizStatus");
  const schoolCopy = {
    touch: {
      name: "Chamber of Touch",
      description: "You trust the world you can hold. Craft, build, and protect—your magic strengthens every ward and tool.",
    },
    sight: {
      name: "Observatory of Sight",
      description: "You map the unseen. Patterns, sigils, and constellations bend toward your precise gaze and luminous focus.",
    },
    sound: {
      name: "Choir of Sound",
      description: "You feel rhythm in everything. From dragon lullabies to storm songs, resonance guides your most potent spells.",
    },
    essence: {
      name: "House of Essence",
      description: "You read the air itself. Fragrance, flavor, and memory weave your craft, coaxing calm and vivid futures.",
    },
  };

  function clearQuizFeedback() {
    if (quizResult) {
      quizResult.replaceChildren();
      const title = document.createElement("h4");
      title.textContent = "Awaiting your answers";
      const body = document.createElement("p");
      body.className = "muted";
      body.textContent = "Complete all prompts to hear the academy's verdict.";
      quizResult.append(title, body);
    }
    if (quizStatus) quizStatus.textContent = "";
    quizForm?.querySelectorAll(".questionCard").forEach((field) => field.classList.remove("hasError"));
  }

  quizForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!quizForm) return;

    clearQuizFeedback();

    const formData = new FormData(quizForm);
    const counts = { touch: 0, sight: 0, sound: 0, essence: 0 };
    let valid = true;

    quizForm.querySelectorAll(".questionCard").forEach((field) => {
      const question = field.getAttribute("data-question");
      const choice = question ? formData.get(question) : null;
      if (!choice) {
        valid = false;
        field.classList.add("hasError");
      } else {
        if (choice in counts) {
          counts[choice] += 1;
        }
      }
    });

    if (!valid) {
      if (quizStatus) quizStatus.textContent = "Answer each prompt to complete the ritual.";
      return;
    }

    const entries = Object.entries(counts);
    const highest = Math.max(...entries.map(([, value]) => value));
    const winners = entries.filter(([, value]) => value === highest).map(([key]) => key);
    const schoolKey = winners[0];
    const school = schoolCopy[schoolKey];

    if (quizResult && school) {
      const title = document.createElement("h4");
      title.textContent = `${school.name} awaits you.`;

      const body = document.createElement("p");
      body.className = "muted";
      body.textContent = school.description;

      const scoreLine = document.createElement("p");
      scoreLine.className = "muted small";
      scoreLine.textContent = `Attunement: Touch ${counts.touch} • Sight ${counts.sight} • Sound ${counts.sound} • Essence ${counts.essence}`;

      quizResult.replaceChildren(title, body, scoreLine);
      if (quizStatus) quizStatus.textContent = "✨ The stars hum in agreement.";
    }
  });

  quizForm?.addEventListener("reset", () => {
    clearQuizFeedback();
  });

  if (quizResult && quizForm) {
    clearQuizFeedback();
  }

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
