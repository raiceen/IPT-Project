const clientId = "4d3d048c157c413fa6c5686361d5e11e"; // client ID
const params = new URLSearchParams(window.location.search); // get the information inside the url
const code = params.get("code"); // get he code in the URL
params.append("scope", "user-read-private user-read-email playlist-read-private playlist-read-collaborative"); // scope of the api

console.log("Script loaded");

async function redirectToAuthCodeFlow(clientId: string) { // redirect the user to the spotify login
  localStorage.removeItem("userProfile"); 
  sessionStorage.clear(); 

  const verifier = generateCodeVerifier(128);
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("verifier", verifier);
 
  const params = new URLSearchParams(); 
  params.append("client_id", clientId); // get the client id in the url
  params.append("response_type", "code"); // 
  params.append("redirect_uri", "http://localhost:5173/callback");
  params.append("scope", "user-read-private user-read-email playlist-read-private" ); // scope of the Spotify API
  params.append("code_challenge_method", "S256");
  params.append("code_challenge", challenge);

  document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function validateToken(token: string): Promise<boolean> { // checks if the access token is valid
  try {
    await fetchProfile(token);
    return true;
  } catch (error) {
    return false;
  }
}

const storedToken = localStorage.getItem("accessToken");

// check if the token is stored in the local storage
if (storedToken) {
  console.log("Using stored token:", storedToken);
  
  const profile = await fetchProfile(storedToken);
  populateUI(profile);

  if (await validateToken(storedToken)) {
      console.log("Token is valid. Fetching playlists...");
      fetchPlaylists(storedToken) // CALL THIS FUNCTION
        .then(playlists => populatePlaylists(playlists))
        .catch(error => console.error("Error fetching playlists:", error));
  } else {
      console.log("Token invalid. Redirecting to login.");
      localStorage.removeItem("accessToken");
      redirectToAuthCodeFlow(clientId);
  }
} else if (!code) {
  redirectToAuthCodeFlow(clientId);
} else {
  try {
      const accessToken = await getAccessToken(clientId, code);
      localStorage.setItem("accessToken", accessToken); 
      console.log("Access token saved:", accessToken);

      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      const profile = await fetchProfile(accessToken); 
      console.log(profile);

      populateUI(profile); 
  } catch (error) {
      console.error("Error during login:", error);
      alert("Failed to log in. Please try again.");
  }
}

function generateCodeVerifier(length: number) {
  let text = '';
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier: string) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
}

// TOKEN HANDLING! Important for URL navigating and 
async function getAccessToken(clientId: string, code: string): Promise<string> {
  const verifier = localStorage.getItem("verifier"); //stores the token to the local storage

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", "http://localhost:5173/callback");
  params.append("code_verifier", verifier!);

  const result = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
  });
  
  if (!result.ok) {
    console.error("Failed to retrieve access token:", await result.text());
    throw new Error("Failed to retrieve access token");
  }

  const { access_token } = await result.json();
  console.log("New Access Token:", access_token); // token
  return access_token;
}

document.getElementById("goToPostPage")!.addEventListener("click", () => {
  const token = localStorage.getItem("accessToken");
  if (token) {
      // redirect to the new page with the access token as a query parameter
      window.location.href = `post-playlist.html?accessToken=${encodeURIComponent(token)}`;
  } else {
      alert("Please log in first.");
  }
});

//PROFILE API! gets the user's profile data
async function fetchProfile(token: string): Promise<UserProfile> {
  const result = await fetch("https://api.spotify.com/v1/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }, // Identify the user that sending the request to Spotify
  });

  if (!result.ok) {
    if (result.status === 401) {
      localStorage.removeItem("accessToken");
      alert("Your session has expired. Please log in again.");
      window.location.href = "/login.html"; // Adjust the path to your login page
    }
    
      throw new Error(
          `Failed to fetch profile: ${result.status} - ${await result.text()}`
      );
  }

  const profile = await result.json();
  localStorage.setItem("userProfile", JSON.stringify(profile)); //SAVE TO LOCAL STORAGE!!
  return profile;
}

export async function fetchPlaylists(token: string): Promise<any[]> {
  console.log("Fetching playlists from Spotify...");
  try {
    let playlists: any[] = [];
    let nextUrl: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";

    while (nextUrl) {
      const result = await fetch(nextUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!result.ok) {
        const errorText = await result.text();
        console.error("Failed to fetch playlists. Status:", result.status, "Response:", errorText);
        throw new Error(`Failed to fetch playlists: ${result.status} - ${errorText}`);
      }

      const data = await result.json();
      playlists = playlists.concat(data.items);
      nextUrl = data.next;
    }

    console.log("Number of playlists fetched:", playlists.length);

    const detailedPlaylists = await Promise.all(
      playlists.map(async (playlist: any) => {
        try {
          const details = await fetchPlaylistDetails(token, playlist.id);
          console.log("Fetched details for playlist", playlist.id, ":", details);
          return { ...playlist, ...details };
        } catch (err) {
          console.error("Error fetching details for playlist", playlist.id, err);
          return null;
        }
      })
    );
    const filteredPlaylists = detailedPlaylists.filter(item => item !== null);
    console.log("Filtered playlists count:", filteredPlaylists.length);
    localStorage.setItem("playlists", JSON.stringify(filteredPlaylists));
    return filteredPlaylists;
  } catch (error) {
    console.error("Error in fetchPlaylists:", error);
    throw error;
  }
}

