"use client";

import Image from "next/image";

export default function HeroBadge() {
  return (
    <div
      className="
        flex flex-row items-center
        pl-1 pr-4 py-2 gap-2
        rounded-[24px]  
        border-[2px] border-white
      "
    >
      {/* LEFT CHIP */}
      <div
        className="
          flex flex-row justify-center items-center
          h-7 w-[100px]
          rounded-[44px]
          bg-white
          
          px-2.5 py-1 gap-1.5
        "
      >
        <Image
          src="/Sparkle.svg"
          alt="Sparkle"
          width={16}
          height={16}
          priority
        />
        <span className="
        font-inter
        font-medium
        text-[14px]
        leading-[140%]
        tracking-normal 
        text-center
        text-[rgba(48,27,105,0.76)]">
          Updated
        </span>
      </div>

      {/* RIGHT LABEL */}
      <span className=" 
      text-[#301B69]   
      font-inter
      font-medium
      text-[14px]
      leading-[140%]
      tracking-normal
      text-center
    "
    >
        AI-Powered Content Creation
      </span>
    </div>
  );
}
