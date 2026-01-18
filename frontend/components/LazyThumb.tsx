"use client";
import { useEffect, useRef, useState } from "react";

export default function LazyThumb({
  src, 
  alt = "",
  className = "",
}: { src: string; alt?: string; className?: string }) {
  const ref = useRef<HTMLImageElement|null>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setLoad(true); io.disconnect(); }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <img
      ref={ref}
      loading="lazy"
      decoding="async"
      src={load ? src : "data:image/gif;base64,R0lGODlhAQABAAAAACw="}
      alt={alt}
      className={className}
    />
  );
}
