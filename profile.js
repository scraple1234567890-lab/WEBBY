import { supabase } from "./supabaseClient.js";

/** Toggle to true when debugging UI state issues */
const DEBUG = false;
const log = (...args) => DEBUG && console.log(...args);

const el = (id) => document.getElementById(id);

/** Elements */
const statusEl = el("profileStatus");
const guestNotice = el("profileGuestNotice");

const avatarBlock = el("profileAvatarBlock");
const avatarPreview = el("profileAvatarPreview");
const avatarInput = el("profileAvatarInput");
const avatarReset = el("profileAvatarReset");
const avatarStatus = el("profileAvatarStatus");

const profileSummary = el("profileSummary");
const profileSummaryText = el("profileSummaryText");
const profileNameDisplay = el("profileNameDisplay");
const profileBioDisplay = el("profileBioDisplay");

const profileEditToggle = el("profileEditToggle");
const profileEditForm = el("profileEditForm");
const profileNameInput = el("profileNameInput");
const profileBioInput = el("profileBioInput");
const profileEditStatus = el("profileEditStatus");
const profileEditCancel = el("profileEditCancel");

const profilePosts = el("profilePosts");
const profilePostsCard = el("profilePostsCard");

/** Storage keys */
const LOGIN_STATE_KEY = "auth:isLoggedIn";
const AVATAR_KEY_PREFIX = "profile:avatar:";

/** State */
let activeUserId = null;
let profileMetadata = {};

/** ---------- tiny UI helpers ---------- */

function setText(node, text) {
  if (!(node instanceof HTMLElement)) return;
  node.textContent = text ?? "";
}

function setVisible(node, isVisible) {
  if (!(node instanceof HTMLElement)) return;
  const show = Boolean(isVisible);

  // Use BOTH hidden + display so you never get stuck due to leftover inline styles.
  node.hidden = !show;
  node.style.display = show ? "" : "none";

  if (show) node.removeAttribute("hidden");
  else node.setAttribute("hidden", "");

  node.setAttribute("aria-hidden", String(!show));
}

function setStatus(message, tone = "muted") {
  if (!(statusEl instanceof HTMLElement)) return;
  setText(statusEl, message || "");
  statusEl.className = `${tone} small`;
  statusEl.hidden = !message;
}

function setAvatarStatus(message) {
  if (!(avatarStatus instanceof HTMLElement)) return;
  setText(avatarStatus, message || "");
  avatarStatus.hidden = !message;
}

function setLoginStateFlag(isLoggedIn) {
  try {
    if (isLoggedIn) localStorage.setItem(LOGIN_STATE_KEY, "true");
    else localStorage.removeItem(LOGIN_STATE_KEY);
  } catch (error) {
    console.warn("Unable to persist auth visibility state", error);
  }
}

/** ---------- avatar storage ---------- */

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
  if (!(avatarPreview instanceof HTMLElement)) return;

  const img = avatarPreview.querySelector("img");
  const placeholder = avatarPreview.querySelector(".profileAvatarPlaceholder");

  if (img instanceof HTMLImageElement) {
    if (src) img.src = src;
    else img.removeAttribute("src");
  }

  avatarPreview.classList.toggle("hasImage", Boolean(src));

  if (placeholder instanceof HTMLElement) {
    placeholder.hidden = Boolean(src);
  }
}

function showAvatarBlock(show) {
  setVisible(avatarBlock, show);
}

function syncAvatar(userId) {
  const src = loadAvatar(userId);
  setAvatarPreview(src);
  setAvatarStatus(src ? "" : "Choose a picture to personalize your account.");
}

/** ---------- profile summary + edit ---------- */

function toggleProfileExtras(show) {
  setVisible(profilePostsCard, show);
}

