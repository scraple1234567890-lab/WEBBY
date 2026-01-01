import { supabase } from "./supabaseClient.js";

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
const profileForm = document.getElementById("profileForm");
const profileEditToggle = document.getElementById("profileEditToggle");
const profileNameInput = document.getElementById("profileName");
const profileBioInput = document.getElementById("profileBio");
const profileFormStatus = document.getElementById("profileFormStatus");
const profileSaveButton = document.getElementById("profileSave");
const profilePosts = document.getElementById("profilePosts");
const profilePostsCard = document.getElementById("profilePostsCard");
let isEditingProfile = false;
let profileDetailsVisible = false;

const LOGIN_STATE_KEY = "auth:isLoggedIn";
const AVATAR_KEY_PREFIX = "profile:avatar:";

let activeUserId = null;

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

function setProfileFormStatus(message, tone = "muted") {
  if (!profileFormStatus) return;
  profileFormStatus.textContent = message || "";
  profileFormStatus.className = `${tone} small`;
  profileFormStatus.hidden = !message || !isEditingProfile;
}

function setProfileFormEnabled(enabled) {
  if (!(profileSaveButton instanceof HTMLButtonElement)) return;
  profileSaveButton.disabled = !enabled;
  if (!profileSaveButton.dataset.defaultText) {
    profileSaveButton.dataset.defaultText = profileSaveButton.textContent || "Save profile";
  }
  profileSaveButton.textContent = enabled ? profileSaveButton.dataset.defaultText : "Saving...";
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

function fillProfileForm(metadata = {}) {
  if (profileNameInput instanceof HTMLInputElement) {
    profileNameInput.value = metadata.displayName || metadata.full_name || metadata.name || "";
  }
  if (profileBioInput instanceof HTMLTextAreaElement) {
    profileBioInput.value = metadata.bio || "";
  }
}

function toggleProfileExtras(show) {
  if (profilePostsCard instanceof HTMLElement) profilePostsCard.hidden = !show;
}

function setProfileDetailsVisible(show) {
  profileDetailsVisible = show;
  if (profileSummaryText instanceof HTMLElement) {
    profileSummaryText.hidden = !show;
    profileSummaryText.setAttribute("aria-hidden", String(!show));
  }
  setProfileFormVisible(show);
}

function setProfileFormVisible(show) {
  isEditingProfile = show;
  if (profileForm instanceof HTMLElement) {
    profileForm.hidden = !show;
    profileForm.setAttribute("aria-hidden", String(!show));
  }
  if (profileEditToggle instanceof HTMLElement) {
    profileEditToggle.setAttribute("aria-expanded", String(show));
    profileEditToggle.classList.toggle("isActive", show);
  }
  if (!show) {
    setProfileFormStatus("");
  } else {
    setProfileFormStatus(profileFormStatus?.textContent || "");
  }
}

function updateProfileSummary(metadata = {}) {
  const displayName = metadata.displayName || metadata.full_name || metadata.name || "";
  const bio = metadata.bio || "";

  if (profileNameDisplay) {
    profileNameDisplay.textContent = displayName || "Profile";
  }
  if (profileBioDisplay) {
    profileBioDisplay.textContent = bio || "Add a short description to personalize your profile.";
    profileBioDisplay.classList.toggle("muted", !bio);
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

    article.append(meta, body);
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
  if (guestNotice instanceof HTMLElement) guestNotice.hidden = false;
  showAvatarBlock(false);
  setAvatarPreview(null);
  setAvatarStatus("");
  toggleProfileExtras(false);
  setProfileDetailsVisible(false);
  if (profileEditToggle instanceof HTMLElement) profileEditToggle.hidden = true;
  if (profileSummary instanceof HTMLElement) profileSummary.hidden = true;
  if (profileSummaryText instanceof HTMLElement) profileSummaryText.hidden = true;
  if (profileNameDisplay) profileNameDisplay.textContent = "Profile";
  if (profileBioDisplay) profileBioDisplay.textContent = "Share a short description for your profile.";
  if (profilePosts) profilePosts.innerHTML = "";
  setProfileFormStatus("");
  setStatus(message);
}

function renderProfile(user) {
  setLoginStateFlag(true);
  activeUserId = user?.id || null;

  if (guestNotice instanceof HTMLElement) guestNotice.hidden = true;
  showAvatarBlock(true);
  toggleProfileExtras(true);
  if (profileSummary instanceof HTMLElement) {
    profileSummary.hidden = false;
    profileSummary.setAttribute("aria-hidden", "false");
  }

  syncAvatar(user?.id);
  const metadata = user?.user_metadata || {};
  fillProfileForm(metadata);
  updateProfileSummary(metadata);
  loadUserPosts(user?.id);
  setProfileFormStatus("");

  if (profileEditToggle instanceof HTMLElement) profileEditToggle.hidden = false;
  setProfileDetailsVisible(false);
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

function toggleProfileEditor() {
  const shouldShow = !profileDetailsVisible;
  setProfileDetailsVisible(shouldShow);
  if (shouldShow && profileNameInput instanceof HTMLInputElement) profileNameInput.focus();
}

async function handleProfileFormSubmit(event) {
  event.preventDefault();
  if (!activeUserId) {
    setProfileFormStatus("Log in to update your profile.", "error");
    return;
  }

  const displayName = (profileNameInput?.value || "").trim();
  const bio = (profileBioInput?.value || "").trim();

  if (!displayName && !bio) {
    setProfileFormStatus("Add a name or description before saving.", "error");
    return;
  }

  setProfileFormEnabled(false);
  setProfileFormStatus("Saving your profile...");

  const { error, data } = await supabase.auth.updateUser({
    data: { displayName, bio },
  });

  if (error) {
    setProfileFormStatus(error.message || "Unable to save your profile.", "error");
    setProfileFormEnabled(true);
    return;
  }

  const metadata = data?.user?.user_metadata || {};
  fillProfileForm(metadata);
  updateProfileSummary(metadata);
  setProfileFormStatus("Profile updated.", "success");
  setProfileFormEnabled(true);
}

async function loadProfile() {
  setStatus("Checking your session...");
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    const user = data?.session?.user ?? null;
    if (!user) {
      showGuestState();
      return;
    }
    renderProfile(user);
  } catch (error) {
    console.error("Unable to load profile", error);
    showGuestState("Unable to load your profile right now.");
  }
}

function init() {
  avatarInput?.addEventListener("change", handleAvatarChange);
  avatarReset?.addEventListener("click", handleAvatarReset);
  profileForm?.addEventListener("submit", handleProfileFormSubmit);
  profileEditToggle?.addEventListener("click", toggleProfileEditor);

  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    if (!user) {
      showGuestState("Signed out. Log in to view your profile.");
      return;
    }
    renderProfile(user);
  });

  loadProfile();
}

init();
