import { supabase } from "./supabaseClient.js";

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const logoutButton = document.getElementById("logoutBtn");
const authStatus = document.getElementById("authStatus");
const feed = document.getElementById("supabaseFeed");
const postForm = document.getElementById("postForm");
const postBodyInput = document.getElementById("postBody");
const postStatus = document.getElementById("postStatus");
const postError = document.getElementById("postError");
const postGuestNotice = document.getElementById("postGuestNotice");
const postComposerCard = document.getElementById("postComposerCard");
const loginButtons = Array.from(document.querySelectorAll('[data-auth-target="login-cta"]'));
const authSuccessMessage = document.getElementById("authSuccessMessage");
const loginCard = loginForm?.closest(".card");
const signupCard = signupForm?.closest(".card");
const LOGIN_STATE_KEY = "auth:isLoggedIn";

let currentSession = null;
let postsChannel = null;

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

function toggleComposer(enabled) {
  if (postForm) {
    postForm.style.display = enabled ? "grid" : "none";
  }
  if (postGuestNotice) {
    postGuestNotice.style.display = enabled ? "none" : "block";
  }
  if (postComposerCard) {
    postComposerCard.classList.toggle("isDisabled", !enabled);
  }
}

function toggleLogout(show) {
  if (!logoutButton) return;
  logoutButton.style.display = show ? "inline-flex" : "none";
}

function toggleLoginButtons(show) {
  loginButtons.forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    if (!button.dataset.defaultDisplay) {
      button.dataset.defaultDisplay = button.style.display || "";
    }
    button.style.display = show ? button.dataset.defaultDisplay : "none";
  });
}

function toggleAuthCards(show) {
  if (loginCard instanceof HTMLElement) {
    loginCard.style.display = show ? "" : "none";
  }
  if (signupCard instanceof HTMLElement) {
    signupCard.style.display = show ? "" : "none";
  }
}

function toggleAuthSuccess(isLoggedIn, email) {
  if (!(authSuccessMessage instanceof HTMLElement)) return;
  authSuccessMessage.style.display = isLoggedIn ? "block" : "none";
  const emailTarget = authSuccessMessage.querySelector("[data-auth-email]");
  if (emailTarget) {
    emailTarget.textContent = email || "your account";
  }
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

function updateAuthVisibility(isLoggedIn, email = "") {
  toggleComposer(isLoggedIn);
  toggleLogout(isLoggedIn);
  toggleLoginButtons(!isLoggedIn);
  toggleAuthCards(!isLoggedIn);
  toggleAuthSuccess(isLoggedIn, email);
  setLoginStateFlag(isLoggedIn);
}

async function fetchPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("id, created_at, user_id, body")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return data || [];
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
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
    card.dataset.id = post.id;

    const meta = document.createElement("p");
    meta.className = "muted small postMetaRow";
    meta.textContent = formatDate(post.created_at);

    const body = document.createElement("p");
    body.innerHTML = escapeHtml(post.body || "");

    card.append(meta, body);

    if (currentSession?.user?.id && post.user_id === currentSession.user.id) {
      const actions = document.createElement("div");
      actions.className = "postActions";
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn ghost small";
      deleteBtn.textContent = "Delete";
      deleteBtn.dataset.action = "delete";
      deleteBtn.dataset.id = post.id;
      actions.appendChild(deleteBtn);
      card.appendChild(actions);
    }

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
  updateAuthVisibility(true, typeof email === "string" ? email : "your account");
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

async function handleLogout() {
  await supabase.auth.signOut();
}

async function handlePostSubmit(event) {
  event.preventDefault();
  if (!postForm || !postBodyInput) return;
  setStatus(postError, "");
  setStatus(postStatus, "Publishing your post...");

  const body = postBodyInput.value.trim();
  if (!body) {
    setStatus(postError, "Please write something before posting.", "error");
    setStatus(postStatus, "");
    return;
  }
  if (body.length > 2000) {
    setStatus(postError, "Post must be 2000 characters or fewer.", "error");
    setStatus(postStatus, "");
    return;
  }

  const { error } = await supabase.from("posts").insert({ body });

  if (error) {
    setStatus(postError, error.message, "error");
    setStatus(postStatus, "");
    return;
  }

  setStatus(postStatus, "Posted! Refreshing the feed...");
  postBodyInput.value = "";
  await refreshPosts();
  setStatus(postStatus, "Your post is live.");
}

async function handleDelete(id) {
  if (!id) return;
  setStatus(postStatus, "Removing post...");
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) {
    setStatus(postError, error.message, "error");
    setStatus(postStatus, "");
    return;
  }
  await refreshPosts();
  setStatus(postStatus, "Post removed.");
}

async function loadSession() {
  const { data } = await supabase.auth.getSession();
  currentSession = data.session;
  if (currentSession) {
    setStatus(authStatus, `Logged in as ${currentSession.user.email}`);
    updateAuthVisibility(true, currentSession.user.email);
  } else {
    setStatus(authStatus, "You are browsing as a guest.");
    updateAuthVisibility(false);
  }
  refreshPosts();
}

function initAuthListeners() {
  supabase.auth.onAuthStateChange((event, session) => {
    currentSession = session;
    if (event === "SIGNED_OUT") {
      setStatus(authStatus, "Signed out.");
      updateAuthVisibility(false);
    }
    if (event === "SIGNED_IN") {
      setStatus(authStatus, `Logged in as ${session?.user?.email || "member"}.`);
      updateAuthVisibility(true, session?.user?.email || "your account");
    }
    refreshPosts();
  });
}

function subscribeToPosts() {
  if (!feed) return;
  if (postsChannel) return;
  postsChannel = supabase
    .channel("public:posts")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "posts" },
      () => {
        refreshPosts();
      },
    )
    .subscribe();
}

function bindEvents() {
  loginForm?.addEventListener("submit", handleLogin);
  signupForm?.addEventListener("submit", handleSignup);
  logoutButton?.addEventListener("click", handleLogout);
  postForm?.addEventListener("submit", handlePostSubmit);

  feed?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action === "delete" && target.dataset.id) {
      handleDelete(target.dataset.id);
    }
  });
}

function init() {
  bindEvents();
  initAuthListeners();
  loadSession();
  subscribeToPosts();
}

init();
