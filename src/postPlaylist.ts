/// <reference path="./type.d.ts" />

function getRelativeTime(timestamp: string): string { // converts timestamp
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  const intervals = {
    year: 31536000, 
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  let counter: number;
  if (seconds > intervals.year) {
    counter = Math.floor(seconds / intervals.year);
    return `${counter}y`;
  } else if (seconds > intervals.month) {
    counter = Math.floor(seconds / intervals.month);
    return `${counter}mo`;
  } else if (seconds > intervals.week) {
    counter = Math.floor(seconds / intervals.week);
    return `${counter}w`;
  } else if (seconds > intervals.day) {
    counter = Math.floor(seconds / intervals.day);
    return `${counter}d`;
  } else if (seconds > intervals.hour) {
    counter = Math.floor(seconds / intervals.hour);
    return `${counter}h`;
  } else if (seconds >= intervals.minute) {
    counter = Math.floor(seconds / intervals.minute);
    return `${counter}m`;
  }
  return "Just now";
}

// tracks if the user is trying to post a track or playlist 
let selectedType = '';

document.addEventListener('DOMContentLoaded', () => {
  const typeButtons = document.querySelectorAll('.type-button');
  const linkInput = document.getElementById("playlistLink") as HTMLInputElement;
  typeButtons.forEach(button => {
    button.addEventListener('click', () => {
      typeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const type = button.getAttribute('data-type');
      if (type === 'playlist' || type === 'track') {
        selectedType = type;
        if (selectedType === 'track') {
          linkInput.placeholder = "Type a song name...";
        } else {
            linkInput.placeholder = "Paste your playlist link...";
        }
        console.log("Selected type updated to:", selectedType);
      }
    });
  });
});

// verify if the input is correct 
document.getElementById("playlistForm")!.addEventListener("submit", async (event) => {
  event.preventDefault();
  const linkInput = (document.getElementById("playlistLink") as HTMLInputElement).value;
  const spotifyId = extractSpotifyId(linkInput, selectedType);    
  const caption = (document.getElementById("postCaption") as HTMLTextAreaElement).value;

  const token = localStorage.getItem("accessToken");
  if (!token) {
    alert("Please log in first.");
    return;
  }
  if (!spotifyId) {
    alert("INVALITD SPOTIFY LINK.\nMake sure that you selected a type for your post");
    return;
  }

  try {
    const details = await (selectedType === 'playlist' 
      ? fetchPlaylistDetails(token, spotifyId) 
      : fetchTrackDetails(token, spotifyId));
    const userProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");

    const globalPost: Post = {
      ...details,
      type: selectedType,
      caption: caption.trim(),
      postId: `${userProfile.id}_${spotifyId}_${Date.now()}`,
      userId: userProfile.id,
      userName: userProfile.display_name,
      userImage: userProfile.images?.[0]?.url || "default-profile.png",
      timestamp: new Date().toISOString()
    };

    // Clear inputs
    (document.getElementById("playlistLink") as HTMLInputElement).value = "";
    (document.getElementById("postCaption") as HTMLTextAreaElement).value = "";

    // Display the new post immediately at the top
    displayPost(globalPost);
  } catch (error) {
    console.error("Error:", error);
    alert("Failed to post playlist.");
  }
});

// GET track details
async function fetchTrackDetails(token: string, trackId: string): Promise<any> {
  const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, { //endpoint
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch track details: ${response.status} - ${await response.text()}`);
  }
  const data = await response.json();
  return {
    postId: `${trackId}_${Date.now()}`,
    userId: "",
    userName: "",
    userImage: "",
    timestamp: new Date().toISOString(),
    type: 'track',
    name: data.name,
    artist: data.artists.map((a: any) => a.name).join(', '),
    duration: Math.floor(data.duration_ms / 1000),
    thumbnail: data.album.images[0]?.url,
    link: data.external_urls.spotify
  };
}

// GET playlist details
async function fetchPlaylistDetails(token: string, playlistId: string): Promise<any> {
  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch playlist details: ${response.status} - ${await response.text()}`);
  }
  const data = await response.json();
  const totalDurationMs = data.tracks.items.reduce(
    (total: number, item: any) => total + item.track.duration_ms,
    0
  );
  const totalDurationMinutes = Math.floor(totalDurationMs / 60000); // calculates duration
  return {
    id: playlistId,
    name: data.name,
    thumbnail: data.images[0]?.url ?? null,
    totalTracks: data.tracks.total,
    totalDuration: totalDurationMinutes,
    link: data.external_urls.spotify,
    caption: '',
  };
}

