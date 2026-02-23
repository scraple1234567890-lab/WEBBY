import { supabase } from "./supabaseClient.js";
import { getSessionSafe, isAbortLikeError } from "./authSession.js";

const articlesContainer = document.getElementById("articles");
const articleComposerCard = document.getElementById("article-composer-card");
const shareArticleBtn = document.getElementById("share-article-btn");
const closeArticleComposerBtn = document.getElementById("close-article-composer");
const mustLogin = document.getElementById("must-login");

const articleForm = document.getElementById("new-article-form");
const articleTitleInput = document.getElementById("article-title");
const articleTagsInput = document.getElementById("article-tags");
const articleEditor = document.getElementById("article-editor");
const articleContentField = document.getElementById("article-content");
const articleToolbar = document.getElementById("article-toolbar");
const articleStatus = document.getElementById("article-status");
const articleSubmit = document.getElementById("article-submit");

const coverInput = document.getElementById("article-image");
const coverPreviewWrap = document.getElementById("article-image-preview");
const coverPreviewImg = coverPreviewWrap?.querySelector("img");
const coverClearBtn = document.getElementById("article-image-clear");

const searchToggle = document.getElementById("article-search-toggle");
const searchPanel = document.getElementById("article-search-panel");
const searchInput = document.getElementById("article-search");
const searchClear = document.getElementById("article-search-clear");
const searchMeta = document.getElementById("article-search-meta");
const tagShelf = document.getElementById("article-tag-shelf");
const tagChips = document.getElementById("article-tag-chips");

const decreeWrap = document.getElementById("cq-decree-wrap");
const decreeContainer = document.getElementById("cq-decrees");
const featuredWrap = document.getElementById("cq-featured-wrap");
const featuredContainer = document.getElementById("cq-featured");
const featuredBreak = document.getElementById("cq-featured-break");
const featuredCheckbox = document.getElementById("article-featured");

let currentUser = null;
let articlesCache = [];
let activeQuery = "";
let activeTag = "";

function setStatus(message, tone = "muted") {
  if (!(articleStatus instanceof HTMLElement)) return;
  articleStatus.textContent = message || "";
  articleStatus.className = `${tone} small`;
}

function setSubmitEnabled(enabled) {
  if (!(articleSubmit instanceof HTMLButtonElement)) return;
  articleSubmit.disabled = !enabled;
  articleSubmit.textContent = enabled ? "Publish" : "Publishing...";
}

function getDisplayNameFromUser(user) {
  const meta = user?.user_metadata || {};
  return meta.displayName || meta.full_name || meta.name || user?.email || "Member";
}

function toggleAuthUI(isLoggedIn) {
  if (mustLogin instanceof HTMLElement) {
    mustLogin.style.display = isLoggedIn ? "none" : "block";
  }
  if (shareArticleBtn instanceof HTMLButtonElement) {
    shareArticleBtn.disabled = !isLoggedIn;
    shareArticleBtn.setAttribute("aria-expanded", shareArticleBtn.getAttribute("aria-expanded") || "false");
  }
  if (!isLoggedIn) {
    closeArticleComposer();
  }
}

function openArticleComposer() {
  if (!(articleComposerCard instanceof HTMLElement)) return;
  articleComposerCard.hidden = false;
  shareArticleBtn?.setAttribute("aria-expanded", "true");
  syncFeaturedCheckboxFromTags();
  articleTitleInput?.focus();
}

function closeArticleComposer() {
  if (!(articleComposerCard instanceof HTMLElement)) return;
  articleComposerCard.hidden = true;
  shareArticleBtn?.setAttribute("aria-expanded", "false");
}

function stripHtml(input = "") {
  const div = document.createElement("div");
  div.innerHTML = input;
  return (div.textContent || div.innerText || "").trim();
}

