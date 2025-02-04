const clientId = "4d3d048c157c413fa6c5686361d5e11e";
const params = new URLSearchParams(window.location.search);
const code = params.get("code");
params.append("scope", "user-read-private user-read-email");

export async function redirectToAuthCodeFlow(clientId: string) {
  localStorage.removeItem("userProfile"); // Remove only specific keys.
  sessionStorage.clear(); 

  const verifier = generateCodeVerifier(128);
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("verifier", verifier);

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("response_type", "code");
  params.append("redirect_uri", "http://localhost:5173/callback");
  params.append("scope", "user-read-private user-read-email playlist-read-private" );
  params.append("code_challenge_method", "S256");
  params.append("code_challenge", challenge);

  document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function validateToken(token: string): Promise<boolean> {
  try {
    // Try fetching the profile with the token
    await fetchProfile(token);
    return true;
  } catch (error) {
    return false;
  }
}

const storedToken = localStorage.getItem("accessToken");

if (storedToken) {
    console.log("Using stored token:", storedToken);
    const profile = await fetchProfile(storedToken);
    populateUI(profile);
    if (await validateToken(storedToken)) {
      console.log("Using stored token:", storedToken);
      const profile = await fetchProfile(storedToken);
      populateUI(profile);
    } else {
      // If token is invalid/expired, remove it and force login
      localStorage.removeItem("accessToken");
      redirectToAuthCodeFlow(clientId);
    }
} else if (!code) {
  redirectToAuthCodeFlow(clientId);
} else {
  try {
      const accessToken = await getAccessToken(clientId, code); // Retrieve the access token
      localStorage.setItem("accessToken", accessToken); // Save the token to localStorage
      console.log("Access token saved:", accessToken);

      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      const profile = await fetchProfile(accessToken); // Use the token to fetch the profile
      console.log(profile);

      populateUI(profile); // Populate the UI with user data
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

export async function getAccessToken(clientId: string, code: string): Promise<string> {
  const verifier = localStorage.getItem("verifier");
  
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
  console.log("New Access Token:", access_token); // Log the token
  return access_token;
}

async function fetchProfile(token: string): Promise<UserProfile> {
  const result = await fetch("https://api.spotify.com/v1/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
  });

  if (!result.ok) {
      throw new Error(
          `Failed to fetch profile: ${result.status} - ${await result.text()}`
      );
  }

  const profile = await result.json();
  localStorage.setItem("userProfile", JSON.stringify(profile)); // Save to localStorage
  return profile;
}



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
        name: data.name,
        thumbnail: data.images[0]?.url ?? null,
        totalTracks: data.tracks.total,
        totalDuration: totalDurationMinutes,
        link: data.external_urls.spotify,
    };
}



export async function fetchPlaylists(token: string,): Promise<any[]> {
  console.log("Fetching playlists with token:", token);

  const result = await fetch("https://api.spotify.com/v1/me/playlists", {
      method: "GET",
      headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
      },
  });

  if (!result.ok) {
      const errorText = await result.text();
      console.error("Failed to fetch playlists. Status:", result.status, "Response:", errorText);
      throw new Error(`Failed to fetch playlists: ${result.status} - ${errorText}`);
  }

  const data = await result.json();
  const playlists = data.items || []; // Ensure `playlists` is an array

  // Fetch additional details for each playlist
  const detailedPlaylists = await Promise.all(
    playlists.map(async (playlist: any) => {
        const details = await fetchPlaylistDetails(token, playlist.id);
        return { ...playlist, details };
    })
  );

  localStorage.setItem("playlists", JSON.stringify(playlists));


  return detailedPlaylists;
}

function populateUI(profile: UserProfile) {
  document.getElementById("displayName")!.innerText = profile.display_name;

  // Clear the avatar container first
  const avatarContainer = document.getElementById("avatar")!;
  avatarContainer.innerHTML = "";

  if (profile.images[0]) {
      const profileImage = new Image(200, 200);
      profileImage.src = profile.images[0].url;
      avatarContainer.appendChild(profileImage);
  }
  
  document.getElementById("id")!.innerText = profile.id;
  document.getElementById("email")!.innerText = profile.email;
  document.getElementById("uri")!.innerText = profile.uri;
  document.getElementById("uri")!.setAttribute("href", profile.external_urls.spotify);
  document.getElementById("url")!.innerText = profile.href;
  document.getElementById("url")!.setAttribute("href", profile.href);
  document.getElementById("imgUrl")!.innerText = profile.images[0]?.url ?? '(no profile image)';
}


export function populatePlaylists(playlists: any[]) {
  const playlistList = document.getElementById("playlistList")!;
  playlistList.innerHTML = ""; // Clear previous content

  if (playlists.length === 0) {
    playlistList.innerText = "No playlists found.";
    return;
  }

  playlists.forEach((playlist) => {
      const li = document.createElement("li");

      if (playlists.length === 0) {
        playlistList.innerText = "No playlists found.";
        return;
      }
      
      if (playlist.images[0]) {
        const img = document.createElement("img");
        img.src = playlist.images[0].url;
        img.alt = `${playlist.name} cover image`;
        img.width = 100; // Adjust size
        li.appendChild(img);
      }

      const link = document.createElement("a");
      link.href = playlist.external_urls.spotify;
      link.target = "_blank"; // Open in a new tab
      link.innerText = playlist.name;
      li.appendChild(link);

      const songCount = document.createElement("p");
      songCount.innerText = `${playlist.details.tracks.total} songs`;
      li.appendChild(songCount);

      const totalDuration = playlist.details.tracks.items
        .map((item: any) => item.track.duration_ms)
        .reduce((sum: number, duration: number) => sum + duration, 0);

      const durationElement = document.createElement("p");
      durationElement.innerText = `Total Duration: ${msToTime(totalDuration)}`;
      li.appendChild(durationElement);


      playlistList.appendChild(li);


  });
}


function msToTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours > 0 ? `${hours}h ` : ""}${minutes}m`;
}


document.getElementById("goToPostPage")!.addEventListener("click", () => {
  const token = localStorage.getItem("accessToken");
  if (token) {
      // Redirect to the new page with the access token as a query parameter
      window.location.href = `post-playlist.html?accessToken=${encodeURIComponent(token)}`;
  } else {
      alert("Please log in first.");
  }
});

document.getElementById("logoutButton")!.addEventListener("click", logout);

export function logout() {
  console.log("Clearing user session...");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("userProfile");
  sessionStorage.clear();

  // Optional: Clear user-specific playlists
  // localStorage.removeItem(`playlists_${userId}`);

  window.location.href = "/";
}

