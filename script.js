(function () {
  const root = document.documentElement;
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  const postFeed = document.getElementById("postFeed");

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

  // Lore board rendering
  async function renderLoreBoard() {
    if (!postFeed) return;

    const setMessage = (message) => {
      postFeed.innerHTML = "";
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = message;
      postFeed.appendChild(p);
    };

    try {
      const response = await fetch("./data/posts.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const posts = await response.json();

      if (!Array.isArray(posts) || posts.length === 0) {
        setMessage("No notices on the board yet. Check back after the daily quill writes again.");
        return;
      }

      const sorted = posts
        .filter((post) => post?.createdAt)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 20);

      postFeed.innerHTML = "";

      sorted.forEach((post) => {
        const card = document.createElement("article");
        card.className = "post";

        const top = document.createElement("div");
        top.className = "postTop";

        const author = document.createElement("span");
        author.className = "postAuthor";
        author.textContent = post.author || "Unknown scribe";

        const meta = document.createElement("span");
        meta.className = "postMeta";
        const school = post.school || "Unknown hall";
        const date = post.createdAt ? new Date(post.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Unknown time";
        meta.textContent = `${school} • ${date}`;

        top.append(author, meta);

        const body = document.createElement("p");
        body.className = "postBody";
        body.textContent = post.text || "A missing scrap of parchment.";

        card.append(top, body);
        postFeed.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      setMessage("The quill is resting. Unable to fetch the Lore Board right now.");
    }
  }

  renderLoreBoard();

  // Quiz (sorting ritual page only)
  const quizForm = document.getElementById("schoolQuiz");
  const quizResult = document.getElementById("quizResult");
  const quizStatus = document.getElementById("quizStatus");

  if (quizForm && quizResult) {
    const schoolCopy = {
      touch: {
        name: "Chamber of Touch",
        fit: "Your choices favored texture, warmth, and the certainty of things held in hand. You steady spells by feeling their shape and making them tangible.",
        invitation:
          "Within the Chamber of Touch you'll learn shield-weaving, tactile sigils, and restorative crafts—building wards and tools that pulse with your intent.",
        status: "You lead with grounding sensation and craft, anchoring magic through touch.",
      },
      sight: {
        name: "Observatory of Sight",
        fit: "You read meaning in diagrams, glints, and constellations. Patterns reveal themselves quickly to you, and you navigate by the stories light tells.",
        invitation:
          "The Observatory of Sight will refine your focus through star charts, illusion wards, and mapwork of ley lines—teaching you to draw the unseen into view.",
        status: "You lead with a precise gaze, mapping possibilities before others sense them.",
      },
      sound: {
        name: "Choir of Sound",
        fit: "Vibration, cadence, and harmony guide your focus. You listen between words and tune your magic like an instrument until everything resonates.",
        invitation:
          "The Choir of Sound pairs you with conductors who teach resonance spells, storm-calming chorales, and voice-bound wards that answer your rhythm.",
        status: "You lead with resonance and cadence, coaxing harmony from every element.",
      },
      essence: {
        name: "House of Essence",
        fit: "Memory and mood speak to you through aroma and flavor. You notice the way scent changes a room and trace emotion through what lingers in the air.",
        invitation:
          "Within the House of Essence you'll study aromatic divination, healing brews, and atmosphere-shaping rituals that braid memory into every casting.",
        status: "You lead with memory-rich essences, shaping spells through taste and scent.",
      },
    };

    function clearQuizFeedback() {
      quizForm.querySelectorAll(".questionCard").forEach((field) => field.classList.remove("hasError"));

      quizResult.replaceChildren();
      const title = document.createElement("h4");
      title.textContent = "Awaiting your answers";
      const body = document.createElement("p");
      body.className = "muted";
      body.textContent = "Complete all prompts to hear the academy's verdict.";
      quizResult.append(title, body);

      if (quizStatus) quizStatus.textContent = "";
    }

    quizForm.addEventListener("submit", (e) => {
      e.preventDefault();

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
        } else if (choice in counts) {
          counts[choice] += 1;
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

      if (school) {
        const isTie = winners.length > 1;
        const winningNames = winners.map((key) => schoolCopy[key]?.name || key);

        const title = document.createElement("h4");
        title.textContent = isTie ? `A braided attunement` : `${school.name} awaits you.`;

        const body = document.createElement("p");
        body.className = "resultDetail";
        body.textContent = isTie
          ? `Your answers resonate with ${winningNames.join(" and ")}. Multiple senses are calling—follow the one that sparks the clearest curiosity today.`
          : school.fit;

        const detail = document.createElement("p");
        detail.className = "muted";
        detail.textContent = isTie
          ? "Explore the wings that echo your favorite senses; mentors will help you weave them into a singular craft."
          : school.invitation;

        quizResult.replaceChildren(title, body, detail);

        if (quizStatus) {
          const headline = isTie
            ? `You harmonize with ${winningNames.join(" or ")}.`
            : `${school.name}: ${school.status}`;
          quizStatus.textContent = headline;
        }
      }
    });

    quizForm.addEventListener("reset", () => {
      clearQuizFeedback();
    });

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
