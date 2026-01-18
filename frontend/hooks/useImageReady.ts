"use client";

import { useEffect, useState } from "react";

export function useImageReady(src: string | undefined) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!src) {
      setReady(true);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.src = src;

    if ((img as any).complete) {
      (img.decode?.() ?? Promise.resolve())
        .catch(() => {})
        .finally(() => !cancelled && setReady(true));
      return;
    }

    const onLoad = () => {
      (img.decode?.() ?? Promise.resolve())
        .catch(() => {})
        .finally(() => !cancelled && setReady(true));
    };
    const onError = () => !cancelled && setReady(true); // don't block forever on errors

    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);

    return () => {
      cancelled = true;
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
    };
  }, [src]);

  return ready;
}