"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import React from "react";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
}

function Avatar({ className, src, alt = "User avatar", fallback, ...props }: AvatarProps) {
  if (src) {
    return (
      <div
        className={cn(
          "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 text-sm font-medium text-white shadow-md shadow-black/10",
          className
        )}
        {...props}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 text-sm font-medium text-white shadow-md shadow-black/10",
        className
      )}
      {...props}
    >
      {fallback ? fallback : (alt ? alt.slice(0, 2).toUpperCase() : "U")}
    </div>
  );
}

export { Avatar };