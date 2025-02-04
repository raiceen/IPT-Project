document.getElementById("playlistForm")!.addEventListener("submit", async (event) => {
    event.preventDefault();
    const playlistLink = (document.getElementById("playlistLink") as HTMLInputElement).value;
    const playlistId = extractPlaylistId(playlistLink);
    if (!playlistId) {
        alert("Invalid Spotify playlist link.");
        return;
    }

    const token = localStorage.getItem("accessToken");
    if (!token) {
        alert("Please log in first.");
        return;
    }

    try {
        const playlistDetails = await fetchPlaylistDetails(token, playlistId);
        const userProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");

        // Create a global post entry
        const globalPost = {
            ...playlistDetails,
            postId: `${userProfile.id}_${playlistId}_${Date.now()}`, // Unique ID
            userId: userProfile.id,
            userName: userProfile.display_name,
            userImage: userProfile.images?.[0]?.url || "default-profile.png",
            timestamp: new Date().toISOString()
        };

        // Save to global playlists
        const globalPlaylists = JSON.parse(localStorage.getItem("globalPlaylists") || "[]");
        globalPlaylists.push(globalPost);
        localStorage.setItem("globalPlaylists", JSON.stringify(globalPlaylists));

        displayPlaylist(globalPost);
    } catch (error) {
        console.error("Error:", error);
        alert("Failed to post playlist.");
    }
});


function displayUserPlaylists(userId: string) {
    const userPlaylistsKey = `playlists_${userId}`;
    const savedPlaylists = JSON.parse(localStorage.getItem(userPlaylistsKey) || "[]");

    const playlistList = document.getElementById("playlistList")!;
    playlistList.innerHTML = '';  // Clear any existing playlists on the page

    savedPlaylists.forEach((details: any) => {
        displayPlaylist(details);  // Use the displayPlaylist function to show each playlist
    });
}



// Helper to extract playlist ID from Spotify playlist link
function extractPlaylistId(link: string): string | null {
    const match = link.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

function displayPlaylist(details: any) {
    const playlistList = document.getElementById("playlistList")!;
    const playlistDiv = document.createElement("div");
    playlistDiv.className = "playlist-item";

    // Retrieve user profile for display
    const userProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const likedPosts = JSON.parse(localStorage.getItem("likedPosts") || "{}");
    const initialCount = likedPosts[details.postId] ? likedPosts[details.postId].length : 0;

    playlistDiv.innerHTML = `
        <div class="user-info">
            <img src="${details.userImage}" alt="${details.userName}" class="user-avatar" width="50">
            <span class="user-name">${details.userName}</span>
        </div>
        <div class="playlist-details">
            <img src="${details.thumbnail}" alt="${details.name}" width="100">
            <div>
                <h3>${details.name}</h3>
                <p>Tracks: ${details.totalTracks}</p>
                <p>Duration: ${details.totalDuration} minutes</p>
                <a href="${details.link}" target="_blank">Open on Spotify</a>
                <button class="delete-button">Delete</button>
            </div>
        </div>
        <div class="interactions">
        <button class="reaction-button">👍 <span class="reaction-count">${initialCount}</span></button            <button class="comment-button">💬 Comments</button>
            <button class="share-button">🔗 Share</button>
        </div>
        <div class="comments-section hidden">
            <textarea class="comment-input" placeholder="Write a comment..."></textarea>
            <button class="add-comment-button">Add Comment</button>
            <ul class="comments-list"></ul>
        </div>
    `;

    // -----------------------------
    // Set the initial reaction count from storage:
    const reactionCountElem = playlistDiv.querySelector(".reaction-count")!;
    reactionCountElem.textContent = initialCount.toString();
    // -----------------------------

    // Reaction button toggle functionality:
    const reactionButton = playlistDiv.querySelector(".reaction-button")!;
    const reactionCount = playlistDiv.querySelector(".reaction-count")!;
    reactionButton.addEventListener("click", () => {
        const userId = JSON.parse(localStorage.getItem("userProfile") || "{}").id || "anonymous";   
        const postId = details.postId; // Unique post ID
     
        let likedPosts = JSON.parse(localStorage.getItem("likedPosts") || "{}");
        // Track likes by postId
        if (!likedPosts[postId]) likedPosts[postId] = [];
        const index = likedPosts[postId].indexOf(userId);
        if (index === -1) {
            likedPosts[postId].push(userId);
        } else {
            likedPosts[postId].splice(index, 1);
        }
        localStorage.setItem("likedPosts", JSON.stringify(likedPosts));
        // Update UI
        reactionCount.textContent = likedPosts[postId].length.toString(); // Update immediately
    });

    // (Existing code for delete, comments, share, etc. remains here)
    // For example, delete button:
    const deleteButton = playlistDiv.querySelector(".delete-button")!;
    deleteButton.addEventListener("click", () => {
        // Remove from DOM
        playlistDiv.remove();

        // Remove from localStorage
        const globalPlaylists = JSON.parse(localStorage.getItem("globalPlaylists") || "[]");
        const updatedPlaylists = globalPlaylists.filter((post: any) => post.postId !== details.postId); // Use the unique postId
        localStorage.setItem("globalPlaylists", JSON.stringify(updatedPlaylists));
    });

    // Append the constructed playlist post to the container:
    playlistList.appendChild(playlistDiv);
}



// Display all global playlists
function displayAllPlaylists() {
    const globalPlaylists = JSON.parse(localStorage.getItem("globalPlaylists") || "[]");
    const playlistList = document.getElementById("playlistList")!;
    playlistList.innerHTML = ''; // Clear existing posts
    globalPlaylists.forEach((post: any) => displayPlaylist(post));
}

    
// Save playlist scoped to the logged-in user
function savePlaylistForUser(userId: string, playlistDetails: any) {
    const userPlaylistsKey = `playlists_${userId}`;  // Store playlists using userId as part of the key
    const savedPlaylists = JSON.parse(localStorage.getItem(userPlaylistsKey) || "[]");

    // Check if the playlist already exists in the saved playlists
    if (!savedPlaylists.some((p: any) => p.link === playlistDetails.link)) {
        const updatedPlaylists = [...savedPlaylists, playlistDetails];
        localStorage.setItem(userPlaylistsKey, JSON.stringify(updatedPlaylists));
    }
}



// Load playlists scoped to the logged-in user
function loadPlaylistsForUser(userId: string): any[] {
    const userPlaylistsKey = `playlists_${userId}`;
    return JSON.parse(localStorage.getItem(userPlaylistsKey) || "[]");
}



window.onload = () => {
    const globalPlaylists = JSON.parse(localStorage.getItem("globalPlaylists") || "[]");
    displayAllPlaylists();

    const userProfile = JSON.parse(localStorage.getItem("userProfile") || "null");
    if (!userProfile || !userProfile.id) {
        alert("User profile not found. Please log in.");
        window.location.href = "/"; // Redirect to login
        return;
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

export async function fetchPlaylistDetails(token: string, playlistId: string): Promise<any> {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch playlist details: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();

    // Calculate total duration in minutes
    const totalDurationMs = data.tracks.items.reduce(
        (total: number, item: any) => total + item.track.duration_ms,
        0
    );
    const totalDurationMinutes = Math.floor(totalDurationMs / 60000);

    return {
        id: playlistId,
        name: data.name,
        thumbnail: data.images[0]?.url ?? null,
        totalTracks: data.tracks.total,
        totalDuration: totalDurationMinutes,
        link: data.external_urls.spotify,
    };
}

