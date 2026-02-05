(() => {
  const DATA_URL = "./data/map-locations.json";

  const stage = document.getElementById("mapStage");
  const pinsLayer = document.getElementById("mapPins");
  const listEl = document.getElementById("mapList");

  const modal = document.getElementById("mapModal");
  const modalTitle = document.getElementById("mapModalTitle");
  const modalBlurb = document.getElementById("mapModalBlurb");
  const modalLink = document.getElementById("mapModalLink");
  const modalCopy = document.getElementById("mapModalCopy");
  const modalClose = document.getElementById("mapModalClose");
  const modalMedia = document.getElementById("mapModalMedia");
  const modalImage = document.getElementById("mapModalImage");

  let locations = [];
  let activeId = null;

  function normalizeHash() {
    return (location.hash || "").replace(/^#/, "").trim();
  }

  function setActivePin(id) {
    activeId = id;
    const buttons = Array.from(pinsLayer.querySelectorAll("button[data-id]"));
    buttons.forEach((btn) => {
      btn.classList.toggle("isActive", btn.dataset.id === id);
    });
  }

  function openModal(loc, { pushHash = true } = {}) {
    if (!loc) return;

    modalTitle.textContent = loc.title;
    modalBlurb.textContent = loc.blurb;
    modalLink.href = loc.href;


    // Optional preview image (e.g., Cathedral/Church)
    if (modalMedia && modalImage) {
      if (loc.previewImage) {
        modalImage.src = loc.previewImage;
        modalImage.alt = loc.previewImageAlt || (loc.title + " preview");
        modalMedia.hidden = false;
      } else {
        modalImage.removeAttribute("src");
        modalImage.alt = "";
        modalMedia.hidden = true;
      }
    }

    const url = new URL(location.href);
    url.hash = loc.id;

    modalCopy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(url.toString());
        modalCopy.textContent = "Link copied";
        window.setTimeout(() => (modalCopy.textContent = "Copy link"), 1200);
      } catch {
        // Fallback: select + prompt
        window.prompt("Copy this link:", url.toString());
      }
    };

    setActivePin(loc.id);

    if (pushHash) {
      history.replaceState(null, "", `#${loc.id}`);
    }

    if (typeof modal.showModal === "function") {
      if (!modal.open) modal.showModal();
    } else {
      modal.setAttribute("open", "");
    }

    // Focus the close button so keyboard users land safely.
    window.setTimeout(() => modalClose?.focus(), 0);
  }

  function closeModal({ clearHash = false } = {}) {
    if (typeof modal.close === "function" && modal.open) {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }

    setActivePin(null);

    if (clearHash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  function findLocation(id) {
    return locations.find((l) => l.id === id) || null;
  }

  function buildPin(loc) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mapPin";
    btn.style.left = `${loc.leftPct}%`;
    btn.style.top = `${loc.topPct}%`;
    btn.dataset.id = loc.id;
    btn.setAttribute("aria-label", `Open ${loc.title}`);

    const label = document.createElement("span");
    label.className = "mapPinLabel";
    label.textContent = loc.title;
    btn.appendChild(label);

    btn.addEventListener("click", () => openModal(loc));

    return btn;
  }

  function buildCard(loc) {
    // Under-map list: show ONLY the location title (no blurbs).
    // Clicking the title previews the location (and the modal still offers "Read more").
    const card = document.createElement("button");
    card.type = "button";
    card.className = "post mapCard mapListItem";
    card.setAttribute("aria-label", `Preview ${loc.title}`);

    const top = document.createElement("div");
    top.className = "mapCardTitle";

    const h = document.createElement("h3");
    h.textContent = loc.title;

    top.appendChild(h);
    card.appendChild(top);

    card.addEventListener("click", () => {
      openModal(loc);
      stage?.scrollIntoView({ block: "start", behavior: "smooth" });
    });

    return card;
  }

  async function loadLocationsData() {
    // Prefer embedded JS data (works even when opening map.html via file://)
    const embedded = window.MAP_LOCATIONS_DATA || window.MAP_LOCATIONS;
    if (embedded && Array.isArray(embedded.locations)) {
      return embedded;
    }

    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);
    return await res.json();
  }

  async function init() {
    try {
      const data = await loadLocationsData();

      locations = Array.isArray(data.locations) ? data.locations : [];

      // Render pins
      const fragPins = document.createDocumentFragment();
      locations.forEach((loc) => fragPins.appendChild(buildPin(loc)));
      pinsLayer.appendChild(fragPins);

      // Render list
      if (listEl) {
        const fragList = document.createDocumentFragment();
        locations.forEach((loc) => fragList.appendChild(buildCard(loc)));
        listEl.appendChild(fragList);
      }

      // Modal wiring
      modalClose?.addEventListener("click", () => closeModal({ clearHash: true }));

      modal?.addEventListener("click", (e) => {
        // Click outside modal content closes it
        const rect = modal.getBoundingClientRect();
        const inside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (!inside) closeModal({ clearHash: true });
      });

      modal?.addEventListener("close", () => {
        setActivePin(null);
      });

      // Deep link via hash
      const hashId = normalizeHash();
      if (hashId) {
        const loc = findLocation(hashId);
        if (loc) openModal(loc, { pushHash: false });
      }

      window.addEventListener("hashchange", () => {
        const id = normalizeHash();
        if (!id) {
          closeModal();
          return;
        }
        const loc = findLocation(id);
        if (loc) openModal(loc, { pushHash: false });
      });
    } catch (err) {
      console.error(err);
      if (listEl) {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = "Map data couldn't load. If you opened this page as a local file (file://), browsers block fetch(). Run the site with server.js, or rely on data/map-locations.js (included).";
        listEl.appendChild(p);
      }
    }
  }

  init();
})();
