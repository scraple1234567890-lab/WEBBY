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
const profileEditToggle = document.getElementById("profileEditToggle");
const profileEditForm = document.getElementById("profileEditForm");
const profileNameInput = document.getElementById("profileNameInput");
const profileBioInput = document.getElementById("profileBioInput");
const profileEditStatus = document.getElementById("profileEditStatus");
const profileEditCancel = document.getElementById("profileEditCancel");
const profilePosts = document.getElementById("profilePosts");
const profilePostsCard = document.getElementById("profilePostsCard");

const LOGIN_STATE_KEY = "auth:isLoggedIn";
const AVATAR_KEY_PREFIX = "profile:avatar:";

let activeUserId = null;
let profileMetadata = {};

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
function setProfileSummaryVisible(show, showText = true) {
  if (profileSummary instanceof HTMLElement) {
    profileSummary.hidden = !show;
    profileSummary.setAttribute("aria-hidden", String(!show));
  }
  if (profileSummaryText instanceof HTMLElement) {
    const textVisible = Boolean(show && showText);
    profileSummaryText.hidden = !textVisible;
    profileSummaryText.setAttribute("aria-hidden", String(!textVisible));
  }
  if (!show) {
    setProfileEditVisible(false);
  }
  if (profileEditToggle instanceof HTMLElement) {
    profileEditToggle.disabled = !show;
    profileEditToggle.setAttribute("aria-hidden", String(!show));
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

  // When edit form opens, reveal the summary text (display name & bio). Hide it again when closing.
  if (profileSummaryText instanceof HTMLElement) {
    profileSummaryText.hidden = !isOpen;
    profileSummaryText.setAttribute("aria-hidden", String(!isOpen));
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
  // show the summary container and edit button, but keep the read-only name/bio hidden until the user clicks Edit
  setProfileSummaryVisible(true, false);
  setProfileEditVisible(false);

  syncAvatar(user?.id);
  const metadata = user?.user_metadata || {};
  updateProfileSummary(metadata);
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

  loadProfile();
}

init();

// ===== Profile Edit Toggle (View mode vs Edit mode) =====
(() => {
  const editBtn = document.getElementById("profileEditToggle");
  const form = document.getElementById("profileEditForm");
  const summaryText = document.getElementById("profileSummaryText");
  const cancelBtn = document.getElementById("profileEditCancel");

  const nameDisplay = document.getElementById("profileNameDisplay");
  const bioDisplay = document.getElementById("profileBioDisplay");
  const nameInput = document.getElementById("profileNameInput");
  const bioInput = document.getElementById("profileBioInput");

  if (!editBtn || !form || !summaryText) return;

  function readDisplayValues() {
    const name = (nameDisplay?.textContent || "").trim();
    const bio = (bioDisplay?.textContent || "").trim();

    // If your JS uses placeholders, treat them as "empty" when copying into inputs
    const cleanName = name === "Profile" ? "" : name;
    const cleanBio = bio === "Share a short description for your profile." ? "" : bio;

    return { name: cleanName, bio: cleanBio };
  }

  function writeInputsFromDisplay() {
    const { name, bio } = readDisplayValues();
    if (nameInput) nameInput.value = name;
    if (bioInput) bioInput.value = bio;
  }

  function setEditMode(isEditing) {
    // Toggle visibility
    summaryText.hidden = isEditing;
    form.hidden = !isEditing;

    // ARIA
    form.setAttribute("aria-hidden", String(!isEditing));
    editBtn.setAttribute("aria-expanded", String(isEditing));

    // Button label
    editBtn.textContent = isEditing ? "Close" : "Edit";

    // When entering edit mode, preload inputs with current display values
    if (isEditing) writeInputsFromDisplay();
  }

  // Default: VIEW MODE (inputs hidden)
  setEditMode(false);

  // Edit button toggles edit mode
  editBtn.addEventListener("click", () => {
    setEditMode(form.hidden); // if form is hidden -> enter edit mode
  });

  // Cancel returns to view mode and restores inputs from display text
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      writeInputsFromDisplay();
      setEditMode(false);
    });
  }

  // Optional helper: if your existing save logic wants to close the form on success,
  // call: window.profileSetEditMode(false)
  window.profileSetEditMode = (isEditing) => setEditMode(!!isEditing);
})();

// ===== Profile Editor: keep saved text always visible; Edit only opens/closes the form =====
(() => {
  const editBtn = document.getElementById("profileEditToggle");
  const form = document.getElementById("profileEditForm");
  const cancelBtn = document.getElementById("profileEditCancel");

  const nameDisplay = document.getElementById("profileNameDisplay");
  const bioDisplay = document.getElementById("profileBioDisplay");
  const nameInput = document.getElementById("profileNameInput");
  const bioInput = document.getElementById("profileBioInput");

  if (!editBtn || !form) return;

  let isEditing = false;
  let applying = false;

  function readDisplayValues() {
    const name = (nameDisplay?.textContent || "").trim();
    const bio = (bioDisplay?.textContent || "").trim();

    // Treat placeholder text as empty when copying into inputs
    const cleanName = name === "Profile" ? "" : name;
    const cleanBio = bio === "Share a short description for your profile." ? "" : bio;

    return { name: cleanName, bio: cleanBio };
  }

  function writeInputsFromDisplay() {
    const { name, bio } = readDisplayValues();
    if (nameInput) nameInput.value = name;
    if (bioInput) bioInput.value = bio;
  }

  function applyMode() {
    if (applying) return;
    applying = true;

    // Only show/hide the FORM. Saved text stays on screen.
    form.hidden = !isEditing;
    form.setAttribute("aria-hidden", String(!isEditing));
    form.style.display = isEditing ? "" : "none";

    editBtn.setAttribute("aria-expanded", String(isEditing));
    editBtn.textContent = isEditing ? "Close" : "Edit";

    if (isEditing) writeInputsFromDisplay();

    applying = false;
  }

  function setEditMode(next) {
    isEditing = !!next;
    applyMode();
  }

  // Default: form closed
  setEditMode(false);

  // Edit button toggles editor open/close
  editBtn.addEventListener("click", () => {
    setEditMode(!isEditing);
  });

  // Cancel closes editor and restores inputs back to saved display values
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      writeInputsFromDisplay();
      setEditMode(false);
    });
  }

  // If other code tries to force the form open, keep it closed unless editing
  const observer = new MutationObserver(() => {
    if (!isEditing) applyMode();
  });
  observer.observe(form, { attributes: true, attributeFilter: ["hidden", "style"] });

  // Optional: call this after a successful save to close the editor
  window.profileSetEditMode = (val) => setEditMode(val);
})();

