"use client";

import { motion, useReducedMotion } from "framer-motion";
import { LazyLoadImage, type LazyLoadImageProps } from "react-lazy-load-image-component";
import Image from "next/image";
import { useState, useEffect } from "react";
import "react-lazy-load-image-component/src/effects/blur.css";

type Props = LazyLoadImageProps & {
  className?: string; 
  wrapperClassName?: string; 
  imgClassName?: string;
  disableLazyOnMobile?: boolean;
};

export default function LazyRevealImage({
  className,
  wrapperClassName,
  imgClassName = "w-full h-auto",
  disableLazyOnMobile = false,
  ...imgProps
}: Props) {
  const prefersReduced = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // On mobile with disableLazyOnMobile, use regular Image component
  if (disableLazyOnMobile && isMobile && imgProps.src) {
    return (
      <motion.div
        className={className}
        initial={prefersReduced ? false : { opacity: 0, y: 20 }}
        animate={prefersReduced ? {} : { opacity: 1, y: 0 }}
        transition={{ duration: prefersReduced ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, amount: 0 }}
      >
        <div className={wrapperClassName}>
          <Image
            src={imgProps.src as string}
            alt={imgProps.alt || ""}
            width={1920}
            height={1080}
            className={imgClassName}
            priority={isMobile}
            {...(imgProps.sizes ? { sizes: imgProps.sizes } : {})}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={prefersReduced ? false : { opacity: 0, y: 20 }}
      whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true, amount: isMobile ? 0 : 0.2 }}
    >
      <LazyLoadImage
        className={imgClassName}
        wrapperClassName={wrapperClassName}
        effect="blur"
        {...imgProps}
      />
    </motion.div>
  );
}
