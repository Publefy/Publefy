import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Heart, MessageCircle, Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

export function VideoCard({
  video,
  isSelected,
  onToggleSelect,
}: {
  video: {
    id: string;
    caption: string;
    media_url: string;
    permalink: string;
    timestamp: string;
    like_count: number;
    comments_count: number;
    thumbnail_url: string;
  };
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const poster =
    video.thumbnail_url && video.thumbnail_url.trim() !== ''
      ? video.thumbnail_url
      : '/fallback-thumbnail.jpg';

  return (
    <Card
      onClick={() => onToggleSelect(video.id)}
      className={cn(
        'overflow-hidden cursor-pointer relative group border transition-all',
        isSelected && 'ring-2 ring-blue-500'
      )}
      tabIndex={0}
    >
      <CardContent className="p-0">
        <div className="relative w-full aspect-[9/16] bg-black">
          <video
            src={video.media_url}
            controls={false}
            loop
            muted
            autoPlay
            playsInline
            poster={poster}
            className="w-full h-full object-cover"
          />
          {isSelected && (
            <>
              <div className="absolute inset-0 bg-black/40" />
              <CheckCircle2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 text-white" />
            </>
          )}
        </div>
        <div className="p-2 space-y-1 text-sm bg-white">
          <div className="line-clamp-2 font-medium text-gray-800">
            {video.caption || 'No caption'}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Heart className="w-4 h-4" /> {video.like_count}
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4" /> {video.comments_count}
            </div>
            <a
              href={video.permalink}
              target="_blank"
              rel="noopener noreferrer"
              title="View on Instagram"
              className="ml-auto flex items-center gap-1 text-blue-600 hover:underline"
            >
              <Instagram className="w-4 h-4" /> Reel
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


export function VideoCardSkeleton() {
  return (
    <Card className="overflow-hidden border animate-pulse">
      <CardContent className="p-0">
        {/* Video thumbnail area */}
        <div className="relative w-full aspect-[9/16] bg-gray-300 rounded-t-xl" />
        {/* Details area */}
        <div className="p-2 space-y-2 bg-white">
          {/* Caption skeleton: 2 lines */}
          <div className="h-4 w-5/6 bg-gray-300 rounded" />
          <div className="h-4 w-2/3 bg-gray-300 rounded" />
          <div className="flex items-center gap-4 mt-2">
            <div className="h-4 w-10 bg-gray-300 rounded" />
            <div className="h-4 w-10 bg-gray-300 rounded" />
            <div className="flex-1 flex justify-end">
              <div className="h-4 w-8 bg-gray-300 rounded" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

