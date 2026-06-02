"use client"

import React from 'react';
import { cn } from '@/lib/utils';

interface AkennaFaceProps {
  status: 'idle' | 'listening' | 'processing' | 'speaking';
  isSpeaking: boolean;
  volume: number; // 0 to 1 scale for mouth opening
}

export const AkennaFace: React.FC<AkennaFaceProps> = ({ status, isSpeaking, volume }) => {
  const isIdle = status === 'idle';

  return (
    <div className="flex flex-col items-center justify-center gap-24 relative face-container">
      {/* Eyes Container */}
      <div className="flex gap-24 sm:gap-40 items-center justify-center">
        {/* Left Eye */}
        <div 
          className={cn(
            "w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-[#33E0FF] glow-cyan transition-all duration-1000 ease-in-out",
            isIdle ? "scale-y-[0.02] opacity-20 blur-[2px]" : "animate-eye-blink",
            status === 'listening' && "animate-pulse-cyan scale-110",
            status === 'processing' && "opacity-50 blur-sm",
            status === 'speaking' && "scale-95 shadow-[#3377FF_0px_0px_50px]"
          )}
        />
        {/* Right Eye */}
        <div 
          className={cn(
            "w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-[#33E0FF] glow-cyan transition-all duration-1000 ease-in-out",
            isIdle ? "scale-y-[0.02] opacity-20 blur-[2px]" : "animate-eye-blink",
            status === 'listening' && "animate-pulse-cyan scale-110",
            status === 'processing' && "opacity-50 blur-sm",
            status === 'speaking' && "scale-95 shadow-[#3377FF_0px_0px_50px]"
          )}
        />
      </div>

      {/* Mouth */}
      <div className="h-20 flex items-center justify-center overflow-visible">
        <div 
          style={{ 
            height: isIdle ? '1px' : `${4 + (volume * 50)}px`,
            width: isIdle ? '40px' : `${60 + (volume * 100)}px`,
            opacity: !isIdle ? 1 : 0.1,
            boxShadow: volume > 0.1 && !isIdle ? `0 0 ${10 + volume * 20}px rgba(51, 224, 255, ${0.4 + volume * 0.6})` : 'none'
          }}
          className={cn(
            "bg-[#33E0FF] rounded-full transition-all duration-150 ease-out"
          )}
        />
      </div>

      {/* Status Text - Subtle */}
      <div className="absolute -bottom-32 text-[#3377FF] font-headline tracking-[0.3em] uppercase text-xs font-light opacity-40 animate-pulse">
        {status === 'listening' && 'Awaiting Input'}
        {status === 'processing' && 'Reasoning...'}
        {status === 'speaking' && 'Speaking'}
        {status === 'idle' && 'System Offline'}
      </div>
    </div>
  );
};