// --- Debounce Helper ---
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
let timeoutId: number | undefined;
return function (...args: any[]) {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = window.setTimeout(() => fn(...args), delay);
} as T;
}

// --- Spotify Track Search Function ---
async function searchSpotify(query: string): Promise<any[]> {
const token = localStorage.getItem("accessToken");
if (!token) {
  alert("Please log in first.");
  return [];
}
try {
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    console.error("Search error:", await response.text());
    return [];
  }
  const data = await response.json();
  return data.tracks.items;
} catch (error) {
  console.error("Search error:", error);
  return [];
}
}

// --- Render Search Results ---
function renderSearchResults(results: any[]) {
const resultsContainer = document.getElementById("searchResults");
if (!resultsContainer) return;

resultsContainer.innerHTML = "";

results.forEach(result => {
  const li = document.createElement("li");
  li.className = "search-result";
  li.style.cursor = "pointer";
  li.innerHTML = `
    <img class="search-cover" src="${result.album.images[0]?.url}" alt="${result.name}" />
    <div class="search-info">
      <div class="search-title">${result.name}</div>
      <div class="search-artist">${result.artists.map((a: any) => a.name).join(", ")}</div>
    </div>
  `;
  li.addEventListener("click", () => {
    (document.getElementById("playlistLink") as HTMLInputElement).value = result.external_urls.spotify;
    resultsContainer.innerHTML = "";
    resultsContainer.style.display = "none";
  });
  resultsContainer.appendChild(li);
});

resultsContainer.style.display = "block";
}


// --- Attach Search Functionality to the Input ---
const playlistLinkInput = document.getElementById("playlistLink") as HTMLInputElement;
playlistLinkInput.addEventListener("input", debounce(async (e: Event) => {
  const value = (e.target as HTMLInputElement).value.trim();
  const resultsContainer = document.getElementById("searchResults");
  
  // If resultsContainer is not found, exit the function.
  if (!resultsContainer) return;
  
  // Only perform search if the user is posting a track (song)
  if (selectedType !== "track") {
    resultsContainer.innerHTML = "";
    resultsContainer.style.display = "none";
    return;
  }
  
  // If the input value doesn't look like a full Spotify link and is long enough, treat it as a search query
  if (!value.includes("spotify.com") && value.length > 2) {
    const results = await searchSpotify(value);
    if (results.length === 0) {
      resultsContainer.innerHTML = "";
      resultsContainer.style.display = "none";
    } else {
      renderSearchResults(results);
    }
  } else {
    resultsContainer.innerHTML = "";
    resultsContainer.style.display = "none";
  }
}, 300));


function extractSpotifyId(link: string, type: string): string | null {
  const patterns = {
    playlist: /(?:playlist\/|^)([a-zA-Z0-9]{22})/,
    track: /(?:track\/|^)([a-zA-Z0-9]{22})/
  };
  const match = link.match(patterns[type as keyof typeof patterns]);
  return match ? match[1] : null;
}

// display the post content and put it into the DOM
function displayTrack(details: Post, container: HTMLElement = document.createElement("div")) {
  const trackDiv = document.createElement("div");
  trackDiv.className = "playlist-item";
  const currentUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
  const likedPosts = JSON.parse(localStorage.getItem("likedPosts") || "{}");
  const initialCount = likedPosts[details.postId] ? likedPosts[details.postId].length : 0;

  const deleteButtonHTML = currentUser.id === details.userId ? 
    `<button class="delete-button"><img class="delete-icon" src="/icons/delete-svgrepo-com.svg"></button>` : 
    "";

  trackDiv.innerHTML = `
    <div class="user-info">
      <img src="${details.userImage}" alt="${details.userName}" class="user-avatar" width="50">
      <span class="user-name">${details.userName}</span>
      <span class="post-time" data-timestamp="${details.timestamp}" title="${new Date(details.timestamp).toLocaleString()}">
        ${getRelativeTime(details.timestamp)}
      </span>
    </div>
    <div class="post">
      ${details.caption ? `<p class="post-caption">${details.caption}</p>` : ''}
      <div class="track-details">
        <img src="${details.thumbnail}" alt="${details.name}" class="thumbnail" width="100">
        <div>
          <a class="title" href="${details.link}" target="_blank">${details.name}</a>
          <div class="content">
            <p>Artist: ${details.artist}</p>
            <p>Duration: ${Math.floor(details.duration! / 60)}:${(details.duration! % 60).toString().padStart(2, '0')}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="interactions">
      <button class="reaction-button"><img class="fire-icon" src="/icons/fire-svgrepo-com .svg"> <span class="reaction-count">${initialCount}</span></button>
      <button class="comment-button"><img class="comment-icon" src="/icons/bubble-svgrepo-com.svg"></button>
      <button class="share-button"><img class="share-icon" src="/icons/share-svgrepo-com.svg"></button>
      ${deleteButtonHTML}
    </div>
    <div class="comments-section hidden">
      <textarea class="comment-input" placeholder="Write a comment..."></textarea>
      <button class="add-comment-button">Add Comment</button>
      <ul class="comments-list"></ul>
    </div>
  `;

  const deleteButton = trackDiv.querySelector(".delete-button");
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      const currentUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
      if (currentUser.id !== details.userId) {
        alert("You don't have permission to delete this post");
        return;
      }
      trackDiv.remove();
      const globalPlaylists = JSON.parse(localStorage.getItem("globalPlaylists") || "[]");
      const updatedPlaylists = globalPlaylists.filter(
        (post: any) => post.postId !== details.postId
      );
      localStorage.setItem("globalPlaylists", JSON.stringify(updatedPlaylists));
    });
  }

  // Setup interactions and comment functionality
  initializeInteractions(trackDiv, details);
  initializeComments(trackDiv, details.postId);

  container.appendChild(trackDiv);
}

