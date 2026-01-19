"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { X, Zap, Calendar, Check, Loader2, Upload } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

import type { Profile } from "@/types/profile";
import type { AnalyzeResult } from "@/types/analyze-result";
import type { FinalizeResult } from "@/types/finalize-result";
import type { AxiosProgressEvent } from "axios";

import { apiServiceDefault } from "@/services/api/api-service";
import { axiosConfig, VIDEO_ANALYZE_URL } from "@/services/api/apiConfig";
import { getAuthToken } from "@/utils/getAuthToken";

/* -------------------- URL/auth helpers -------------------- */
// Same as in VideoProcessorModal for consistency
function unwrap<T>(res: any): T {
    return (res?.data ?? res) as T;
}

const LOGIN_DEST = "/?auth=login";

export function VideoUploadModal({
    open,
    profile,
    onOpenChange,
    onVideoGenerated,
}: {
    open: boolean;
    profile: Profile | null;
    onOpenChange: (open: boolean) => void;
    onVideoGenerated: (videoUrl: string) => void;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState("Upload your video");
    const [fileSize, setFileSize] = useState("");
    const [industry, setIndustry] = useState("Fitness");
    const [selectedMemeOption, setSelectedMemeOption] = useState<string | null>(null);
    const [videoSummary, setVideoSummary] = useState("");
    const [memeOptions, setMemeOptions] = useState<string[]>([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [analyzeProgress, setAnalyzeProgress] = useState(0);
    const [generateProgress, setGenerateProgress] = useState(0);
    const [scheduling, setScheduling] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement | null>(null);
    const router = useRouter();
    const { toast } = useToast();
    const prefersReducedMotion = useReducedMotion();

    const emitVideosUpdated = useCallback((igId?: string | number) => {
        try {
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("videos:updated", { detail: { igId: igId ? String(igId) : undefined } })
                );
            }
        } catch { }
    }, []);

    const requireAuth = (actionLabel: string) => {
        const tok = getAuthToken();
        if (!tok) {
            toast({
                title: "Sign in required",
                description: `Please log in to ${actionLabel}.`,
                variant: "destructive",
            });
            onOpenChange(false);
            router.push(LOGIN_DEST);
            return false;
        }
        return true;
    };

    const handleFilePickerClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            if (f.size > 50 * 1024 * 1024) {
                toast({
                    title: "File too large",
                    description: "Please select a video smaller than 50 MB.",
                    variant: "destructive",
                });
                return;
            }
            setFile(f);
            setFileName(f.name);
            setFileSize(`${(f.size / (1024 * 1024)).toFixed(1)} MB`);
            // Reset analysis results when new file is selected
            setVideoSummary("");
            setMemeOptions([]);
            setSelectedMemeOption(null);
        }
    };

    const handleAnalyze = async () => {
        if (!file || !industry) {
            toast({
                title: "Incomplete",
                description: "Please select a video file and enter an industry.",
                variant: "destructive",
            });
            return;
        }

        setAnalyzing(true);
        setAnalyzeProgress(0);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("industry", industry);

        try {
            const raw = await apiServiceDefault.postLong<AnalyzeResult>(VIDEO_ANALYZE_URL, formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (pe: AxiosProgressEvent) => {
                    if (pe.total) setAnalyzeProgress(Math.round((pe.loaded / pe.total) * 100));
                },
            });

            const analyze = unwrap<AnalyzeResult>(raw);
            const vs = analyze?.video_summary ?? "";
            const as = analyze?.audio_summary ?? "";
            const options = Array.isArray(analyze?.meme_options) ? analyze.meme_options : [];

            setVideoSummary(`**Video:** ${vs}\n\n**Audio:** ${as}`);
            setMemeOptions(options);
            setSelectedMemeOption(null);
            setAnalyzeProgress(100);
            toast({ title: "Success", description: "Video analyzed." });

            setTimeout(() => setAnalyzing(false), 400);
            setTimeout(() => setAnalyzeProgress(0), 800);
        } catch (err: any) {
            setAnalyzeProgress(100);
            setTimeout(() => setAnalyzing(false), 600);
            setTimeout(() => setAnalyzeProgress(0), 1000);
            
            // Check for insufficient points
            if (err?.response?.data?.error === "insufficient_points" || err?.response?.data?.message?.includes("don't have enough points")) {
                toast({ 
                    title: "Not Enough Points", 
                    description: err?.response?.data?.message || "You don't have enough points to analyze this video. Please upgrade your plan to get more points.",
                    variant: "default"
                });
            } else {
                toast({ title: "Analyze failed", description: err?.message || "Error", variant: "destructive" });
            }
        }
    };

    const handleFinalize = async () => {
        if (!requireAuth("generate a post")) return;
        if (!selectedMemeOption || !file) {
            toast({
                title: "Analyze first",
                description: "Run Analyze and pick a meme option to enable Generate Post.",
                variant: "destructive",
            });
            return;
        }

        setGenerating(true);
        setGenerateProgress(0);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("caption", selectedMemeOption);
        formData.append("summary", videoSummary);

        if (profile?.id) {
            formData.append("profile_id", profile.id);
        }
        if (profile?.ig_id) {
            formData.append("ig_id", profile.ig_id);
        }

        try {
            const raw = await apiServiceDefault.postLong<FinalizeResult>("video/finalize/", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (pe: AxiosProgressEvent) => {
                    if (pe.total) setGenerateProgress(Math.round((pe.loaded / pe.total) * 100));
                },
            });

            const finalizeResult = unwrap<FinalizeResult>(raw);

            setGenerateProgress(100);
            setTimeout(() => setGenerating(false), 500);
            setTimeout(() => setGenerateProgress(0), 1000);

            const fullUrl = finalizeResult?.final_video_url
                ? finalizeResult.final_video_url
                : (finalizeResult?.download_url
                    ? (finalizeResult.download_url.startsWith("http")
                        ? finalizeResult.download_url
                        : `${axiosConfig.baseURL}${finalizeResult.download_url}`)
                    : null);

            if (fullUrl) {
                onVideoGenerated(fullUrl);
                emitVideosUpdated(profile?.ig_id || profile?.id);
                onOpenChange(false);
                toast({ title: "Post Generated!", description: "Your video has been added to the library." });
            } else {
                throw new Error("Missing download URL from response.");
            }
        } catch (err: any) {
            setGenerateProgress(100);
            setTimeout(() => setGenerating(false), 600);
            setTimeout(() => setGenerateProgress(0), 1000);
            toast({
                title: "Finalize failed",
                description: err?.response?.data?.error || err.message || "Something went wrong.",
                variant: "destructive",
            });
        }
    };

    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    if (!open) return null;

    const isAnalyzeSuccessful = videoSummary.length > 0 && memeOptions.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-[600px] p-0 max-h-[85vh] flex flex-col overflow-hidden bg-white">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-2xl font-bold text-[#301B69]">Upload Video</DialogTitle>
                    <DialogDescription className="text-[#5A5192]">
                        Upload your own video and process it with AI.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 pt-2 flex-1 overflow-y-auto space-y-6">
                    {/* File Selection Section */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold text-[#301B69]">Video File</Label>
                        <div
                            className={cn(
                                "group relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300",
                                file ? "border-[#7C7EF4] bg-[#7C7EF4]/5" : "border-[#E2E2E2] hover:border-[#7C7EF4] bg-gray-50/50"
                            )}
                        >
                            <div className="p-8 flex flex-col items-center justify-center text-center">
                                <div className={cn(
                                    "mb-4 rounded-full p-4 transition-all duration-300",
                                    file ? "bg-[#7C7EF4] text-white" : "bg-white text-[#7C7EF4] shadow-sm"
                                )}>
                                    <Upload className="h-8 w-8" />
                                </div>
                                {file ? (
                                    <div className="space-y-1">
                                        <p className="font-bold text-[#301B69] truncate max-w-[400px] text-lg">{fileName}</p>
                                        <p className="font-medium text-[#7C7EF4]">{fileSize}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <p className="font-bold text-[#301B69] text-lg">Choose a video or drag it here</p>
                                        <p className="text-[#5A5192]">MP4, MOV, or WEBM (Max 50MB)</p>
                                    </div>
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleFilePickerClick}
                                    className="mt-6 rounded-full px-8 font-semibold border-[#7C7EF4] text-[#7C7EF4] hover:bg-[#7C7EF4] hover:text-white transition-all"
                                >
                                    {file ? "Change Video" : "Select Video"}
                                </Button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="video/*"
                                    className="hidden"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Industry Selection */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold text-[#301B69]">Your Industry / Niche</Label>
                        <div className="relative group">
                            <Input
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                placeholder="e.g. Fitness, Real Estate, Cooking..."
                                className="h-12 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-[#7C7EF4] transition-all text-lg pl-4 pr-10"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7C7EF4]">
                                <Zap className="h-5 w-5" />
                            </div>
                        </div>
                    </div>

                    {/* AI Results Section */}
                    {isAnalyzeSuccessful && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-4 rounded-2xl bg-[#7C7EF4]/5 border border-[#7C7EF4]/10">
                                <Label className="text-sm font-bold text-[#7C7EF4] uppercase tracking-wider block mb-2">AI Analysis</Label>
                                <p className="text-[#301B69] whitespace-pre-line text-sm leading-relaxed">{videoSummary}</p>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-base font-semibold text-[#301B69]">Suggested Captions</Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {memeOptions.map((opt, i) => (
                                        <button
                                            type="button"
                                            key={i}
                                            onClick={() => setSelectedMemeOption(opt)}
                                            className={cn(
                                                "w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start gap-3",
                                                selectedMemeOption === opt
                                                    ? "bg-[#7C7EF4] border-[#7C7EF4] text-white shadow-lg shadow-[#7C7EF4]/20"
                                                    : "bg-white border-gray-100 hover:border-[#7C7EF4] text-[#301B69] hover:bg-[#7C7EF4]/5"
                                            )}
                                        >
                                            <div className={cn(
                                                "mt-1 rounded-full p-1 border flex-shrink-0 transition-colors",
                                                selectedMemeOption === opt ? "bg-white/20 border-white" : "bg-gray-50 border-gray-200"
                                            )}>
                                                {selectedMemeOption === opt ? <Check className="h-3 w-3" /> : <div className="h-3 w-3" />}
                                            </div>
                                            <span className="font-medium">{opt}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-4 border-t bg-gray-50/50 flex-col sm:flex-row gap-3">
                    {!isAnalyzeSuccessful ? (
                        <Button
                            type="button"
                            onClick={handleAnalyze}
                            disabled={!file || !industry || analyzing}
                            className={cn(
                                "w-full rounded-xl h-14 text-lg font-bold shadow-lg transition-all",
                                "bg-[#7C7EF4] hover:bg-[#6A6CD9] text-white",
                                "disabled:opacity-50 disabled:grayscale"
                            )}
                        >
                            {analyzing ? (
                                <>
                                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                    Analyzing {analyzeProgress}%
                                </>
                            ) : (
                                <>
                                    <Zap className="mr-2 h-6 w-6" />
                                    Analyze Video
                                </>
                            )}
                        </Button>
                    ) : (
                        <div className="flex w-full gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setVideoSummary("");
                                    setMemeOptions([]);
                                }}
                                className="flex-1 rounded-xl h-14 font-bold border-gray-200 text-[#5A5192] hover:bg-white"
                            >
                                Reset
                            </Button>
                            <Button
                                type="button"
                                onClick={handleFinalize}
                                disabled={!selectedMemeOption || generating}
                                className={cn(
                                    "flex-[2] rounded-xl h-14 text-lg font-bold shadow-lg transition-all",
                                    "bg-gradient-to-r from-[#7C7EF4] to-[#AEB0FF] text-white",
                                    "disabled:opacity-50"
                                )}
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                        Processing {generateProgress}%
                                    </>
                                ) : (
                                    <>
                                        <Check className="mr-2 h-6 w-6" />
                                        Add to Library
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
