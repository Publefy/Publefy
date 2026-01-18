'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { VideoCard, VideoCardSkeleton } from '@/components/video-card';
import { useToast } from '@/components/ui/use-toast';
import { UploadCloud, Search } from 'lucide-react';
import { Video } from '@/types/types';
import { apiServiceDefault } from '@/services/api/api-service';


async function getVideoThumbnail(videoUrl: string, seekTo = 0.5): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.currentTime = seekTo;
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      video.currentTime = seekTo;
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = new Image();
      img.src = canvas.toDataURL();
      img.width = 90;
      img.height = 90;
      resolve(img);
    };
    video.onerror = () => reject('Could not load video');
  });
}

export function ReelSelectorModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [hashtagInput, setHashtagInput] = useState('funny');
  const [searchQuery, setSearchQuery] = useState('funny');

  // Fetch videos by hashtag
  const fetchVideos = useCallback(async () => {
    if (!searchQuery) return;
    setIsLoading(true);
    setVideos([]);
    setSelectedVideos(new Set());

    try {
      // Always use your real endpoint
      const data = await apiServiceDefault.get<{ reels: any[] }>(
        `/instagram/reels/hashtag-api/${encodeURIComponent(searchQuery)}`
      );

      // Format for VideoCard
      const formattedVideos: Video[] = (data.reels || []).map((video, index) => ({
        id: video.id || `reel-${index}`,
        reel_id: video.reel_id || video.id || `reel-${index}`,
        caption: video.caption ?? '',
        media_type: video.media_type ?? 'VIDEO',
        media_url: video.media_url || video.video_url || '',
        permalink: video.permalink ?? '',
        timestamp: video.timestamp ?? '',
        like_count: video.like_count ?? 0,
        comments_count: video.comments_count ?? 0,
        hashtags: Array.isArray(video.hashtags) ? video.hashtags : [],
        thumbnail_url: video.thumbnail_url ?? '',
        filename: video.filename ?? `video-${index}.mp4`,
      }));




      setVideos(formattedVideos);

      if (formattedVideos.length === 0) {
        toast({
          title: 'No results',
          description: `No videos found for #${searchQuery}.`,
        });
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast({
        title: 'Error',
        description: 'Could not fetch Instagram reels.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, toast]);

  useEffect(() => {
    if (isOpen) fetchVideos();
  }, [isOpen, fetchVideos]);

  const handleSearch = () => {
    setSearchQuery(hashtagInput.trim().toLowerCase());
  };

  const toggleSelection = (videoId: string) => {
    setSelectedVideos((prev) => {
      const newSelection = new Set(prev);
      newSelection.has(videoId) ? newSelection.delete(videoId) : newSelection.add(videoId);
      return newSelection;
    });
  };

  const handleSubmit = async () => {
    if (selectedVideos.size === 0) {
      toast({
        title: 'No videos selected',
        description: 'Please select at least one video to submit.',
      });
      return;
    }
    setIsSubmitting(true);

    try {
      const selected = videos.filter((v) => selectedVideos.has(v.id));
      let allSuccess = true;
      let errorCount = 0;

      for (const video of selected) {
        try {
          await apiServiceDefault.post(
            '/instagram/upload-reel',
            {
              media_url: video.media_url,
              reel_id: video.id,
            }
          );
        } catch (err: any) {
          allSuccess = false;
          errorCount += 1;
          let errMsg = (err?.response?.data?.error as string) || err.message || `Could not upload video with id ${video.id}.`;
          toast({
            title: 'Error',
            description: errMsg,
            variant: 'destructive',
          });
        }
      }

      if (allSuccess) {
        toast({
          title: 'Success!',
          description: `${selectedVideos.size} video(s) uploaded to cloud storage.`,
          className: 'bg-green-100 text-green-800',
        });
        setIsOpen(false);
      } else {
        toast({
          title: 'Some uploads failed',
          description: `${errorCount} of ${selectedVideos.size} failed. See errors above.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Unexpected error while uploading videos. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };



  const handleDragStart = async (e: React.DragEvent, video: Video) => {
    e.dataTransfer.setData('application/json', JSON.stringify(video));
    e.dataTransfer.effectAllowed = 'copy';
    try {
      const thumb = await getVideoThumbnail(video.media_url);
      e.dataTransfer.setDragImage(thumb, thumb.width / 2, thumb.height / 2);
    } catch {
      // fallback
    }
    document.body.classList.add('dragging');
  };
  const handleDragEnd = () => {
    document.body.classList.remove('dragging');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <UploadCloud className="mr-2 h-4 w-4" />
          Review Reels
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[80vw] md:max-w-[70vw] lg:max-w-[60vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Reels for Generation</DialogTitle>
          <DialogDescription>
            Type a hashtag to search, then click on videos to select them.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex items-center space-x-2"
        >
          <div className="relative flex-grow">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">#</span>
            <Input
              placeholder="e.g. tech, gaming, news"
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              className="pl-6"
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </form>
        <div className="flex-grow overflow-y-auto pr-2 -mr-4 mt-4">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-8 gap-4 p-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          ) : videos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-8  gap-4 p-1">
              {videos.map((video) => (
                <div
                  key={video.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, video)}
                  onDragEnd={handleDragEnd}
                >
                  <VideoCard
                    video={{
                      id: video.id ?? '',
                      caption: video.caption ?? '',
                      media_url: video.media_url ?? '',
                      permalink: video.permalink ?? '',
                      timestamp: video.timestamp ?? '',
                      like_count: video.like_count ?? 0,
                      comments_count: video.comments_count ?? 0,
                      thumbnail_url: video.thumbnail_url ?? '',
                    }}
                    isSelected={selectedVideos.has(video.id)}
                    onToggleSelect={() => toggleSelection(video.id)}
                  />

                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <h2 className="text-xl font-semibold text-gray-700">No Videos Found</h2>
              <p className="mt-2 text-gray-500">Try searching for a different hashtag.</p>
            </div>
          )}
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedVideos.size === 0}>
            {isSubmitting ? 'Submitting...' : `Submit ${selectedVideos.size} Video(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