function displayPlaylist(details: any, container?: HTMLElement) {
  const playlistDiv = document.createElement("div");
  playlistDiv.className = "playlist-item";
  const currentUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
  const likedPosts = JSON.parse(localStorage.getItem("likedPosts") || "{}");
  const initialCount = likedPosts[details.postId] ? likedPosts[details.postId].length : 0;

  const deleteButtonHTML = currentUser.id === details.userId ? 
    `<button class="delete-button"><img class="delete-icon" src="/icons/delete-svgrepo-com.svg"></button>` : 
    "";

  playlistDiv.innerHTML = `
    <div class="user-info">
      <img src="${details.userImage}" alt="${details.userName}" class="user-avatar" width="50">
      <span class="user-name">${details.userName}</span>
      <span class="post-time" data-timestamp="${details.timestamp}" title="${new Date(details.timestamp).toLocaleString()}">
        ${getRelativeTime(details.timestamp)}
      </span>
    </div>
    <div class="post">
      ${details.caption ? `<p class="post-caption">${details.caption}</p>` : ''}
      <div class="playlist-details">
        <img src="${details.thumbnail}" alt="${details.name}" class="thumbnail" width="100">
        <div>
          <a class="title" href="${details.link}" target="_blank">${details.name}</a>
          <div class="content">
            <p>Tracks: ${details.totalTracks}</p>
            <p>Duration: ${details.totalDuration} minutes</p>
          </div>
        </div>
      </div>
    </div>
    <div class="interactions">
      <button class="reaction-button"><img class="fire-icon" src="/icons/fire-svgrepo-com .svg"> <span class="reaction-count">${initialCount}</span></button>
      <button class="comment-button"><img class="comment-icon" src="/icons/bubble-svgrepo-com.svg"></button>
      <button class="share-button"><img class="share-icon" src="/icons/share-svgrepo-com.svg"></button>
      ${deleteButtonHTML}
    </div>
    <div class="comments-section hidden">
      <textarea class="comment-input" placeholder="Write a comment..."></textarea>
      <button class="add-comment-button">Add Comment</button>
      <ul class="comments-list"></ul>
    </div>
  `;

  const deleteButton = playlistDiv.querySelector(".delete-button");
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      const currentUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
      if (currentUser.id !== details.userId) {
        alert("You don't have permission to delete this post");
        return;
      }
      playlistDiv.remove();
      const globalPlaylists = JSON.parse(localStorage.getItem("globalPlaylists") || "[]");
      const updatedPlaylists = globalPlaylists.filter(
        (post: any) => post.postId !== details.postId
      );
      localStorage.setItem("globalPlaylists", JSON.stringify(updatedPlaylists));
    });
  }

  // Setup interactions and comment functionality
  initializeInteractions(playlistDiv, details);
  initializeComments(playlistDiv, details.postId);

  if (container) {
    container.appendChild(playlistDiv);
  } else {
    const playlistList = document.getElementById("playlistList")!;
    playlistList.insertBefore(playlistDiv, playlistList.firstChild);
  }
}

