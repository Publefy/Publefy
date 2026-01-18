"use client"

import { useEffect, useState } from "react"

export function useMediaQuery(query: string): boolean {
  const getMatches = () =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false

  const [matches, setMatches] = useState<boolean>(getMatches)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)

    const listener = () => setMatches(media.matches)
    media.addEventListener("change", listener)

    return () => media.removeEventListener("change", listener)
  }, [query])

  return matches
}