function updateProfileSummary(metadata = {}) {
  profileMetadata = metadata || {};
  const displayName =
    profileMetadata.displayName ||
    profileMetadata.full_name ||
    profileMetadata.name ||
    "";

  const bio = profileMetadata.bio || "";

  if (profileNameDisplay instanceof HTMLElement) {
    setText(profileNameDisplay, displayName || "Profile");
  }

  if (profileBioDisplay instanceof HTMLElement) {
    setText(
      profileBioDisplay,
      bio || "Add a short description to personalize your profile."
    );
    profileBioDisplay.classList.toggle("muted", !bio);
  }
}

function setProfileEditStatus(message, tone = "muted") {
  if (!(profileEditStatus instanceof HTMLElement)) return;
  setText(profileEditStatus, message || "");
  profileEditStatus.className = `${tone} small`;
  profileEditStatus.hidden = !message;
}

function setProfileSummaryVisible(show) {
  const visible = Boolean(show);

  setVisible(profileSummary, visible);
  // IMPORTANT: summary text visibility also depends on edit mode,
  // so we only force it visible when the summary itself is visible.
  if (!visible) setProfileEditVisible(false);

  if (profileEditToggle instanceof HTMLElement) {
    profileEditToggle.disabled = !visible;
  }
}

function setProfileEditVisible(show) {
  const isOpen = Boolean(show);
  log("setProfileEditVisible:", isOpen);

  // Summary text and edit form are mutually exclusive
  setVisible(profileSummaryText, !isOpen);
  setVisible(profileEditForm, isOpen);

  // Extra safety: if the summary text is still present in layout due to CSS,
  // ensure it cannot block clicking/typing in the form.
  if (profileSummaryText instanceof HTMLElement) {
    profileSummaryText.style.pointerEvents = isOpen ? "none" : "";
  }

  if (profileEditToggle instanceof HTMLElement) {
    profileEditToggle.classList.toggle("isActive", isOpen);
    profileEditToggle.setAttribute("aria-expanded", String(isOpen));
    profileEditToggle.textContent = isOpen ? "Cancel" : "Edit";
  }

  setProfileEditStatus("");

  if (isOpen) {
    // Pull values from what's currently shown on the page (most reliable),
    // falling back to metadata if needed.
    const currentNameFromUI =
      (profileNameDisplay instanceof HTMLElement ? profileNameDisplay.textContent : "")?.trim() || "";

    const bioIsPlaceholder =
      profileBioDisplay instanceof HTMLElement && profileBioDisplay.classList.contains("muted");

    const currentBioFromUI = bioIsPlaceholder
      ? ""
      : ((profileBioDisplay instanceof HTMLElement ? profileBioDisplay.textContent : "")?.trim() || "");

    const fallbackName =
      profileMetadata.displayName || profileMetadata.full_name || profileMetadata.name || "";

    const fallbackBio = profileMetadata.bio || "";

    const displayName = currentNameFromUI || fallbackName || "";
    const bio = currentBioFromUI || fallbackBio || "";

    if (profileNameInput instanceof HTMLInputElement) {
      profileNameInput.value = displayName;
      // Focus after paint so it's definitely clickable/typable
      setTimeout(() => profileNameInput.focus(), 50);
    }

    if (profileBioInput instanceof HTMLTextAreaElement) {
      profileBioInput.value = bio;
    }
  }
}

}

/** ---------- posts ---------- */

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function renderUserPosts(posts) {
  if (!(profilePosts instanceof HTMLElement)) return;
  profilePosts.innerHTML = "";

  if (!posts?.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent =
      "No posts yet. Share something on the Lore Board to see it here.";
    profilePosts.appendChild(p);
    return;
  }

  posts.forEach((post) => {
    const article = document.createElement("article");
    article.className = "card";
    article.dataset.id = post.id;

    const body = document.createElement("p");
    body.className = "post-content";
    body.style.whiteSpace = "pre-wrap";
    body.textContent = post.content || "";

    const meta = document.createElement("p");
    meta.className = "muted small postMetaRow";
    meta.textContent = formatDate(post.created_at);

    article.append(body, meta);
    profilePosts.appendChild(article);
  });
}

