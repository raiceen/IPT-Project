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

  totalTracks?: number;
  totalDuration?: number;

  artist?: string;
  duration?: number;

  thumbnail?: string;
  link: string;
  caption: string;
  postId: string;
  userId: string;
  userName: string;
  userImage: string;
  timestamp: string;
}

interface AppComment {  
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