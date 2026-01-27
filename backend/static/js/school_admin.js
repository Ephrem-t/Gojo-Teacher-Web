// ---------------- REGISTER ----------------
async function registerAdmin(event) {
    event.preventDefault();
    let form = document.getElementById("registerForm");
    let formData = new FormData(form);
    let response = await fetch("/api/register", { method: "POST", body: formData });
    let result = await response.json();
    alert(result.message);
    if (result.success) window.location.href = "/login";
}

// ---------------- LOGIN ----------------
async function loginAdmin(event) {
    event.preventDefault();
    let username = document.getElementById("loginUsername").value.trim();
    let password = document.getElementById("loginPassword").value.trim();

    let response = await fetch("/api/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username, password })
    });

    let result = await response.json();
    if (result.success) {
        localStorage.setItem("adminId", result.adminId);
        window.location.replace("/dashboard");
    } else alert(result.message);
}

// ---------------- CREATE POST ----------------
// ---------------- CREATE POST ----------------
async function createPost() {
    const message = document.getElementById("post_text").value;
    const media = document.getElementById("post_media").files[0];
    const adminId = localStorage.getItem("adminId");
    if (!adminId) { alert("Login first"); return; }

    let formData = new FormData();
    formData.append("text", message);
    formData.append("adminId", adminId);
    if (media) formData.append("post_media", media);

    const res = await fetch("/api/create_post", { method: "POST", body: formData });
    const data = await res.json();
    alert(data.message);
    if (data.success) loadPosts();
}

// ---------------- LOAD POSTS ----------------
async function loadPosts(isProfile=false) {
    const container = document.getElementById("posts_container");
    container.innerHTML = "";

    let url = isProfile 
        ? `/api/admin_posts?adminId=${localStorage.getItem("adminId")}` 
        : "/api/posts";  // All admins posts

    const res = await fetch(url);
    const posts = await res.json();

    posts.forEach(post => {
        let mediaTag = "";
        if (post.postUrl) {
            const ext = post.postUrl.split('.').pop().toLowerCase();
            if (["jpg","jpeg","png","gif","webp"].includes(ext)) {
                mediaTag = `<img src="${post.postUrl}" style="width:100%;border-radius:10px;">`;
            } else if (["mp4","webm","ogg"].includes(ext)) {
                mediaTag = `<video controls style="width:100%;border-radius:10px;"><source src="${post.postUrl}"></video>`;
            } else if (["mp3","wav","ogg"].includes(ext)) {
                mediaTag = `<audio controls><source src="${post.postUrl}"></audio>`;
            }
        }

        let likesCount = post.likes ? Object.keys(post.likes).length : 0;
        let editedLabel = post.updatedAt ? "<small>(edited)</small>" : "";

        let editDeleteButtons = "";
        const currentAdminId = localStorage.getItem("adminId");
        if (post.adminId === currentAdminId) {
            editDeleteButtons = `
                <button onclick="editPostPrompt('${post.postId}', '${post.message}')">Edit</button>
                <button onclick="deletePost('${post.postId}')">Delete</button>
            `;
        }

        container.innerHTML += `
        <div class="post-box">
            <div style="display:flex;align-items:center;gap:10px;">
                <img src="${post.adminProfile}" alt="Profile" style="width:40px;height:40px;border-radius:50%;">
                <strong>${post.adminName}</strong>
            </div>
            <p>${post.message} ${editedLabel}</p>
            ${mediaTag}
            <small>Posted at: ${post.time}</small>
            <br>
            <button onclick="toggleLike('${post.postId}')">❤️ ${likesCount}</button>
            ${editDeleteButtons}
        </div>
        `;
    });
}


// ---------------- RENDER POSTS ----------------
function renderPosts(posts) {
    const container = document.getElementById("posts_container");
    container.innerHTML = "";

    posts.reverse().forEach(post => {
        const ext = post.postUrl ? post.postUrl.split('.').pop().toLowerCase() : "";
        let mediaTag = "";
        if (["jpg","jpeg","png","gif","webp"].includes(ext)) mediaTag = `<img src="${post.postUrl}" style="width:100%;border-radius:10px;">`;
        else if (["mp4","webm","ogg"].includes(ext)) mediaTag = `<video controls style="width:100%;border-radius:10px;"><source src="${post.postUrl}"></video>`;
        else if (["mp3","wav","ogg"].includes(ext)) mediaTag = `<audio controls><source src="${post.postUrl}"></audio>`;

        let likesCount = post.likes ? Object.keys(post.likes).length : 0;
        let editedLabel = post.edited ? "<small>(edited)</small>" : "";

        let ownerButtons = "";
        if (post.adminId === localStorage.getItem("adminId")) {
            ownerButtons = `
                <button onclick="editPost('${post.postId}')">Edit</button>
                <button onclick="deletePost('${post.postId}')">Delete</button>
            `;
        }

        let html = `
        <div class="post-box">
            <div class="post-header">
                <img src="${post.adminProfile || '/static/images/default.png'}" class="post-profile">
                <strong>${post.adminName}</strong>
            </div>
            <p>${post.message} ${editedLabel}</p>
            ${mediaTag}
            <small>Posted at: ${post.time}</small>
            <br>
            <button onclick="toggleLike('${post.postId}')">❤️ ${likesCount}</button>
            ${ownerButtons}
        </div>
        `;
        container.innerHTML += html;
    });
}

// ---------------- EDIT POST ----------------
async function editPost(postId) {
    const newText = prompt("Edit your post:");
    if (!newText) return;

    const adminId = localStorage.getItem("adminId");
    const res = await fetch(`/edit_post/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, postText: newText })
    });
    const data = await res.json();
    if (data.success) loadPosts();
}

// ---------------- DELETE POST ----------------
async function deletePost(postId) {
    if (!confirm("Are you sure?")) return;
    const adminId = localStorage.getItem("adminId");

    const res = await fetch(`/delete_post/${postId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId })
    });
    const data = await res.json();
    loadPosts();
}

// ---------------- LIKE POST ----------------
async function toggleLike(postId) {
    const adminId = localStorage.getItem("adminId");
    await fetch("/api/like_post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, adminId })
    });
    loadPosts();
}

// ---------------- LOGOUT ----------------
function logoutAdmin() {
    localStorage.clear();
    window.location.href = "/login";
}
// Load posts for dashboard or profile
async function loadPosts(isProfile=false) {
    const container = document.getElementById("posts_container");
    container.innerHTML = "";

    let url = isProfile 
        ? `/api/admin_posts?adminId=${localStorage.getItem("adminId")}` 
        : "/api/posts";  // All admins posts

    const res = await fetch(url);
    const posts = await res.json();

    renderPosts(posts);
}
