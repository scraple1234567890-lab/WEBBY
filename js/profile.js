import { supabase } from "./supabaseClient.js";

const statusEl = document.getElementById("profileStatus");
const profileDetails = document.getElementById("profileDetails");
const profileActions = document.getElementById("profileActions");
const profileLogout = document.getElementById("profileLogout");
const guestNotice = document.getElementById("profileGuestNotice");
const guestActions = document.getElementById("profileGuestActions");
const avatarBlock = document.getElementById("profileAvatarBlock");
const avatarPreview = document.getElementById("profileAvatarPreview");
const avatarPreviewImg = avatarPreview?.querySelector("img");
const avatarPlaceholder = avatarPreview?.querySelector(".profileAvatarPlaceholder");
const avatarInput = document.getElementById("profileAvatarInput");
const avatarReset = document.getElementById("profileAvatarReset");
const avatarStatus = document.getElementById("profileAvatarStatus");
const emailTarget = document.querySelector("[data-profile-email]");
const joinedTarget = document.querySelector("[data-profile-joined]");
const idTarget = document.querySelector("[data-profile-id]");

const LOGIN_STATE_KEY = "auth:isLoggedIn";
const AVATAR_KEY_PREFIX = "profile:avatar:";

let activeUserId = null;

function setStatus(message, tone = "muted") {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.className = `${tone} small`;
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
  if (avatarStatus) {
    avatarStatus.textContent = src ? "This picture appears in your navigation menu." : "Choose a picture to personalize your account.";
  }
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function showGuestState(message = "You’re not logged in yet.") {
  setLoginStateFlag(false);
  activeUserId = null;
  if (profileDetails instanceof HTMLElement) profileDetails.hidden = true;
  if (profileActions instanceof HTMLElement) profileActions.hidden = true;
  if (guestNotice instanceof HTMLElement) guestNotice.hidden = false;
  if (guestActions instanceof HTMLElement) guestActions.hidden = false;
  showAvatarBlock(false);
  setAvatarPreview(null);
  setStatus(message);
}

function renderProfile(user) {
  setLoginStateFlag(true);
  activeUserId = user?.id || null;

  if (profileDetails instanceof HTMLElement) {
    profileDetails.hidden = false;
  }
  if (guestNotice instanceof HTMLElement) guestNotice.hidden = true;
  if (guestActions instanceof HTMLElement) guestActions.hidden = true;
  if (profileActions instanceof HTMLElement) profileActions.hidden = false;
  showAvatarBlock(true);

  if (emailTarget) emailTarget.textContent = user?.email || "Unknown email";
  if (joinedTarget) joinedTarget.textContent = formatDate(user?.created_at);
  if (idTarget) idTarget.textContent = user?.id || "Unknown id";
  syncAvatar(user?.id);

  setStatus(`Logged in as ${user?.email || "member"}.`, "success");
}

async function handleLogoutClick() {
  if (!(profileLogout instanceof HTMLButtonElement)) return;
  profileLogout.disabled = true;
  setStatus("Signing you out...");

  const { error } = await supabase.auth.signOut();
  if (error) {
    setStatus(error.message || "Unable to sign out right now.", "error");
    profileLogout.disabled = false;
    return;
  }

  showGuestState("Signed out. You can log in again anytime.");
  profileLogout.disabled = false;
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
    if (avatarStatus) avatarStatus.textContent = "Log in to update your picture.";
    return;
  }

  const maxSizeBytes = 2 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    if (avatarStatus) avatarStatus.textContent = "Please choose an image under 2 MB.";
    if (avatarInput) avatarInput.value = "";
    return;
  }

  if (avatarStatus) avatarStatus.textContent = "Uploading your picture...";
  try {
    const dataUrl = await readFileAsDataUrl(file);
    if (typeof dataUrl === "string") {
      saveAvatar(activeUserId, dataUrl);
      setAvatarPreview(dataUrl);
      window.dispatchEvent(
        new CustomEvent("profile:avatarUpdated", { detail: { userId: activeUserId, src: dataUrl } }),
      );
      if (avatarStatus) avatarStatus.textContent = "Saved. Your picture now appears in the menu.";
    }
  } catch (error) {
    console.error("Unable to read avatar file", error);
    if (avatarStatus) avatarStatus.textContent = "Unable to read that file. Try another image.";
  } finally {
    if (avatarInput) avatarInput.value = "";
  }
}

function handleAvatarReset() {
  if (!activeUserId) return;
  clearAvatar(activeUserId);
  setAvatarPreview(null);
  window.dispatchEvent(new CustomEvent("profile:avatarUpdated", { detail: { userId: activeUserId, src: null } }));
  if (avatarStatus) avatarStatus.textContent = "Picture removed. You can add one anytime.";
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
  profileLogout?.addEventListener("click", handleLogoutClick);
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

  loadProfile();
}

init();
