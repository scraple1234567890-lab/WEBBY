import { supabase } from "./supabaseClient.js";

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authStatus = document.getElementById("authStatus");
const feed = document.getElementById("supabaseFeed");

let currentSession = null;

function escapeHtml(input) {
  const div = document.createElement("div");
  div.textContent = input ?? "";
  return div.innerHTML;
}

function setStatus(element, message, tone = "muted") {
  if (!element) return;
  element.textContent = message || "";
  element.className = `${tone} small`;
}

async function fetchPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("id, created_at, user_id, content")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

function renderPosts(posts) {
  if (!feed) return;

  feed.innerHTML = "";

  if (!posts.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No posts yet. Be the first to share a note.";
    feed.appendChild(empty);
    return;
  }

  posts.forEach((post) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <p class="muted small">${new Date(post.created_at).toLocaleString()}</p>
      <p>${escapeHtml(post.content)}</p>
    `;
    feed.appendChild(card);
  });
}

async function refreshPosts() {
  if (!feed) return;
  feed.innerHTML = "";
  const loading = document.createElement("p");
  loading.className = "muted";
  loading.textContent = "Loading posts...";
  feed.appendChild(loading);
  try {
    const posts = await fetchPosts();
    renderPosts(posts);
  } catch (error) {
    feed.innerHTML = "";
    const p = document.createElement("p");
    p.className = "error";
    p.textContent = error?.message || "Unable to load posts.";
    feed.appendChild(p);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  if (!loginForm) return;
  const formData = new FormData(loginForm);
  const email = formData.get("email");
  const password = formData.get("password");

  setStatus(authStatus, "Signing in...");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setStatus(authStatus, error.message, "error");
    return;
  }

  setStatus(authStatus, "Signed in.");
  loginForm.reset();
}

async function handleSignup(event) {
  event.preventDefault();
  if (!signupForm) return;
  const formData = new FormData(signupForm);
  const email = formData.get("email");
  const password = formData.get("password");

  setStatus(authStatus, "Creating account...");

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    setStatus(authStatus, error.message, "error");
    return;
  }

  setStatus(authStatus, "Account created. Check your email to confirm.");
  signupForm.reset();
}

async function loadSession() {
  const { data } = await supabase.auth.getSession();
  currentSession = data.session;
  if (currentSession) {
    setStatus(authStatus, `Logged in as ${currentSession.user.email}`);
  } else {
    setStatus(authStatus, "You are browsing as a guest.");
  }
  refreshPosts();
}

function initAuthListeners() {
  supabase.auth.onAuthStateChange((event, session) => {
    currentSession = session;
    if (event === "SIGNED_OUT") {
      setStatus(authStatus, "Signed out.");
    }
    if (event === "SIGNED_IN") {
      setStatus(authStatus, `Logged in as ${session?.user?.email || "member"}.`);
    }
    refreshPosts();
  });
}

function bindEvents() {
  loginForm?.addEventListener("submit", handleLogin);
  signupForm?.addEventListener("submit", handleSignup);
}

function init() {
  bindEvents();
  initAuthListeners();
  loadSession();
}

init();