async function fetchPlaylistDetails(token: string, playlistId: string): Promise<any> {
  console.log("Fetching details for playlist:", playlistId);
  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch playlist details for ${playlistId}: ${response.status} - ${errorText}`);
      throw new Error(`Failed to fetch playlist details: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log("Raw data for playlist", playlistId, data);

  if (!data.tracks || !Array.isArray(data.tracks.items)) {
    console.error("Invalid tracks data for playlist:", playlistId);
    throw new Error("Invalid tracks data");
  }

  const totalDurationMs = data.tracks.items.reduce(
      (total: number, item: any) => total + item.track.duration_ms,
      0
  );
  const totalDurationMinutes = Math.floor(totalDurationMs / 60000);

  const result = {
    name: data.name,
    thumbnail: data.images && data.images.length > 0 ? data.images[0].url : null,
    totalTracks: data.tracks.total,
    totalDuration: totalDurationMinutes,
    link: data.external_urls.spotify,
  };

  console.log("Computed details for playlist", playlistId, result);
  return result;
}

function populateUI(profile: UserProfile) {

  const displayNameElement = document.getElementById("displayName");
  const idElement = document.getElementById("id");
  const emailElement = document.getElementById("email");
  const uriElement = document.getElementById("uri");
  const urlElement = document.getElementById("url");
  const imgUrlElement = document.getElementById("imgUrl");
  const avatarContainer = document.getElementById("avatar");

  if (displayNameElement) {
    displayNameElement.innerText = profile.display_name || "Anonymous User";
  }

  if (avatarContainer) {
    avatarContainer.innerHTML = "";
    if (profile.images?.[0]?.url) {
      const profileImage = new Image(200, 200);
      profileImage.src = profile.images[0].url;
      avatarContainer.appendChild(profileImage);
    }
  }

  if (idElement) idElement.innerText = profile.id || "";
  if (emailElement) emailElement.innerText = profile.email || "No email available";
  
  if (uriElement) {
    uriElement.innerText = profile.uri || "";
    if (profile.external_urls?.spotify) {
      uriElement.setAttribute("href", profile.external_urls.spotify);
    }
  }

  if (urlElement) {
    urlElement.innerText = profile.href || "";
    if (profile.href) {
      urlElement.setAttribute("href", profile.href);
    }
  }

  if (imgUrlElement) {
    imgUrlElement.innerText = profile.images?.[0]?.url || "(no profile image)";
  }
}

// Update populatePlaylists() to use correct properties
export function populatePlaylists(playlists: any[]) {
  const playlistList = document.getElementById("playlistLists")!;
  playlistList.innerHTML = "";

  if (playlists.length === 0) {
    console.log("No playlists to display");
    playlistList.innerHTML = '<p class="no-playlists">No playlists found.</p>';
    return;
  }

  playlists.forEach((playlist) => {
      const li = document.createElement("li");
      
      // Image
      if (playlist.thumbnail) {
        const img = document.createElement("img");
        img.src = playlist.thumbnail;
        img.alt = `${playlist.name} cover`;
        img.width = 100;
        li.appendChild(img);
      }

      // Name and link
      const link = document.createElement("a");
      link.href = playlist.link;
      link.target = "_blank";
      link.textContent = playlist.name;
      li.appendChild(link);

      // Track count
      const trackCount = document.createElement("p");
      trackCount.textContent = `${playlist.totalTracks} songs`;
      li.appendChild(trackCount);

      // Duration
      const duration = document.createElement("p");
      duration.textContent = `Total Duration: ${playlist.totalDuration} minutes`;
      li.appendChild(duration);

      playlistList.appendChild(li);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded");

  // Check if access token is available
  const accessToken = localStorage.getItem("spotify_access_token");
  console.log("Access Token:", accessToken);

  if (!accessToken) {
      console.error("No access token found. User may not be logged in.");
      return;
  }

  // Fetch Playlists
  fetch("https://api.spotify.com/v1/me/playlists", {
      headers: {
          Authorization: `Bearer ${accessToken}`
      }
  })
  .then(response => response.json())
  .then(data => {
      console.log("Playlists Data:", data);

      const playlistList = document.getElementById("playlistLists");
      if (!playlistList) {
          console.error("Playlist container not found");
          return;
      }

      // Clear existing content
      playlistList.innerHTML = "";

      if (data.items) {
          data.items.forEach((playlist: { name: string | null; }) => {
              const li = document.createElement("li");
              li.textContent = playlist.name;
              playlistList.appendChild(li);
          });
      } else {
          console.error("No playlists found");
      }
  })
  .catch(error => console.error("Error fetching playlists:", error));
});

document.getElementById("logoutButton")!.addEventListener("click", logout);

export function logout() {
  console.log("Clearing user session...");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("userProfile");
  sessionStorage.clear();

  window.location.href = "/";
}