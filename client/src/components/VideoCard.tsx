import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, ThumbsUp, MessageSquare } from "lucide-react";

interface VideoCardProps {
  video: {
    title: string;
    thumbnailUrl: string;
    stats: {
      views: number;
      likes: number;
      comments: number;
    };
  };
}

export default function VideoCard({ video }: VideoCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-video relative">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover"
        />
      </div>
      <CardHeader>
        <CardTitle className="line-clamp-2">{video.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between text-sm text-gray-600">
          <div className="flex items-center">
            <Eye className="h-4 w-4 mr-1" />
            {video.stats.views.toLocaleString()}
          </div>
          <div className="flex items-center">
            <ThumbsUp className="h-4 w-4 mr-1" />
            {video.stats.likes.toLocaleString()}
          </div>
          <div className="flex items-center">
            <MessageSquare className="h-4 w-4 mr-1" />
            {video.stats.comments.toLocaleString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
