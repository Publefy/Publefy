"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";
import { apiServiceDefault } from "@/services/api/api-service";
import { AnalyzeResult } from "@/types/analyze-result";
import { FinalizeResult } from "@/types/finalize-result";
import { axiosConfig, VIDEO_ANALYZE_URL } from "@/services/api/apiConfig";
import { Profile } from "@/types/profile";
import type { AxiosProgressEvent } from "axios"; 
import { getAuthToken } from "@/utils/getAuthToken";

interface VideoProcessorProps {
  open: boolean;
  profile: Profile | null;
  onOpenChange: (open: boolean) => void;
  onVideoGenerated: (videoUrl: string) => void;
}

export function VideoProcessor({
  open,
  onOpenChange,
  profile,
  onVideoGenerated,
}: VideoProcessorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("Upload your video");
  const [fileSize, setFileSize] = useState("");
  const [industry, setIndustry] = useState("Fitness");
  const [selectedMemeOption, setSelectedMemeOption] = useState<string | null>(null);
  const [videoSummary, setVideoSummary] = useState("");
  const [memeOptions, setMemeOptions] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false); 
  const token = getAuthToken();
  // Real progress state
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [generateProgress, setGenerateProgress] = useState(0);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setFileSize(`${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`);
    }
  };

  const handleAnalyze = async () => {
    if (!file || !industry) {
      alert("Upload a file and enter an industry.");
      return;
    }
    setAnalyzing(true);
    setAnalyzeProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("industry", industry);

    try {
      // @ts-ignore
      const analyzeResult = await apiServiceDefault.post<AnalyzeResult>(
        VIDEO_ANALYZE_URL,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent: AxiosProgressEvent) => {
            if (progressEvent.total) {
              setAnalyzeProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
            }
          }
        }
      );
      setVideoSummary(
        `**Video:** ${analyzeResult.video_summary}\n\n**Audio:** ${analyzeResult.audio_summary}`
      );
      setMemeOptions(analyzeResult.meme_options);
      setAnalyzeProgress(100);
      setTimeout(() => setAnalyzing(false), 500);
      setTimeout(() => setAnalyzeProgress(0), 1000);
    } catch (err: any) {
      setAnalyzeProgress(100);
      setTimeout(() => setAnalyzing(false), 600);
      setTimeout(() => setAnalyzeProgress(0), 1000);
      alert("Analyze failed: " + err.message);
    }
  };

  const handleFinalize = async () => {
    if (!file || !selectedMemeOption) {
      alert("Select a meme and upload a video.");
      return;
    }
    setGenerating(true);
    setGenerateProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("caption", selectedMemeOption);
    formData.append("summary", videoSummary);
    if (profile === null) {
      alert("Please select a profile.");
      setGenerating(false);
      setGenerateProgress(0);
      return;
    }
    formData.append("profile_id", profile.id);

    try {
      // @ts-ignore
      let finalizeResult = await apiServiceDefault.post<FinalizeResult>(
        "video/finalize/",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data","Authorization": `Bearer ${token}`, }, 
          onUploadProgress: (progressEvent: AxiosProgressEvent) => {
            if (progressEvent.total) {
              setGenerateProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
            }
          }
        }
      );
      setGenerateProgress(100);
      setTimeout(() => setGenerating(false), 500);
      setTimeout(() => setGenerateProgress(0), 1000);

      if (finalizeResult.download_url) {
        const fullUrl = finalizeResult.download_url.startsWith("http")
          ? finalizeResult.download_url
          : `${axiosConfig.baseURL}${finalizeResult.download_url}`;
        onVideoGenerated(fullUrl);
        onOpenChange(false);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err: any) {
      setGenerateProgress(100);
      setTimeout(() => setGenerating(false), 600);
      setTimeout(() => setGenerateProgress(0), 1000);
      alert("Finalize failed: " + err.message);
    }
  };

  const isAnalyzeSuccessful = videoSummary.length > 0 && memeOptions.length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-[600px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Video Processor</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          <p className="text-gray-500 mb-6">
            Upload a video and select your industry to process
          </p>
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">
                Upload Video (Max 50 MB)
              </Label>
              <div className="mt-2">
                <div className="flex items-center justify-between border rounded-md p-2">
                  <span className="truncate">{fileName}</span>
                  <Button variant="outline" size="sm" asChild>
                    <Label htmlFor="video-upload" className="cursor-pointer">
                      Choose File
                    </Label>
                  </Button>
                  <Input
                    id="video-upload"
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  File size: {fileSize}
                </p>
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Enter Industry</Label>
              <Input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="mt-2 bg-blue-50"
                placeholder="Enter industry"
              />
            </div>

            {videoSummary && (
              <div>
                <Label className="text-base font-medium">Summary</Label>
                <div className="mt-2 p-4 bg-gray-50 rounded-md">
                  <p className="text-sm whitespace-pre-line">{videoSummary}</p>
                </div>
              </div>
            )}

            {memeOptions.length > 0 && (
              <div>
                <Label className="text-base font-medium mb-3 block">
                  Funny Meme Options
                </Label>
                <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2">
                  {memeOptions.map((option, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className={`justify-start h-auto py-2 px-3 text-left ${
                        selectedMemeOption === option
                          ? "border-blue-500 bg-blue-50"
                          : ""
                      }`}
                      onClick={() => setSelectedMemeOption(option)}
                    >
                      <div className="flex items-center gap-2">
                        {selectedMemeOption === option && (
                          <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        )}
                        <span
                          className={`text-sm ${
                            selectedMemeOption === option ? "text-blue-700" : ""
                          }`}
                        >
                          {option}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BUTTONS WITH REAL PROGRESS */}
        <div className="p-4 border-t flex gap-2">
          {/* Analyze Button */}
          <div className="relative w-1/2">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white relative overflow-hidden"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? `Analyzing... ${analyzeProgress}%` : "Analyze"}
              {analyzing && (
                <span
                  className="absolute left-0 top-0 h-full bg-blue-300/70 pointer-events-none z-10"
                  style={{
                    width: `${analyzeProgress}%`,
                    transition: "width 0.2s linear"
                  }}
                />
              )}
            </Button>
          </div>

          {/* Generate Button */}
          <div className="relative w-1/2">
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white relative overflow-hidden"
              onClick={handleFinalize}
              disabled={!selectedMemeOption || !isAnalyzeSuccessful || generating}
            >
              {generating ? `Processing... ${generateProgress}%` : "Generate Post"}
              {generating && (
                <span
                  className="absolute left-0 top-0 h-full bg-green-400/70 pointer-events-none z-10"
                  style={{
                    width: `${generateProgress}%`,
                    transition: "width 0.2s linear"
                  }}
                />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
 
