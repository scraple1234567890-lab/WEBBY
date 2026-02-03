import { supabase } from "./supabaseClient.js";
import { getSessionSafe, isAbortLikeError } from "./authSession.js";

const statusEl = document.getElementById("profileStatus");
const guestNotice = document.getElementById("profileGuestNotice");
const avatarBlock = document.getElementById("profileAvatarBlock");
const avatarPreview = document.getElementById("profileAvatarPreview");
const avatarPreviewImg = avatarPreview?.querySelector("img");
const avatarPlaceholder = avatarPreview?.querySelector(".profileAvatarPlaceholder");
const avatarInput = document.getElementById("profileAvatarInput");
const avatarReset = document.getElementById("profileAvatarReset");
const avatarStatus = document.getElementById("profileAvatarStatus");
const profileSummary = document.getElementById("profileSummary");
const profileSummaryText = document.getElementById("profileSummaryText");
const profileNameDisplay = document.getElementById("profileNameDisplay");
const profileBioDisplay = document.getElementById("profileBioDisplay");
const profileEditToggle = document.getElementById("profileEditToggle");
const profileEditForm = document.getElementById("profileEditForm");
const profileNameInput = document.getElementById("profileNameInput");
const profileBioInput = document.getElementById("profileBioInput");
const profileEditStatus = document.getElementById("profileEditStatus");
const profileEditCancel = document.getElementById("profileEditCancel");
const profilePosts = document.getElementById("profilePosts");
const profilePostsCard = document.getElementById("profilePostsCard");

// Quiz results
const profileQuizSection = document.getElementById("profileQuizSection");
const profileQuizGrid = document.getElementById("profileQuizGrid");
const profileQuizEmpty = document.getElementById("profileQuizEmpty");

const QUIZ_RESULTS_PREFIX = "ssa:quizResults:";
const QUIZ_TYPES_ORDER = ["sense", "element", "artifact", "animal"];
const QUIZ_TITLE_MAP = {
  sense: "Sense Magic Quiz",
  element: "Elemental Magic Quiz",
  artifact: "Artifact Quiz",
  animal: "Animal Companion Quiz",
};

// Badges (client-side achievements)
const profileBadgesSection = document.getElementById("profileBadgesSection");
const profileBadgesGrid = document.getElementById("profileBadgesGrid");
const profileBadgesCount = document.getElementById("profileBadgesCount");
const profileBadgesTotal = document.getElementById("profileBadgesTotal");
const profileBadgesEmpty = document.getElementById("profileBadgesEmpty");

const LOGIN_STATE_KEY = "auth:isLoggedIn";
const AVATAR_KEY_PREFIX = "profile:avatar:";

let activeUserId = null;
let profileMetadata = {};

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}


function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getQuizStorageKey(userId) {
  return userId ? `${QUIZ_RESULTS_PREFIX}${userId}` : `${QUIZ_RESULTS_PREFIX}guest`;
}

function readLocalQuizResults(userId) {
  const key = getQuizStorageKey(userId);
  try {
    return safeJsonParse(localStorage.getItem(key) || "{}", {});
  } catch {
    return {};
  }
}

