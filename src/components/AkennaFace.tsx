"use client"

import React from 'react';
import { cn } from '@/lib/utils';

interface AkennaFaceProps {
  status: 'idle' | 'listening' | 'processing' | 'speaking';
  isSpeaking: boolean;
  volume: number; // 0 to 1 scale for mouth opening
}

export const AkennaFace: React.FC<AkennaFaceProps> = ({ status, isSpeaking, volume }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-24 relative face-container">
      {/* Eyes Container */}
      <div className="flex gap-32 sm:gap-48 items-center justify-center">
        {/* Left Eye */}
        <div 
          className={cn(
            "w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#33E0FF] glow-cyan transition-all duration-700 ease-out animate-eye-blink",
            status === 'listening' && "animate-pulse-cyan scale-110",
            status === 'processing' && "opacity-50 blur-sm",
            status === 'speaking' && "scale-95 shadow-[#3377FF_0px_0px_30px]"
          )}
        />
        {/* Right Eye */}
        <div 
          className={cn(
            "w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#33E0FF] glow-cyan transition-all duration-700 ease-out animate-eye-blink",
            status === 'listening' && "animate-pulse-cyan scale-110",
            status === 'processing' && "opacity-50 blur-sm",
            status === 'speaking' && "scale-95 shadow-[#3377FF_0px_0px_30px]"
          )}
        />
      </div>

      {/* Mouth */}
      <div className="h-20 flex items-center justify-center overflow-visible">
        <div 
          style={{ 
            height: isSpeaking ? `${Math.max(4, volume * 60)}px` : '4px',
            width: isSpeaking ? `${80 + volume * 40}px` : '60px',
            opacity: isSpeaking || status === 'listening' ? 1 : 0.2
          }}
          className={cn(
            "bg-[#33E0FF] rounded-full transition-all duration-75 ease-out glow-cyan",
            !isSpeaking && "w-16 h-1 opacity-20"
          )}
        />
      </div>

      {/* Status Text - Subtle */}
      <div className="absolute -bottom-32 text-[#3377FF] font-headline tracking-[0.3em] uppercase text-xs font-light opacity-40 animate-pulse">
        {status === 'listening' && 'Awaiting Input'}
        {status === 'processing' && 'Reasoning...'}
        {status === 'speaking' && 'Speaking'}
        {status === 'idle' && 'Akenna AI'}
      </div>
    </div>
  );
};