// display track or playlist
function displayPost(details: Post) {
  const playlistList = document.getElementById("playlistList")!;
  const tempDiv = document.createElement("div");

  const noPostsMessage = playlistList.querySelector(".no-posts");
  if (noPostsMessage) {
    noPostsMessage.remove();
  } else {
    noPostsMessage;
  }
  
  if (details.type === 'playlist') {
    displayPlaylist(details, tempDiv);
  } else {
    displayTrack(details, tempDiv);
  }
  
  if (tempDiv.firstElementChild) {
    playlistList.insertBefore(tempDiv.firstElementChild, playlistList.firstChild); // sorting: put the latest one on the top
  }

  const globalPlaylists = JSON.parse(localStorage.getItem("globalPlaylists") || "[]");
  globalPlaylists.unshift(details);
  localStorage.setItem("globalPlaylists", JSON.stringify(globalPlaylists)); // save to local storage
}

function updatePostTimestamps() {
  const timeElements = document.querySelectorAll('.post-time');
  timeElements.forEach(elem => {
    const timestamp = elem.getAttribute('data-timestamp');
    if (timestamp) {
      elem.textContent = getRelativeTime(timestamp);
    }
  });
}

setInterval(updatePostTimestamps, 6000);

// like event listener
function initializeInteractions(container: HTMLElement, details: Post) {
  const reactionButton = container.querySelector(".reaction-button");
  const reactionCount = container.querySelector(".reaction-count");
  
  if (reactionButton && reactionCount) {
    reactionButton.addEventListener("click", () => {
      const userId = JSON.parse(localStorage.getItem("userProfile") || "{}").id || "anonymous"; 
      const likedPosts = JSON.parse(localStorage.getItem("likedPosts") || "{}"); 
      
      if (!Array.isArray(likedPosts[details.postId])) {
        likedPosts[details.postId] = [];
      }
      
      const index = likedPosts[details.postId].indexOf(userId);
      if (index === -1) {
        likedPosts[details.postId].push(userId);
      } else {
        likedPosts[details.postId].splice(index, 1);
      }
      
      localStorage.setItem("likedPosts", JSON.stringify(likedPosts));
      reactionCount.textContent = likedPosts[details.postId].length.toString();
    });
  }
}


// comment section per post
function initializeComments(container: HTMLElement, postId: string) {
  const commentButton = container.querySelector(".comment-button");
  const commentsSection = container.querySelector(".comments-section");
  if (commentButton && commentsSection) {
    commentButton.addEventListener("click", () => {
      commentsSection.classList.toggle("hidden"); // hide or show the comment section
    });
  }

  const commentsList = container.querySelector(".comments-list") as HTMLUListElement;
  const addCommentButton = container.querySelector(".add-comment-button")!;
  const commentInput = container.querySelector(".comment-input") as HTMLTextAreaElement;

  // render post
  const renderComments = () => {
    const storedComments = JSON.parse(localStorage.getItem("comments") || "{}");
    const postComments = storedComments[postId] || [];
    commentsList.innerHTML = "";
    postComments.forEach((comment: AppComment) => addCommentToUI(comment, commentsList, postId));
  };

  renderComments();

  // creates comment
  addCommentButton.addEventListener("click", () => {
    const commentText = commentInput.value.trim();
    if (!commentText) return;

    const userProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const newComment: AppComment = {
      commentId: `${Date.now()}_${userProfile.id || "anonymous"}`,
      userId: userProfile.id || "anonymous",
      userName: userProfile.display_name || "Anonymous User",
      userImage: userProfile.images?.[0]?.url || "default-profile.png",
      text: commentText,
      timestamp: new Date().toISOString()
    };

    const storedComments = JSON.parse(localStorage.getItem("comments") || "{}");
    const storedPostComments = storedComments[postId] || [];
    const updatedComments = {
      ...storedComments,
      [postId]: [...storedPostComments, newComment]
    };
    localStorage.setItem("comments", JSON.stringify(updatedComments));

    commentInput.value = "";
    renderComments();
    // Ensure the comment section remains visible after adding a comment
    commentsSection?.classList.remove("hidden");
  });
}


function addCommentToUI(comment: AppComment, commentsList: HTMLUListElement, postId: string) {
  const li = document.createElement("li");
  li.className = "comment-item";
  const currentUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
  li.innerHTML = `
    <div class="comment-header">
      <img src="${comment.userImage}" alt="${comment.userName}" class="comment-avatar" width="30" height="30">
      <span class="comment-author">${comment.userName}</span>
      <span class="comment-time" title="${new Date(comment.timestamp).toLocaleString()}">
          ${getRelativeTime(comment.timestamp)}
      </span>
    </div>
    <p class="comment-text">${comment.text}</p>
    ${comment.userId === currentUser.id ? '<button class="delete-comment-btn">🗑️</button>' : ''}
  `;

  const deleteBtn = li.querySelector(".delete-comment-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      const allComments = JSON.parse(localStorage.getItem("comments") || "{}");
      const updatedComments = allComments[postId].filter((c: AppComment) => c.commentId !== comment.commentId);
      allComments[postId] = updatedComments;
      localStorage.setItem("comments", JSON.stringify(allComments));
      li.remove();
    });
  }
  commentsList.appendChild(li);
}

