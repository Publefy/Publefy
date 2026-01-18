"use client";

import Image from "next/image";

export default function UpdatedChip() {
  return (
    <div
      className="
        relative inline-flex items-center rounded-full p-[2px]
        bg-white
      "
    >
      {/* Inner border (F2EFFF) */}
      <div
        className="
          inline-flex items-center gap-2 rounded-full p-[1px]
          bg-[#F2EFFF]
        "
      >
        {/* Fill */}
        <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1">
          <Image
            src="/Sparkle.svg"
            alt="Updated"
            width={16}
            height={16}
            priority
          />
          <span className="font-medium text-[#301B69]">Updated</span>
        </div>
      </div>
    </div>
  );
}