function parseIsoTime(value) {
  const t = value ? Date.parse(value) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function pickNewestPayload(a, b) {
  if (!a) return b;
  if (!b) return a;
  const at = parseIsoTime(a.completedAt || a.completed_at || a.updatedAt);
  const bt = parseIsoTime(b.completedAt || b.completed_at || b.updatedAt);
  return bt > at ? b : a;
}

function mergeQuizResults(primary, secondary) {
  const out = {};
  const a = isObject(primary) ? primary : {};
  const b = isObject(secondary) ? secondary : {};
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  allKeys.forEach((k) => {
    out[k] = pickNewestPayload(a[k], b[k]);
  });
  return out;
}

function formatShortDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function normalizeQuizPayload(payload, quizType) {
  if (!isObject(payload)) return null;
  const scores = isObject(payload.scores) ? payload.scores : {};
  const order = Array.isArray(payload.order) ? payload.order : Object.keys(scores);
  const labels = isObject(payload.labels) ? payload.labels : {};
  const totalPoints = typeof payload.totalPoints === "number" ? payload.totalPoints : 0;

  return {
    quizType: payload.quizType || quizType || "",
    topKey: payload.topKey || "",
    topName: payload.topName || payload.resultName || "",
    status: payload.status || "",
    scores,
    order,
    labels,
    totalPoints,
    completedAt: payload.completedAt || payload.completed_at || payload.updatedAt || "",
  };
}

function setQuizSectionVisible(show) {
  if (!(profileQuizSection instanceof HTMLElement)) return;
  profileQuizSection.hidden = !show;
  profileQuizSection.setAttribute("aria-hidden", String(!show));
}

function renderQuizResults(user, resultsMap) {
  if (!(profileQuizSection instanceof HTMLElement)) return;
  if (!(profileQuizGrid instanceof HTMLElement)) return;

  const raw = isObject(resultsMap) ? resultsMap : {};
  const normalized = {};
  Object.keys(raw).forEach((k) => {
    const norm = normalizeQuizPayload(raw[k], k);
    if (norm) normalized[k] = norm;
  });

  const ordered = QUIZ_TYPES_ORDER.filter((t) => normalized[t]).concat(Object.keys(normalized).filter((t) => !QUIZ_TYPES_ORDER.includes(t)));
  profileQuizGrid.innerHTML = "";

  if (!ordered.length) {
    setQuizSectionVisible(true);
    if (profileQuizEmpty instanceof HTMLElement) profileQuizEmpty.hidden = false;
    return;
  }
  if (profileQuizEmpty instanceof HTMLElement) profileQuizEmpty.hidden = true;
  setQuizSectionVisible(true);

  ordered.forEach((type) => {
    const data = normalized[type];
    if (!data) return;

    const card = document.createElement("article");
    card.className = "profileQuizCard";

    const top = document.createElement("div");
    top.className = "profileQuizTop";

    const title = document.createElement("h3");
    title.className = "profileQuizTitle";
    title.textContent = QUIZ_TITLE_MAP[type] || type;

    const meta = document.createElement("p");
    meta.className = "muted small profileQuizMeta";
    meta.textContent = data.completedAt ? formatShortDate(data.completedAt) : "";

    top.append(title, meta);

    const resultLine = document.createElement("p");
    resultLine.className = "profileQuizResult";
    const main = data.topName || data.topKey || "Unknown result";
    resultLine.textContent = data.status ? `Result: ${main} (${data.status})` : `Result: ${main}`;

    const breakdown = document.createElement("div");
    breakdown.className = "profileQuizBreakdown";

    const total = data.totalPoints || data.order.reduce((acc, key) => acc + (Number(data.scores[key]) || 0), 0) || 0;

    data.order.forEach((key) => {
      const val = Number(data.scores[key]) || 0;
      const pct = total > 0 ? Math.round((val / total) * 100) : 0;

      const row = document.createElement("div");
      row.className = "profileQuizRow";

      const rowTop = document.createElement("div");
      rowTop.className = "profileQuizRowTop";

      const label = document.createElement("span");
      label.textContent = data.labels[key] || key;

      const score = document.createElement("span");
      score.className = "muted";
      score.textContent = `${pct}%`;

      rowTop.append(label, score);

      const bar = document.createElement("div");
      bar.className = "profileQuizBar";
      const fill = document.createElement("span");
      fill.style.setProperty("--pct", `${pct}%`);
      bar.appendChild(fill);

      row.append(rowTop, bar);
      breakdown.appendChild(row);
    });

    card.append(top, resultLine, breakdown);
    profileQuizGrid.appendChild(card);
  });
}

function setBadgesVisible(show) {
  if (!(profileBadgesSection instanceof HTMLElement)) return;
  profileBadgesSection.hidden = !show;
  profileBadgesSection.setAttribute("aria-hidden", String(!show));
}

function renderProfileBadges() {
  if (!(profileBadgesSection instanceof HTMLElement)) return;
  if (!(profileBadgesGrid instanceof HTMLElement)) return;

  const defs = window.SSA_BADGE_DEFS || [];
  const api = window.SSAchievements;

  if (!api || !Array.isArray(defs) || defs.length === 0) {
    setBadgesVisible(false);
  setQuizSectionVisible(false);
    return;
  }

  setBadgesVisible(true);

  // Pull unlock timestamps for nicer ordering.
  const stateRaw = (() => {
    try {
      return localStorage.getItem("ssa:badges:v1") || "";
    } catch {
      return "";
    }
  })();
  const state = safeJsonParse(stateRaw, { unlocked: {} });
  const unlockedMap = (state && typeof state === "object" && state.unlocked && typeof state.unlocked === "object") ? state.unlocked : {};

  const unlockedIds = new Set(api.getUnlockedIds());
  const unlockedDefs = defs.filter((d) => unlockedIds.has(d.id));

  if (profileBadgesCount instanceof HTMLElement) profileBadgesCount.textContent = String(unlockedDefs.length);
  if (profileBadgesTotal instanceof HTMLElement) profileBadgesTotal.textContent = String(defs.length);

  profileBadgesGrid.innerHTML = "";

  if (!unlockedDefs.length) {
    if (profileBadgesEmpty instanceof HTMLElement) profileBadgesEmpty.hidden = false;
    return;
  }
  if (profileBadgesEmpty instanceof HTMLElement) profileBadgesEmpty.hidden = true;

  unlockedDefs.sort((a, b) => {
    const ad = unlockedMap?.[a.id]?.unlockedAt ? new Date(unlockedMap[a.id].unlockedAt).getTime() : 0;
    const bd = unlockedMap?.[b.id]?.unlockedAt ? new Date(unlockedMap[b.id].unlockedAt).getTime() : 0;
    return bd - ad;
  });

  const max = 12;
  unlockedDefs.slice(0, max).forEach((def) => {
    const pill = document.createElement("a");
    pill.className = "profileBadgePill";
    pill.href = "./badges.html";
    pill.title = def.desc || def.title || "";

    const icon = document.createElement("div");
    icon.className = "profileBadgeIcon";
    icon.textContent = def.icon || "✨";

    const text = document.createElement("div");
    text.className = "profileBadgeText";

    const name = document.createElement("div");
    name.className = "profileBadgeName";
    name.textContent = def.title || def.id;

    const meta = document.createElement("div");
    meta.className = "profileBadgeMeta";
    meta.textContent = def.category ? String(def.category) : "badge";

    text.appendChild(name);
    text.appendChild(meta);

    pill.appendChild(icon);
    pill.appendChild(text);

    profileBadgesGrid.appendChild(pill);
  });

  if (unlockedDefs.length > max) {
    const more = document.createElement("a");
    more.className = "profileBadgePill";
    more.href = "./badges.html";

    const icon = document.createElement("div");
    icon.className = "profileBadgeIcon";
    icon.textContent = "➕";

    const text = document.createElement("div");
    text.className = "profileBadgeText";

    const name = document.createElement("div");
    name.className = "profileBadgeName";
    name.textContent = `+${unlockedDefs.length - max} more`;

    const meta = document.createElement("div");
    meta.className = "profileBadgeMeta";
    meta.textContent = "view all";

    text.appendChild(name);
    text.appendChild(meta);

    more.appendChild(icon);
    more.appendChild(text);
    profileBadgesGrid.appendChild(more);
  }
}

function setStatus(message, tone = "muted") {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.className = `${tone} small`;
  statusEl.hidden = !message;
}

function setAvatarStatus(message) {
  if (!(avatarStatus instanceof HTMLElement)) return;
  avatarStatus.textContent = message || "";
  avatarStatus.hidden = !message;
}

function setLoginStateFlag(isLoggedIn) {
  try {
    if (isLoggedIn) {
      localStorage.setItem(LOGIN_STATE_KEY, "true");
    } else {
      localStorage.removeItem(LOGIN_STATE_KEY);
    }
  } catch (error) {
    console.warn("Unable to persist auth visibility state", error);
  }
}

function getAvatarStorageKey(userId) {
  return userId ? `${AVATAR_KEY_PREFIX}${userId}` : "";
}

function loadAvatar(userId) {
  const key = getAvatarStorageKey(userId);
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("Unable to read avatar from storage", error);
    return null;
  }
}