function displayAllPlaylists() {
  const globalPlaylists = JSON.parse(localStorage.getItem("globalPlaylists") || "[]");
  const playlistList = document.getElementById("playlistList")!;
  const postsToRemove = Array.from(playlistList.children).filter(
    child => !child.classList.contains('postContainer')
  );
  postsToRemove.forEach(child => child.remove());

  if (globalPlaylists.length > 0) {
    playlistList.innerHTML = '';
  }

  const tempDiv = document.createElement("div");
  globalPlaylists
    .sort((a: Post, b: Post) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .forEach((post: Post) => {
      tempDiv.innerHTML = "";
      if (post.type === 'playlist') {
        displayPlaylist(post, tempDiv);
      } else {
        displayTrack(post, tempDiv);
      }
      if (tempDiv.firstElementChild) {
        playlistList.appendChild(tempDiv.firstElementChild);
      }
    });

  if (globalPlaylists.length === 0) {
    playlistList.innerHTML = '<p class="no-posts">No saved playlists or tracks found</p>';
  }
}

function createPostElement(details: Post): HTMLElement {
  const postDiv = document.createElement("div");
  postDiv.className = "post-item";

  const typeContent = details.type === 'playlist' ? `
    <p>Tracks: ${details.totalTracks}</p>
    <p>Duration: ${details.totalDuration} minutes</p>
  ` : `
    <p>Artist: ${details.artist}</p>
    <p>Duration: ${Math.floor(details.duration! / 60)}:${(details.duration! % 60).toString().padStart(2, '0')}</p>
  `;

  const interactionsHTML = `
    <div class="interactions">
      <button class="reaction-button"><img class="fire-icon" src="/icons/fire-svgrepo-com .svg"> <span class="reaction-count">0</span></button>
      <button class="comment-button"><img class="comment-icon" src="/icons/bubble-svgrepo-com.svg"></button>
      <button class="share-button"><img class="share-icon" src="/icons/share-svgrepo-com.svg"></button>
    </div>
  `;

  postDiv.innerHTML = `
    <div class="user-info">
      <img src="${details.userImage}" alt="${details.userName}" class="user-avatar" width="50">
      <span class="user-name">${details.userName}</span>
      <span class="post-time" data-timestamp="${details.timestamp}">${getRelativeTime(details.timestamp)}</span>
    </div>
    <div class="post-content">
      ${details.caption ? `<p class="caption">${details.caption}</p>` : ''}
      <div class="media-info">
        <img src="${details.thumbnail}" class="thumbnail" width="100">
        <div class="metadata">
          <a href="${details.link}" target="_blank" class="title">${details.name}</a>
          ${typeContent}
        </div>
      </div>
    </div>
    ${interactionsHTML}
  `;
  return postDiv;
}

function loadPlaylistsForUser(userId: string): any[] {
  const userPlaylistsKey = `playlists_${userId}`;
  return JSON.parse(localStorage.getItem(userPlaylistsKey) || "[]");
}

window.onload = () => {
  displayAllPlaylists();
  const token = localStorage.getItem("accessToken");
  if (!token) {
      alert("Please log in.");
      window.location.href = "/login.html"; // Replace with your login page URL
      return;
  }
  const userProfile = JSON.parse(localStorage.getItem("userProfile") || "null");
  if (!userProfile || !userProfile.id) {
    alert("User profile not found. Please log in.");
    window.location.href = "/"; // redirect
  }
  const userId = userProfile.id;
  const userNameElement = document.getElementById("userName") as HTMLElement;
  if (userNameElement) {
    userNameElement.innerText = userProfile.display_name || "Unknown User";
  }
  const userAvatar = document.getElementById("userAvatar") as HTMLImageElement;
  if (userAvatar) {
    userAvatar.src = userProfile.images?.[0]?.url || "default-profile.png";
  }
  const savedPlaylists = loadPlaylistsForUser(userId);
  const playlistList = document.getElementById("playlistList");
  if (playlistList) {
    if (savedPlaylists.length === 0) {
      playlistList.innerText = "No saved playlists.";
    } else {
      savedPlaylists.forEach((playlistDetails) => {
        displayPlaylist(playlistDetails);
      });
    }
  }
  displayAllPlaylists();
};