function formatDateOnly(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function normalizeTags(tagsValue) {
  if (!tagsValue) return [];
  if (Array.isArray(tagsValue)) {
    return tagsValue
      .map((t) => String(t || "").trim())
      .filter(Boolean)
      .slice(0, 40);
  }

  return String(tagsValue)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function isFeaturedArticle(article) {
  const tags = normalizeTags(article?.tags);
  return tags.some((t) => String(t || "").trim().toLowerCase() === "featured");
}

function isRoyalDecreeArticle(article) {
  const tags = normalizeTags(article?.tags).map((t) => String(t || "").trim().toLowerCase());
  return tags.some((t) => (
    t === "royal decree" ||
    t === "royal decrees" ||
    t === "decree" ||
    t === "decrees" ||
    t === "royal office" ||
    t === "crown decree"
  ));
}

function makeExcerptFromHtml(html, maxLen = 170) {
  const text = stripHtml(String(html || ""));
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, "").trim() + "…";
}

function jumpToArticle(id) {
  if (!id) return;
  const target = articlesContainer?.querySelector?.(`.articleItem[data-id="${id}"]`);
  if (!(target instanceof HTMLElement)) return;

  target.scrollIntoView({ behavior: "smooth", block: "start" });

  const toggle = target.querySelector?.(".articleToggle");
  if (toggle instanceof HTMLButtonElement) {
    const expanded = target.classList.contains("isExpanded");
    if (!expanded) toggle.click();
  }
}

function renderRoyalDecreeShelf(allArticles) {
  if (!(decreeWrap instanceof HTMLElement) || !(decreeContainer instanceof HTMLElement)) return;

  // Keep search mode focused on results.
  if (((activeQuery || "").trim()) || ((activeTag || "").trim())) {
    decreeWrap.hidden = true;
    decreeContainer.innerHTML = "";
    return;
  }

  const decrees = (allArticles || []).filter(isRoyalDecreeArticle).slice(0, 4);
  decreeContainer.innerHTML = "";

  if (!decrees.length) {
    decreeWrap.hidden = false;
    const empty = document.createElement("div");
    empty.className = "cqFeaturedCard cqDecreeCard cqDecreeEmpty";
    empty.setAttribute("role", "note");

    const body = document.createElement("div");
    body.className = "cqFeaturedBody";

    const kicker = document.createElement("p");
    kicker.className = "cqFeaturedKicker";
    kicker.textContent = "Royal Decree";

    const title = document.createElement("p");
    title.className = "cqFeaturedTitleText";
    title.textContent = "No decrees posted yet";

    const note = document.createElement("p");
    note.className = "cqFeaturedExcerpt";
    note.textContent = "When the Crown issues an announcement, it will appear here. Use the tag ‘Royal Decree’ on an article to test the display.";

    body.append(kicker, title, note);
    empty.appendChild(body);
    decreeContainer.appendChild(empty);
    return;
  }

  decreeWrap.hidden = false;

  decrees.forEach((article) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cqFeaturedCard cqDecreeCard";
    btn.dataset.id = article.id;
    btn.addEventListener("click", () => jumpToArticle(article.id));

    const coverUrl = article.cover_image_url || article.cover_url || article.image_url || article.image;
    if (coverUrl) {
      const cover = document.createElement("div");
      cover.className = "cqFeaturedCover";

      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = "";
      img.src = coverUrl;

      cover.appendChild(img);
      btn.appendChild(cover);
    }

    const body = document.createElement("div");
    body.className = "cqFeaturedBody";

    const kicker = document.createElement("p");
    kicker.className = "cqFeaturedKicker";
    kicker.textContent = "Royal Decree";

    const title = document.createElement("p");
    title.className = "cqFeaturedTitleText";
    title.textContent = article.title || "Untitled decree";

    const meta = document.createElement("div");
    meta.className = "cqFeaturedMeta";

    const author = document.createElement("p");
    author.className = "muted small";
    const authorName =
      article.author_display_name ||
      article.author ||
      (currentUser && article.user_id === currentUser.id ? getDisplayNameFromUser(currentUser) : "") ||
      "Royal Office";
    author.textContent = `By ${authorName}`;

    const date = document.createElement("p");
    date.className = "muted small";
    date.textContent = formatDateOnly(article.created_at);

    meta.append(author, date);

    const excerpt = document.createElement("p");
    excerpt.className = "cqFeaturedExcerpt";
    excerpt.textContent = makeExcerptFromHtml(article.content || "", 190);

    body.append(kicker, title, meta);
    if (excerpt.textContent) body.appendChild(excerpt);

    btn.appendChild(body);
    decreeContainer.appendChild(btn);
  });
}

