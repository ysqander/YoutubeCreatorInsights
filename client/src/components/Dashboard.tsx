import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import VideoCard from "./VideoCard";
import ChannelStats from "./ChannelStats";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { toast } = useToast();

  const { data: channelData, isLoading: channelLoading } = useQuery({
    queryKey: ["channel"],
    queryFn: async () => {
      const res = await fetch("/api/youtube/channel");
      if (!res.ok) throw new Error("Failed to fetch channel data");
      return res.json();
    },
  });

  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ["videos"],
    queryFn: async () => {
      const res = await fetch("/api/youtube/videos");
      if (!res.ok) throw new Error("Failed to fetch videos");
      return res.json();
    },
  });

  const connectYouTube = () => {
    window.location.href = "/api/youtube/auth";
  };

  // Handle OAuth callback errors
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const youtube = params.get('youtube');

    if (error) {
      let message = "Failed to connect YouTube account";
      if (error === 'youtube_auth_failed') {
        message = "YouTube authentication was cancelled or failed";
      } else if (error === 'no_auth_code') {
        message = "No authorization code received from YouTube";
      } else if (error === 'youtube_token_failed') {
        message = "Failed to get YouTube access token";
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });

      // Clear the error from URL
      window.history.replaceState({}, '', '/');
    }

    if (youtube === 'connected') {
      toast({
        title: "Success",
        description: "YouTube account connected successfully!",
      });
      // Clear the success message from URL
      window.history.replaceState({}, '', '/');
    }
  }, [toast]);

  if (channelLoading || videosLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!channelData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Connect Your YouTube Channel</h2>
        <Button
          onClick={connectYouTube}
          className="bg-red-600 hover:bg-red-700"
        >
          Connect YouTube
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ChannelStats stats={channelData} />
      
      <div>
        <h2 className="text-2xl font-bold mb-4">Recent Videos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos?.map((video: any) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      </div>
    </div>
  );
}