function saveAvatar(userId, dataUrl) {
  const key = getAvatarStorageKey(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, dataUrl);
  } catch (error) {
    console.warn("Unable to save avatar to storage", error);
  }
}

function clearAvatar(userId) {
  const key = getAvatarStorageKey(userId);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("Unable to clear avatar", error);
  }
}

function setAvatarPreview(src) {
  if (!(avatarPreview instanceof HTMLElement) || !(avatarPreviewImg instanceof HTMLImageElement)) return;
  if (src) {
    avatarPreviewImg.src = src;
    avatarPreview.classList.add("hasImage");
  } else {
    avatarPreviewImg.removeAttribute("src");
    avatarPreview.classList.remove("hasImage");
  }
  if (avatarPlaceholder instanceof HTMLElement) {
    avatarPlaceholder.hidden = Boolean(src);
  }
}

function showAvatarBlock(show) {
  if (avatarBlock instanceof HTMLElement) {
    avatarBlock.hidden = !show;
  }
}

function syncAvatar(userId) {
  const src = loadAvatar(userId);
  setAvatarPreview(src);
  setAvatarStatus(src ? "" : "Choose a picture to personalize your account.");
}

function toggleProfileExtras(show) {
  if (profilePostsCard instanceof HTMLElement) profilePostsCard.hidden = !show;
}