function renderFeaturedShelf(allArticles) {
  if (!(featuredWrap instanceof HTMLElement) || !(featuredContainer instanceof HTMLElement)) return;

  // Hide the shelf during active searches so the results feel clean and focused.
  if (((activeQuery || "").trim()) || ((activeTag || "").trim())) {
    featuredWrap.hidden = true;
    if (featuredBreak instanceof HTMLElement) featuredBreak.hidden = true;
    featuredContainer.innerHTML = "";
    return;
  }

  const featured = (allArticles || []).filter(isFeaturedArticle).slice(0, 6);
  featuredContainer.innerHTML = "";

  if (!featured.length) {
    featuredWrap.hidden = true;
    if (featuredBreak instanceof HTMLElement) featuredBreak.hidden = true;
    return;
  }

  featuredWrap.hidden = false;
  if (featuredBreak instanceof HTMLElement) featuredBreak.hidden = false;

  featured.forEach((article) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cqFeaturedCard";
    btn.dataset.id = article.id;
    btn.addEventListener("click", () => jumpToArticle(article.id));

    const coverUrl = article.cover_image_url || article.cover_url || article.image_url || article.image;
    if (coverUrl) {
      const cover = document.createElement("div");
      cover.className = "cqFeaturedCover";

      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = "";
      img.src = coverUrl;

      cover.appendChild(img);
      btn.appendChild(cover);
    }

    const body = document.createElement("div");
    body.className = "cqFeaturedBody";

    const kicker = document.createElement("p");
    kicker.className = "cqFeaturedKicker";
    kicker.textContent = "Featured";

    const title = document.createElement("p");
    title.className = "cqFeaturedTitleText";
    title.textContent = article.title || "Untitled article";

    const meta = document.createElement("div");
    meta.className = "cqFeaturedMeta";

    const author = document.createElement("p");
    author.className = "muted small";
    const authorName =
      article.author_display_name ||
      article.author ||
      (currentUser && article.user_id === currentUser.id ? getDisplayNameFromUser(currentUser) : "") ||
      "Unknown author";
    author.textContent = `By ${authorName}`;

    const date = document.createElement("p");
    date.className = "muted small";
    date.textContent = formatDateOnly(article.created_at);

    meta.append(author, date);

    const excerpt = document.createElement("p");
    excerpt.className = "cqFeaturedExcerpt";
    excerpt.textContent = makeExcerptFromHtml(article.content || "", 190);

    body.append(kicker, title, meta);
    if (excerpt.textContent) body.appendChild(excerpt);

    btn.appendChild(body);
    featuredContainer.appendChild(btn);
  });
}

function tagMatches(tag, query) {
  if (!tag || !query) return false;
  return tag.toLowerCase().includes(query.toLowerCase());
}

function articleMatchesQuery(article, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;

  const title = String(article?.title || "").toLowerCase();
  const tags = normalizeTags(article?.tags).join(" ").toLowerCase();
  const body = stripHtml(String(article?.content || "")).toLowerCase();

  return title.includes(q) || tags.includes(q) || body.includes(q);
}

function articleMatchesTag(article, tag) {
  if (!tag) return true;
  return normalizeTags(article?.tags).some((t) => t.toLowerCase() === tag.toLowerCase());
}

