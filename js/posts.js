import { supabase } from "./supabaseClient.js";

const postForm = document.getElementById("new-post-form");
const postContentInput = document.getElementById("post-content");
const postStatus = document.getElementById("post-status");
const postsContainer = document.getElementById("posts");
const mustLogin = document.getElementById("must-login");
const submitButton = document.getElementById("post-submit");

let currentUser = null;

function setStatus(message, tone = "muted") {
  if (!postStatus) return;
  postStatus.textContent = message || "";
  postStatus.className = `${tone} small`;
}

function setFormEnabled(enabled) {
  if (!(submitButton instanceof HTMLButtonElement)) return;
  submitButton.disabled = !enabled;
  submitButton.textContent = enabled ? "Post" : "Posting...";
}

function toggleAuthUI(isLoggedIn) {
  if (postForm) {
    postForm.style.display = isLoggedIn ? "grid" : "none";
  }
  if (mustLogin) {
    mustLogin.style.display = isLoggedIn ? "none" : "block";
  }
}

function formatDate(input) {
  const date = input ? new Date(input) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

function renderPosts(posts) {
  if (!postsContainer) return;

  postsContainer.innerHTML = "";

  if (!posts.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No posts yet. Be the first to share something!";
    postsContainer.appendChild(empty);
    return;
  }

  posts.forEach((post) => {
    const article = document.createElement("article");
    article.className = "card";
    article.dataset.id = post.id;

    const meta = document.createElement("p");
    meta.className = "muted small";
    meta.textContent = formatDate(post.created_at);

    const content = document.createElement("p");
    content.className = "post-content";
    content.style.whiteSpace = "pre-wrap";
    content.textContent = post.content || "";

    article.append(meta, content);
    postsContainer.appendChild(article);
  });
}

async function loadPosts() {
  if (postsContainer) {
    postsContainer.innerHTML = "<p class=\"muted\">Loading posts...</p>";
  }

  const { data, error } = await supabase
    .from("posts")
    .select("id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching posts", error);
    if (postsContainer) {
      postsContainer.innerHTML = "";
      const errorMessage = document.createElement("p");
      errorMessage.className = "error";
      errorMessage.textContent = "Unable to load posts right now.";
      postsContainer.appendChild(errorMessage);
    }
    return;
  }

  renderPosts(data || []);
}

async function refreshAuthUI() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error checking auth status", error);
  }
  currentUser = data?.user ?? null;
  toggleAuthUI(Boolean(currentUser));
  if (!currentUser) {
    setStatus("");
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!currentUser) {
    setStatus("Please log in to post.", "error");
    return;
  }

  const trimmedText = (postContentInput?.value || "").trim();
  if (!trimmedText) {
    setStatus("Post content cannot be empty.", "error");
    return;
  }

  setFormEnabled(false);
  setStatus("");

  const { error } = await supabase.from("posts").insert([{ user_id: currentUser.id, content: trimmedText }]);

  if (error) {
    console.error("Error creating post", error);
    setStatus("Could not create post. Please try again.", "error");
  } else {
    if (postContentInput) {
      postContentInput.value = "";
    }
    setStatus("Post created!", "success");
    await loadPosts();
  }

  setFormEnabled(true);
}

function init() {
  refreshAuthUI();
  loadPosts();

  if (postForm) {
    postForm.addEventListener("submit", handleSubmit);
  }

  supabase.auth.onAuthStateChange(async () => {
    await refreshAuthUI();
    await loadPosts();
  });
}

init();