// Modified: allow controlling whether the read-only summary text is shown
function setProfileSummaryVisible(show) {
  const isVisible = Boolean(show);

  if (profileSummary instanceof HTMLElement) {
    profileSummary.hidden = !isVisible;
    profileSummary.setAttribute("aria-hidden", String(!isVisible));
  }

  // Keep the name/bio visible whenever the summary is shown
  if (profileSummaryText instanceof HTMLElement) {
    profileSummaryText.hidden = !isVisible;
    profileSummaryText.setAttribute("aria-hidden", String(!isVisible));
  }

  if (!isVisible) setProfileEditVisible(false);

  if (profileEditToggle instanceof HTMLElement) {
    profileEditToggle.disabled = !isVisible;
    profileEditToggle.setAttribute("aria-hidden", String(!isVisible));
  }
}

function updateProfileSummary(metadata = {}) {
  profileMetadata = metadata || {};
  const displayName = profileMetadata.displayName || profileMetadata.full_name || profileMetadata.name || "";
  const bio = profileMetadata.bio || "";

  if (profileNameDisplay) {
    profileNameDisplay.textContent = displayName || "Profile";
  }
  if (profileBioDisplay) {
    profileBioDisplay.textContent = bio || "Add a short description to personalize your profile.";
    profileBioDisplay.classList.toggle("muted", !bio);
  }

  if (profileNameInput instanceof HTMLInputElement && !profileEditForm?.hidden) {
    profileNameInput.value = displayName || "";
  }
  if (profileBioInput instanceof HTMLTextAreaElement && !profileEditForm?.hidden) {
    profileBioInput.value = bio || "";
  }
}

function setProfileEditStatus(message, tone = "muted") {
  if (!(profileEditStatus instanceof HTMLElement)) return;
  profileEditStatus.textContent = message || "";
  profileEditStatus.className = `${tone} small`;
}

