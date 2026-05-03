"use client"
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const G = "bg-zinc-200 dark:bg-zinc-700";

export function VideoCardSkeleton() {
  return (
    <div className="overflow-hidden border border-border/50 bg-card shadow-sm rounded-2xl">
      <div className="flex flex-col sm:flex-row">

        {/* Thumbnail */}
        <div className="w-full sm:w-52 lg:w-60 h-44 sm:h-auto bg-zinc-100 dark:bg-zinc-800 relative flex-shrink-0 border-b sm:border-b-0 sm:border-r border-border/40 overflow-hidden">
          <Skeleton className={`w-full h-full rounded-none ${G}`} />
          <div className="absolute bottom-2 right-2">
            <Skeleton className={`h-5 w-12 rounded-md ${G}`} />
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3 min-w-0">

          {/* Title + uploader */}
          <div className="flex flex-col gap-1.5">
            <Skeleton className={`h-4 w-[90%] rounded-lg ${G}`} />
            <Skeleton className={`h-4 w-[65%] rounded-lg ${G}`} />
            <Skeleton className={`h-3.5 w-32 rounded-md mt-0.5 ${G}`} />
          </div>

          {/* Metadata row: views · date · details */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Skeleton className={`h-3 w-3 rounded-full ${G}`} />
              <Skeleton className={`h-3 w-16 rounded-md ${G}`} />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className={`h-3 w-3 rounded-full ${G}`} />
              <Skeleton className={`h-3 w-20 rounded-md ${G}`} />
            </div>
            <Skeleton className={`h-3 w-12 rounded-md ${G}`} />
          </div>

          {/* Format select + action buttons */}
          <div className="flex flex-col xs:flex-row xs:items-center gap-2 mt-auto pt-1">
            <Skeleton className={`h-10 w-full xs:w-auto xs:flex-1 sm:max-w-[220px] rounded-xl ${G}`} />
            <div className="flex items-center gap-1.5 shrink-0">
              <Skeleton className={`h-10 w-10 rounded-xl ${G}`} />
              <Skeleton className={`h-10 w-10 rounded-xl ${G}`} />
              <Skeleton className={`h-10 w-16 rounded-xl ${G}`} />
              <Skeleton className={`h-10 w-20 rounded-xl ${G}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
