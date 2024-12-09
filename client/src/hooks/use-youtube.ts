import { useQuery } from "@tanstack/react-query";
import type { User } from "@db/schema";

interface ChannelStats {
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

interface VideoStats {
  views: number;
  likes: number;
  comments: number;
}

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  stats: VideoStats;
}

async function fetchChannelStats(): Promise<ChannelStats> {
  const response = await fetch("/api/youtube/channel", {
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Not authenticated with YouTube");
    }
    throw new Error(`Failed to fetch channel stats: ${await response.text()}`);
  }

  return response.json();
}

async function fetchVideos(): Promise<Video[]> {
  const response = await fetch("/api/youtube/videos", {
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Not authenticated with YouTube");
    }
    throw new Error(`Failed to fetch videos: ${await response.text()}`);
  }

  return response.json();
}

export function useYouTube() {
  const channelQuery = useQuery<ChannelStats, Error>({
    queryKey: ["youtube", "channel"],
    queryFn: fetchChannelStats,
    retry: false,
  });

  const videosQuery = useQuery<Video[], Error>({
    queryKey: ["youtube", "videos"],
    queryFn: fetchVideos,
    retry: false,
  });

  const isConnected = !channelQuery.error || channelQuery.error.message !== "Not authenticated with YouTube";

  return {
    channelStats: channelQuery.data,
    isLoadingChannel: channelQuery.isLoading,
    channelError: channelQuery.error,
    
    videos: videosQuery.data,
    isLoadingVideos: videosQuery.isLoading,
    videosError: videosQuery.error,
    
    isConnected,
    
    connectYouTube: () => {
      window.location.href = "/api/youtube/auth";
    },
  };
}
