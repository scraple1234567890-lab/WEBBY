import { supabase } from "./supabaseClient.js";

const statusEl = document.getElementById("profileStatus");
const profileDetails = document.getElementById("profileDetails");
const profileActions = document.getElementById("profileActions");
const profileLogout = document.getElementById("profileLogout");
const guestNotice = document.getElementById("profileGuestNotice");
const guestActions = document.getElementById("profileGuestActions");
const emailTarget = document.querySelector("[data-profile-email]");
const joinedTarget = document.querySelector("[data-profile-joined]");
const idTarget = document.querySelector("[data-profile-id]");

const LOGIN_STATE_KEY = "auth:isLoggedIn";

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

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function showGuestState(message = "You’re not logged in yet.") {
  setLoginStateFlag(false);
  if (profileDetails instanceof HTMLElement) profileDetails.hidden = true;
  if (profileActions instanceof HTMLElement) profileActions.hidden = true;
  if (guestNotice instanceof HTMLElement) guestNotice.hidden = false;
  if (guestActions instanceof HTMLElement) guestActions.hidden = false;
  setStatus(message);
}

function renderProfile(user) {
  setLoginStateFlag(true);

  if (profileDetails instanceof HTMLElement) {
    profileDetails.hidden = false;
  }
  if (guestNotice instanceof HTMLElement) guestNotice.hidden = true;
  if (guestActions instanceof HTMLElement) guestActions.hidden = true;
  if (profileActions instanceof HTMLElement) profileActions.hidden = false;

  if (emailTarget) emailTarget.textContent = user?.email || "Unknown email";
  if (joinedTarget) joinedTarget.textContent = formatDate(user?.created_at);
  if (idTarget) idTarget.textContent = user?.id || "Unknown id";

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