function buildTagShelf(articles) {
  if (!(tagChips instanceof HTMLElement) || !(tagShelf instanceof HTMLElement)) return;

  const counts = new Map();
  articles.forEach((a) => {
    normalizeTags(a?.tags).forEach((t) => {
      const key = t.toLowerCase();
      counts.set(key, { label: t, count: (counts.get(key)?.count || 0) + 1 });
    });
  });

  const sorted = Array.from(counts.entries())
    .map(([, value]) => value)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 18);

  tagChips.innerHTML = "";
  if (!sorted.length) {
    tagShelf.hidden = true;
    return;
  }

  sorted.forEach(({ label, count }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tagChip ${activeTag && activeTag.toLowerCase() === label.toLowerCase() ? "isActive" : ""}`;
    btn.textContent = `${label} (${count})`;
    btn.addEventListener("click", () => {
      activeTag = label;
      if (searchInput instanceof HTMLInputElement) {
        searchInput.value = label;
      }
      activeQuery = label;
      applyFiltersAndRender();
      searchPanel?.removeAttribute("hidden");
      if (searchToggle instanceof HTMLButtonElement) {
        searchToggle.setAttribute("aria-expanded", "true");
      }
    });
    tagChips.appendChild(btn);
  });

  tagShelf.hidden = false;
}

function setSearchMeta(text) {
  if (!(searchMeta instanceof HTMLElement)) return;
  searchMeta.textContent = text || "";
}

function applyFiltersAndRender() {
  const filtered = articlesCache
    .filter((a) => articleMatchesQuery(a, activeQuery))
    .filter((a) => articleMatchesTag(a, activeTag));
  const visibleInAllStories = filtered.filter((a) => !isRoyalDecreeArticle(a));

  if (searchClear instanceof HTMLButtonElement) {
    const hasQuery = Boolean((activeQuery || "").trim());
    searchClear.disabled = !hasQuery;
  }

  if (activeQuery || activeTag) {
    setSearchMeta(`${visibleInAllStories.length} result${visibleInAllStories.length === 1 ? "" : "s"} found`);
  } else {
    setSearchMeta("");
  }
  renderRoyalDecreeShelf(articlesCache);
  renderFeaturedShelf(articlesCache);
  renderArticles(visibleInAllStories);
  buildTagShelf(articlesCache);
}

function sanitizeHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ""), "text/html");

  doc.querySelectorAll("script, style, iframe, object, embed").forEach((node) => node.remove());

  doc.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes || []).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || "");
      if (name.startsWith("on")) node.removeAttribute(attr.name);
      if (name === "href" && value.trim().toLowerCase().startsWith("javascript:")) node.removeAttribute(attr.name);
      if (name === "src" && value.trim().toLowerCase().startsWith("javascript:")) node.removeAttribute(attr.name);
    });
  });

  return doc.body.innerHTML || "";
}

function formatArticleContent(html) {
  const sanitized = sanitizeHtml(html);
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, "text/html");
  const body = doc.body;
  const hasBlockElements = Boolean(
    body.querySelector("p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, figure, img, picture"),
  );

  if (!hasBlockElements) {
    const text = body.textContent || "";
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((segment) => segment.replace(/\n+/g, " ").trim())
      .filter(Boolean);

    body.innerHTML = "";
    paragraphs.forEach((paragraph) => {
      const p = doc.createElement("p");
      p.textContent = paragraph;
      body.appendChild(p);
    });
  }

  return body.innerHTML || "";
}

function createTagList(tags) {
  const list = document.createElement("div");
  list.className = "tagList";

  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tagPill";
    button.textContent = tag;
    button.addEventListener("click", () => {
      activeTag = tag;
      activeQuery = tag;
      if (searchInput instanceof HTMLInputElement) {
        searchInput.value = tag;
      }
      applyFiltersAndRender();
      if (searchPanel instanceof HTMLElement) {
        searchPanel.hidden = false;
      }
      if (searchToggle instanceof HTMLButtonElement) {
        searchToggle.setAttribute("aria-expanded", "true");
      }
    });
    list.appendChild(button);
  });

  return list;
}

function renderArticles(articles) {
  if (!(articlesContainer instanceof HTMLElement)) return;

  articlesContainer.innerHTML = "";

  if (!articles.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No articles yet. Publish the first writeup!";
    articlesContainer.appendChild(empty);
    return;
  }

  articles.forEach((article) => {
    const card = document.createElement("article");
    card.className = "card articleItem cqArticleCard cqFeaturedCard";
    card.dataset.id = article.id;

    const coverUrl = article.cover_image_url || article.cover_url || article.image_url || article.image;
    let cover = null;
    if (coverUrl) {
      cover = document.createElement("div");
      cover.className = "articleCover cqFeaturedCover";

      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = "";
      img.src = coverUrl;

      cover.appendChild(img);
    }

    const shell = document.createElement("div");
    shell.className = "articleCardShell cqFeaturedBody";

    const kicker = document.createElement("p");
    kicker.className = "cqFeaturedKicker articleKicker";
    const isDecree = isRoyalDecreeArticle(article);
    const isFeatured = isFeaturedArticle(article);
    kicker.textContent = isDecree ? "Royal Decree" : (isFeatured ? "Featured" : "Story");

    const title = document.createElement("h3");
    title.className = "articleTitle cqFeaturedTitleText";
    title.textContent = article.title || "Untitled article";

    if (isDecree) {
      const badge = document.createElement("span");
      badge.className = "cqBadgeDecree";
      badge.textContent = "Royal Decree";
      title.append(" ");
      title.appendChild(badge);
    }

    if (isFeatured) {
      const badge = document.createElement("span");
      badge.className = "cqBadgeFeatured";
      badge.textContent = "Featured";
      title.append(" ");
      title.appendChild(badge);
    }

    const meta = document.createElement("div");
    meta.className = "articleMetaRow cqFeaturedMeta";

    const author = document.createElement("p");
    author.className = "muted small";
    const authorName =
      article.author_display_name ||
      article.author ||
      (currentUser && article.user_id === currentUser.id ? getDisplayNameFromUser(currentUser) : "") ||
      "Unknown author";
    author.textContent = `By ${authorName}`;

    const date = document.createElement("p");
    date.className = "muted small";
    date.textContent = formatDateOnly(article.created_at);

    meta.append(author, date);

    const excerpt = document.createElement("p");
    excerpt.className = "articleExcerpt cqFeaturedExcerpt";
    excerpt.textContent = makeExcerptFromHtml(article.content || "", 190);

    const tags = normalizeTags(article.tags);
    const tagList = tags.length ? createTagList(tags) : null;

    const body = document.createElement("div");
    body.className = "articleBody";

    const fullHtml = formatArticleContent(article.content || "");
    const fullEl = document.createElement("div");
    fullEl.className = "articleFull";
    fullEl.innerHTML = fullHtml;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn ghost btnSm articleToggle";
    toggle.textContent = "Read more";
    toggle.addEventListener("click", () => {
      const expanded = card.classList.toggle("isExpanded");
      fullEl.hidden = !expanded;
      if (excerpt.textContent) excerpt.hidden = expanded;
      toggle.textContent = expanded ? "Show less" : "Read more";
    });

    fullEl.hidden = true;

    shell.append(kicker, title, meta);
    if (excerpt.textContent) shell.appendChild(excerpt);
    if (tagList) shell.appendChild(tagList);
    body.append(fullEl, toggle);
    shell.appendChild(body);

    if (cover) card.appendChild(cover);
    card.appendChild(shell);

    articlesContainer.appendChild(card);
  });
}

async function loadArticles() {
  if (!(articlesContainer instanceof HTMLElement)) return;
  articlesContainer.innerHTML = '<p class="muted">Loading articles...</p>';

  try {
    const { data, error } = await supabase
      .from("articles")
      .select(
        "id, title, content, tags, created_at, user_id, author_display_name, cover_image_url, cover_url, image_url, image",
      )
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) throw error;

    articlesCache = data || [];
    applyFiltersAndRender();
  } catch (error) {
    console.error("Error loading articles", error);
    articlesContainer.innerHTML = "";
    const p = document.createElement("p");
    p.className = "error";
    p.textContent = `Error loading articles: ${error?.message || "Unknown error"}`;
    articlesContainer.appendChild(p);
  }
}

function execCmd(cmd, value = null) {
  if (!articleEditor) return;
  articleEditor.focus();
  try {
    document.execCommand(cmd, false, value);
  } catch (error) {
    console.warn("Command failed", cmd, error);
  }
}

function execBlock(tagName) {
  if (!tagName) return;
  const block = String(tagName).toLowerCase() === "blockquote" ? "blockquote" : tagName;
  execCmd("formatBlock", block);
}

function insertHtml(html) {
  if (!html) return;
  execCmd("insertHTML", html);
}

function onToolbarClick(event) {
  const button = event.target?.closest("button");
  if (!button) return;

  const cmd = button.getAttribute("data-cmd");
  const block = button.getAttribute("data-block");

  if (cmd) {
    execCmd(cmd);
  } else if (block) {
    execBlock(block);
  }
}

function promptForLink() {
  const url = window.prompt("Enter a URL (https://...)");
  if (!url) return;
  const safe = url.trim();
  if (!safe) return;
  execCmd("createLink", safe);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function compressImage(file, options = {}) {
  const maxWidth = options.maxWidth || 1400;
  const maxHeight = options.maxHeight || 1000;
  const quality = options.quality ?? 0.82;

  const dataUrl = await readFileAsDataUrl(file);
  const img = document.createElement("img");
  img.decoding = "async";
  img.src = dataUrl;

  await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
  });

  let { width, height } = img;
  if (!width || !height) {
    return { blob: file, dataUrl };
  }

  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { blob: file, dataUrl };

  ctx.drawImage(img, 0, 0, targetW, targetH);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return { blob: file, dataUrl };

  return {
    blob,
    dataUrl: canvas.toDataURL("image/jpeg", quality),
  };
}

async function insertInlineImages(files) {
  if (!files?.length) return;

  if (!currentUser) {
    setStatus("Please log in before inserting images.", "error");
    return;
  }

  for (const file of files) {
    if (!file?.type?.startsWith("image/")) continue;

    // Compress the image to keep uploads light.
    const { blob } = await compressImage(file, { maxWidth: 1100, maxHeight: 1100, quality: 0.84 });

    // Upload to Supabase Storage and insert the public URL into the HTML
    const uploadedUrl = await tryUploadCover(blob, file.name || "inline");

    if (!uploadedUrl) {
      setStatus("Inline image upload failed. Check your 'article-images' bucket + policies.", "error");
      continue;
    }

    const html = `<figure class="richFigure size-md align-center"><img src="${uploadedUrl}" alt="" loading="lazy"></figure>`;
    insertHtml(html);
  }
}

function onEditorDrop(event) {
  const files = Array.from(event.dataTransfer?.files || []);
  const imageFiles = files.filter((f) => f?.type?.startsWith("image/"));
  if (!imageFiles.length) return;
  event.preventDefault();
  insertInlineImages(imageFiles);
}

function onEditorPaste(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const images = items
    .map((i) => (i.type?.startsWith("image/") ? i.getAsFile() : null))
    .filter(Boolean);

  if (!images.length) return;
  event.preventDefault();
  insertInlineImages(images);
}

function syncHiddenContent() {
  if (!(articleContentField instanceof HTMLTextAreaElement) || !(articleEditor instanceof HTMLElement)) return;
  const html = articleEditor.innerHTML || "";
  articleContentField.value = html;
}

function resetCoverPreview() {
  if (!(coverPreviewWrap instanceof HTMLElement)) return;
  coverPreviewWrap.hidden = true;
  if (coverPreviewImg instanceof HTMLImageElement) {
    coverPreviewImg.removeAttribute("src");
  }
  if (coverInput instanceof HTMLInputElement) {
    coverInput.value = "";
  }
}

function updateCoverPreview(dataUrl) {
  if (!(coverPreviewWrap instanceof HTMLElement) || !(coverPreviewImg instanceof HTMLImageElement)) return;
  coverPreviewImg.src = dataUrl;
  coverPreviewWrap.hidden = false;
}

async function tryUploadCover(blob, filename) {
  try {
    const bucket = supabase.storage.from("article-images");
    const safeName = String(filename || "image").replace(/[^a-z0-9_.-]+/gi, "_").slice(0, 80);
    const nonce = (crypto?.randomUUID ? crypto.randomUUID() : `${Math.random().toString(16).slice(2)}${Date.now()}`);
    const path = `${currentUser?.id || "anon"}/${Date.now()}-${nonce}-${safeName}.jpg`;

    const { error: uploadError } = await bucket.upload(path, blob, {
      upsert: true,
      contentType: blob.type || "image/jpeg",
    });
    if (uploadError) throw uploadError;

    const { data } = bucket.getPublicUrl(path);
    const url = data?.publicUrl;
    if (!url) throw new Error("No public URL returned");
    return url;
  } catch (error) {
    console.warn("Image upload failed.", error);
    return null;
  }
}

async function getCoverUrlFromInput() {
  const file = coverInput?.files?.[0];
  if (!file) return null;

  const { blob, dataUrl } = await compressImage(file, { maxWidth: 1800, maxHeight: 1200, quality: 0.82 });

  // Try storage upload first; if it fails, embed as data URL.
  const uploaded = await tryUploadCover(blob, file.name || "cover");
  return uploaded || dataUrl || null;
}

async function insertArticleRow(payload) {
  const variants = [
    payload,
    // If columns don't exist, try with fewer optional fields.
    (({ cover_image_url, cover_url, image_url, image, tags, author_display_name, ...rest }) => rest)(payload),
    (({ cover_image_url, cover_url, image_url, image, tags, ...rest }) => rest)(payload),
    (({ cover_image_url, cover_url, image_url, image, ...rest }) => rest)(payload),
  ];

  let lastError = null;
  for (const attempt of variants) {
    try {
      const cleaned = Object.fromEntries(Object.entries(attempt).filter(([, v]) => v !== undefined));
      const { data, error } = await supabase.from("articles").insert([cleaned]).select("id").single();
      if (!error) return data;
      lastError = error;
      const message = String(error?.message || "").toLowerCase();
      if (message.includes("column") || message.includes("schema cache") || message.includes("does not exist")) {
        continue;
      }
      break;
    } catch (error) {
      lastError = error;
      break;
    }
  }

  if (lastError) throw lastError;
  throw new Error("Unable to publish article.");
}

async function handlePublish(event) {
  event.preventDefault();

  if (!currentUser) {
    setStatus("Please log in to publish an article.", "error");
    return;
  }

  const title = (articleTitleInput?.value || "").trim();
  if (!title) {
    setStatus("Title is required.", "error");
    articleTitleInput?.focus();
    return;
  }

  syncHiddenContent();
  const rawHtml = articleContentField?.value || "";
  const cleanedHtml = sanitizeHtml(rawHtml);
  const bodyText = stripHtml(cleanedHtml);

  // Prevent massive base64-embedded images from ballooning the HTML.
  if (/data:image\//i.test(cleanedHtml)) {
    setStatus("This article contains embedded (base64) images. Remove them and re-add images via drag/drop so they upload to storage.", "error");
    return;
  }

  // Guard against unusually large HTML payloads (even if the visible text is small).
  if (cleanedHtml.length > 1800000) {
    setStatus("This article HTML is too large. Remove embedded images and try again.", "error");
    return;
  }


  if (!bodyText) {
    setStatus("Article body cannot be empty.", "error");
    articleEditor?.focus();
    return;
  }

  if (bodyText.length > 12000) {
    setStatus("Please shorten your article body (12,000 characters max).", "error");
    return;
  }

  const tags = normalizeTags(articleTagsInput?.value || "");
  const tagsString = tags.join(", ");

  setSubmitEnabled(false);
  setStatus("Publishing...");

  try {
    const coverUrl = await getCoverUrlFromInput();
    const author_display_name = getDisplayNameFromUser(currentUser);

    const payload = {
      user_id: currentUser.id,
      title,
      content: cleanedHtml,
      tags: tagsString || null,
      author_display_name,
      cover_image_url: coverUrl,
    };

    await insertArticleRow(payload);

    setStatus("Article published!", "success");

    // Reset form
    if (articleTitleInput instanceof HTMLInputElement) articleTitleInput.value = "";
    if (articleTagsInput instanceof HTMLInputElement) articleTagsInput.value = "";
    if (featuredCheckbox instanceof HTMLInputElement) featuredCheckbox.checked = false;
    if (articleEditor instanceof HTMLElement) articleEditor.innerHTML = "";
    if (articleContentField instanceof HTMLTextAreaElement) articleContentField.value = "";
    resetCoverPreview();

    closeArticleComposer();
    await loadArticles();
  } catch (error) {
    console.error("Publish failed", error);
    setStatus(error?.message || "Unable to publish article.", "error");
  } finally {
    setSubmitEnabled(true);
  }
}

async function refreshAuth() {
  try {
    const { data, error } = await getSessionSafe({ retries: 2, retryDelayMs: 75 });
    if (error) throw error;
    currentUser = data?.session?.user ?? null;
  } catch (error) {
    if (!isAbortLikeError(error)) {
      console.error("Unable to read auth session", error);
    }
    currentUser = null;
  }
  toggleAuthUI(Boolean(currentUser));
}

function initSearchUI() {
  if (searchToggle instanceof HTMLButtonElement && searchPanel instanceof HTMLElement) {
    searchToggle.addEventListener("click", () => {
      const open = !searchPanel.hidden;
      searchPanel.hidden = open;
      searchToggle.setAttribute("aria-expanded", String(!open));
      if (!open) {
        searchInput?.focus();
      }
    });
  }

  if (searchInput instanceof HTMLInputElement) {
    searchInput.addEventListener("input", () => {
      activeQuery = searchInput.value || "";
      activeTag = activeQuery ? activeTag : "";
      applyFiltersAndRender();
    });
  }

  if (searchClear instanceof HTMLButtonElement) {
    searchClear.addEventListener("click", () => {
      if (searchInput instanceof HTMLInputElement) searchInput.value = "";
      activeQuery = "";
      activeTag = "";
      applyFiltersAndRender();
      searchInput?.focus();
    });
  }
}

function initEditorUI() {
  if (articleToolbar instanceof HTMLElement) {
    articleToolbar.addEventListener("click", onToolbarClick);
  }

  document.getElementById("article-link-btn")?.addEventListener("click", promptForLink);

  const inlineImageBtn = document.getElementById("article-inline-image-btn");
  const inlineImageInput = document.getElementById("article-inline-image");

  inlineImageBtn?.addEventListener("click", () => {
    inlineImageInput?.click();
  });

  inlineImageInput?.addEventListener("change", async () => {
    const files = Array.from(inlineImageInput.files || []);
    await insertInlineImages(files);
    inlineImageInput.value = "";
  });

  if (articleEditor instanceof HTMLElement) {
    articleEditor.addEventListener("input", syncHiddenContent);
    articleEditor.addEventListener("drop", onEditorDrop);
    articleEditor.addEventListener("paste", onEditorPaste);
  }
}

function initCoverUI() {
  if (!(coverInput instanceof HTMLInputElement)) return;

  coverInput.addEventListener("change", async () => {
    const file = coverInput.files?.[0];
    if (!file) {
      resetCoverPreview();
      return;
    }
    if (!file.type?.startsWith("image/")) {
      setStatus("Please choose an image file.", "error");
      resetCoverPreview();
      return;
    }

    try {
      const { dataUrl } = await compressImage(file, { maxWidth: 1200, maxHeight: 800, quality: 0.8 });
      updateCoverPreview(dataUrl);
    } catch (error) {
      console.error("Preview failed", error);
      resetCoverPreview();
    }
  });

  coverClearBtn?.addEventListener("click", () => {
    resetCoverPreview();
  });
}

function syncFeaturedCheckboxFromTags() {
  if (!(featuredCheckbox instanceof HTMLInputElement)) return;
  const has = normalizeTags(articleTagsInput?.value || "").some((t) => String(t || "").toLowerCase() === "featured");
  featuredCheckbox.checked = has;
}

function applyFeaturedTagFromCheckbox() {
  if (!(featuredCheckbox instanceof HTMLInputElement) || !(articleTagsInput instanceof HTMLInputElement)) return;

  let tags = normalizeTags(articleTagsInput.value || "");
  const has = tags.some((t) => String(t || "").toLowerCase() === "featured");

  if (featuredCheckbox.checked && !has) {
    tags = ["Featured", ...tags];
  }
  if (!featuredCheckbox.checked && has) {
    tags = tags.filter((t) => String(t || "").toLowerCase() !== "featured");
  }

  articleTagsInput.value = tags.join(", ");
}

function initFeaturedUI() {
  if (featuredCheckbox instanceof HTMLInputElement) {
    featuredCheckbox.addEventListener("change", applyFeaturedTagFromCheckbox);
  }
  if (articleTagsInput instanceof HTMLInputElement) {
    articleTagsInput.addEventListener("input", syncFeaturedCheckboxFromTags);
  }
}


function initComposerUI() {
  shareArticleBtn?.addEventListener("click", () => {
    if (shareArticleBtn.disabled) return;
    if (articleComposerCard?.hidden) openArticleComposer();
    else closeArticleComposer();
  });

  closeArticleComposerBtn?.addEventListener("click", closeArticleComposer);
}

async function init() {
  initComposerUI();
  initSearchUI();
  initEditorUI();
  initCoverUI();
  initFeaturedUI();

  if (articleForm) {
    articleForm.addEventListener("submit", handlePublish);
  }

  await refreshAuth();
  await loadArticles();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    toggleAuthUI(Boolean(currentUser));
  });
}

init();