function setProfileEditVisible(show) {
  const isOpen = Boolean(show);

  if (profileEditForm instanceof HTMLElement) {
    profileEditForm.hidden = !isOpen;
    profileEditForm.setAttribute("aria-hidden", String(!isOpen));
  }

  if (profileEditToggle instanceof HTMLElement) {
    profileEditToggle.classList.toggle("isActive", isOpen);
    profileEditToggle.setAttribute("aria-expanded", String(isOpen));
  }

  if (isOpen) {
    const displayName = profileMetadata.displayName || profileMetadata.full_name || profileMetadata.name || "";
    const bio = profileMetadata.bio || "";
    if (profileNameInput instanceof HTMLInputElement) profileNameInput.value = displayName || "";
    if (profileBioInput instanceof HTMLTextAreaElement) profileBioInput.value = bio || "";
    setProfileEditStatus("You can update your profile text now.");
  } else {
    setProfileEditStatus("");
  }
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function renderUserPosts(posts) {
  if (!profilePosts) return;
  profilePosts.innerHTML = "";

  if (!posts.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No posts yet. Share something on the Lore Board to see it here.";
    profilePosts.appendChild(p);
    return;
  }

  posts.forEach((post) => {
    const article = document.createElement("article");
    article.className = "card";
    article.dataset.id = post.id;

    const meta = document.createElement("p");
    meta.className = "muted small postMetaRow";
    meta.textContent = formatDate(post.created_at);

    const body = document.createElement("p");
    body.className = "post-content";
    body.style.whiteSpace = "pre-wrap";
    body.textContent = post.content || "";

    article.append(body, meta);
    profilePosts.appendChild(article);
  });
}

async function loadUserPosts(userId) {
  if (!profilePosts) return;
  if (!userId) {
    profilePosts.innerHTML = "";
    return;
  }

  profilePosts.innerHTML = '<p class="muted">Loading your posts...</p>';

  try {
    const { data, error } = await supabase
      .from("posts")
      .select("id, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    renderUserPosts(data || []);
  } catch (error) {
    console.error("Unable to load user posts", error);
    profilePosts.innerHTML = "";
    const message = document.createElement("p");
    message.className = "error";
    message.textContent = error?.message || "Unable to load your posts right now.";
    profilePosts.appendChild(message);
  }
}

function showGuestState(message = "You’re not logged in yet.") {
  setLoginStateFlag(false);
  activeUserId = null;
  profileMetadata = {};
  setProfileEditVisible(false);
  if (guestNotice instanceof HTMLElement) guestNotice.hidden = false;
  showAvatarBlock(false);
  setAvatarPreview(null);
  setAvatarStatus("");
  toggleProfileExtras(false);
  setBadgesVisible(false);
  setQuizSectionVisible(false);
  if (profileBadgesGrid instanceof HTMLElement) profileBadgesGrid.innerHTML = "";
  // hide summary container and text for guests
  setProfileSummaryVisible(false);
  if (profileNameDisplay) profileNameDisplay.textContent = "Profile";
  if (profileBioDisplay) profileBioDisplay.textContent = "Share a short description for your profile.";
  if (profilePosts) profilePosts.innerHTML = "";
  setStatus(message);
}

function renderProfile(user) {
  setLoginStateFlag(true);
  activeUserId = user?.id || null;

  if (guestNotice instanceof HTMLElement) guestNotice.hidden = true;
  showAvatarBlock(true);
  toggleProfileExtras(true);
  // show the summary container and edit button (keep the read-only name/bio visible)
  setProfileSummaryVisible(true);
  setProfileEditVisible(false);

  syncAvatar(user?.id);
  const metadata = user?.user_metadata || {};
  updateProfileSummary(metadata);


  // Quiz results (stored to Supabase metadata + localStorage)
  const metaResults = (metadata && typeof metadata === "object") ? metadata.quiz_results : null;
  const localResults = readLocalQuizResults(user?.id || "");
  const mergedResults = mergeQuizResults(metaResults, localResults);
  renderQuizResults(user, mergedResults);

  // Show badges (stored per browser via localStorage)
  renderProfileBadges();
  loadUserPosts(user?.id);

  setStatus("");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function handleAvatarChange(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  if (!activeUserId) {
    setAvatarStatus("Log in to update your picture.");
    return;
  }

  const maxSizeBytes = 2 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    setAvatarStatus("Please choose an image under 2 MB.");
    if (avatarInput) avatarInput.value = "";
    return;
  }

  setAvatarStatus("Uploading your picture...");
  try {
    const dataUrl = await readFileAsDataUrl(file);
    if (typeof dataUrl === "string") {
      saveAvatar(activeUserId, dataUrl);
      setAvatarPreview(dataUrl);
      window.dispatchEvent(
        new CustomEvent("profile:avatarUpdated", { detail: { userId: activeUserId, src: dataUrl } }),
      );
      setAvatarStatus("Saved. Your picture now appears in the menu.");
    }
  } catch (error) {
    console.error("Unable to read avatar file", error);
    setAvatarStatus("Unable to read that file. Try another image.");
  } finally {
    if (avatarInput) avatarInput.value = "";
  }
}

function handleAvatarReset() {
  if (!activeUserId) return;
  clearAvatar(activeUserId);
  setAvatarPreview(null);
  window.dispatchEvent(new CustomEvent("profile:avatarUpdated", { detail: { userId: activeUserId, src: null } }));
  setAvatarStatus("Picture removed. You can add one anytime.");
}

async function handleProfileEditSubmit(event) {
  event.preventDefault();
  if (!activeUserId) {
    setProfileEditStatus("Log in to update your profile.", "error");
    return;
  }

  const displayName = profileNameInput instanceof HTMLInputElement ? profileNameInput.value.trim() : "";
  const bio = profileBioInput instanceof HTMLTextAreaElement ? profileBioInput.value.trim() : "";

  setProfileEditStatus("Saving your changes...");
  try {
    const { error } = await supabase.auth.updateUser({ data: { displayName, bio } });
    if (error) throw error;

    profileMetadata = { ...profileMetadata, displayName, bio };
    updateProfileSummary(profileMetadata);
    setProfileEditStatus("Profile updated.");
    setProfileEditVisible(false);
  } catch (error) {
    console.error("Unable to update profile text", error);
    setProfileEditStatus(error?.message || "Unable to save changes.", "error");
  }
}

function handleProfileEditToggle() {
  if (!activeUserId) {
    setProfileEditStatus("Log in to update your profile.", "error");
    return;
  }
  const isOpen = !(profileEditForm instanceof HTMLElement) ? false : profileEditForm.hidden;
  setProfileEditVisible(isOpen);
}

function handleProfileEditCancel() {
  setProfileEditVisible(false);
}

async function loadProfile() {
  setStatus("Checking your session...");
  try {
    const { data, error } = await getSessionSafe({ retries: 2, retryDelayMs: 75 });
    if (error) throw error;
    const user = data?.session?.user ?? null;
    if (!user) {
      showGuestState();
      return;
    }
    renderProfile(user);
  } catch (error) {
    if (isAbortLikeError(error)) {
      // A cancelled fetch (navigation/race) shouldn't turn into a scary error state.
      showGuestState();
      return;
    }
    console.error("Unable to load profile", error);
    showGuestState("Unable to load your profile right now.");
  }
}

function init() {
  avatarInput?.addEventListener("change", handleAvatarChange);
  avatarReset?.addEventListener("click", handleAvatarReset);

  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    if (!user) {
      showGuestState("Signed out. Log in to view your profile.");
      return;
    }
    renderProfile(user);
  });

  profileEditForm?.addEventListener("submit", handleProfileEditSubmit);
  profileEditToggle?.addEventListener("click", handleProfileEditToggle);
  profileEditCancel?.addEventListener("click", handleProfileEditCancel);

  // Refresh badges when you come back to this tab (e.g., after unlocking one elsewhere)
  window.addEventListener("focus", () => {
    if (!activeUserId) return;
    try {
      renderProfileBadges();
    } catch {
      // ignore
    }
  });

  loadProfile();
}

init();