async function loadUserPosts(userId) {
  if (!(profilePosts instanceof HTMLElement)) return;

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

    if (error) throw error;
    renderUserPosts(data || []);
  } catch (error) {
    console.error("Unable to load user posts", error);
    profilePosts.innerHTML = "";
    const message = document.createElement("p");
    message.className = "error";
    message.textContent =
      error?.message || "Unable to load your posts right now.";
    profilePosts.appendChild(message);
  }
}

/** ---------- auth-driven rendering ---------- */

function showGuestState(message = "You're not logged in yet.") {
  setLoginStateFlag(false);
  activeUserId = null;
  profileMetadata = {};

  setVisible(guestNotice, true);
  showAvatarBlock(false);
  setAvatarPreview(null);
  setAvatarStatus("");

  toggleProfileExtras(false);
  setProfileSummaryVisible(false);
  setProfileEditVisible(false);

  if (profileNameDisplay instanceof HTMLElement) setText(profileNameDisplay, "Profile");
  if (profileBioDisplay instanceof HTMLElement)
    setText(profileBioDisplay, "Share a short description for your profile.");

  if (profilePosts instanceof HTMLElement) profilePosts.innerHTML = "";

  setStatus(message);
}

function renderProfile(user) {
  setLoginStateFlag(true);
  activeUserId = user?.id || null;

  setVisible(guestNotice, false);

  showAvatarBlock(true);
  toggleProfileExtras(true);
  setProfileSummaryVisible(true);
  setProfileEditVisible(false);

  syncAvatar(activeUserId);

  const metadata = user?.user_metadata || {};
  updateProfileSummary(metadata);

  loadUserPosts(activeUserId);

  setStatus("");
}

/** ---------- event handlers ---------- */

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
        new CustomEvent("profile:avatarUpdated", {
          detail: { userId: activeUserId, src: dataUrl },
        })
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

  window.dispatchEvent(
    new CustomEvent("profile:avatarUpdated", {
      detail: { userId: activeUserId, src: null },
    })
  );

  setAvatarStatus("Picture removed. You can add one anytime.");
}

async function handleProfileEditSubmit(event) {
  event.preventDefault();

  if (!activeUserId) {
    setProfileEditStatus("Log in to update your profile.", "error");
    return;
  }

  const displayName =
    profileNameInput instanceof HTMLInputElement
      ? profileNameInput.value.trim()
      : "";

  const bio =
    profileBioInput instanceof HTMLTextAreaElement
      ? profileBioInput.value.trim()
      : "";

  if (!displayName) {
    setProfileEditStatus("Please enter a display name.", "error");
    return;
  }

  setProfileEditStatus("Saving your changes...");
  try {
    const { error } = await supabase.auth.updateUser({
      data: { displayName, bio },
    });
    if (error) throw error;

    profileMetadata = { ...profileMetadata, displayName, bio };
    updateProfileSummary(profileMetadata);

    setProfileEditStatus("Profile updated successfully!", "success");

    setTimeout(() => setProfileEditVisible(false), 900);
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
  const isOpen = profileEditForm instanceof HTMLElement ? !profileEditForm.hidden : false;
  setProfileEditVisible(!isOpen);
}

function handleProfileEditCancel() {
  setProfileEditVisible(false);
}

/** ---------- boot ---------- */

async function loadProfile() {
  setStatus("Checking your session...");
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    const user = data?.session?.user ?? null;
    if (!user) return showGuestState();

    renderProfile(user);
  } catch (error) {
    console.error("Unable to load profile", error);
    showGuestState("Unable to load your profile right now.");
  }
}

function init() {
  avatarInput?.addEventListener("change", handleAvatarChange);
  avatarReset?.addEventListener("click", handleAvatarReset);

  profileEditForm?.addEventListener("submit", handleProfileEditSubmit);
  profileEditToggle?.addEventListener("click", handleProfileEditToggle);
  profileEditCancel?.addEventListener("click", handleProfileEditCancel);

  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    if (!user) return showGuestState("Signed out. Log in to view your profile.");
    renderProfile(user);
  });

  loadProfile();
}

init();
