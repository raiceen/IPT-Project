interface UserProfile {
  id: string;
  display_name?: string;
  email?: string;
  uri?: string;
  images?: Image[];
  external_urls?: {
    spotify: string;
  };
  href?: string;
  // Other Spotify properties remain optional
  country?: string;
  explicit_content?: {
    filter_enabled: boolean;
    filter_locked: boolean;
  };
  followers?: {
    href: string;
    total: number;
  };
  product?: string;
  type?: string;
}
interface Image {
  url: string;
  height: number;
  width: number;
}

interface Post {
  type: 'playlist' | 'track';
  id: string;
  name: string;
  // Playlist specific
  totalTracks?: number;
  totalDuration?: number;
  // Track specific
  artist?: string;
  duration?: number;
  // Common
  thumbnail?: string;
  link: string;
  caption: string;
  postId: string;
  userId: string;
  userName: string;
  userImage: string;
  timestamp: string;
}

interface AppComment {  // Changed from 'Comment'
  commentId: string;
  userId: string;
  userName: string;
  userImage: string;
  text: string;
  timestamp: string;
}

interface PlaylistPost {
  postId: string;
  userId: string;
  userName: string;
  userImage: string;
  timestamp: string;
  // Playlist properties
  name?: string;
  thumbnail?: string | null;
  totalTracks?: number;
  totalDuration?: number;
  link?: string;
  caption?: string;
}


interface UserProfile {
  id: string;
  display_name: string;
  images: { url: string }[];
}