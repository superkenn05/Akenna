"use client"

import React from 'react';
import { cn } from '@/lib/utils';

interface AkennaFaceProps {
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
  isSpeaking: boolean;
  volume: number; // 0 to 1 scale for mouth opening
}

export const AkennaFace: React.FC<AkennaFaceProps> = ({ status, isSpeaking, volume }) => {
  const isIdle = status === 'idle';
  const isError = status === 'error';
  const isProcessing = status === 'processing';
  const isListening = status === 'listening';

  const faceExpressionClass = status === 'speaking' ? 'animate-face-speak' : status === 'processing' ? 'animate-face-process' : '';

  return (
    <div className={cn("flex flex-col items-center justify-center gap-24 relative face-container", faceExpressionClass)}>
      {/* Eyes Container */}
      <div className="flex gap-24 sm:gap-40 items-center justify-center relative animate-eyes-blink">
        
        {/* Left Eye */}
        <div 
          className={cn(
            "eye-blink-target w-28 h-28 sm:w-44 sm:h-44 rounded-full transition-all duration-700 ease-in-out relative overflow-hidden",
            isIdle ? "scale-y-[0.02] opacity-20 blur-[2px] bg-[#33E0FF]" : undefined,
            isListening && "bg-[#33E0FF] glow-cyan scale-110",
            isProcessing && "bg-[#33E0FF]/60 blur-[1px] scale-95",
            status === 'speaking' && "bg-[#3377FF] scale-105 shadow-[0_0_40px_rgba(51,119,255,0.6)] animate-eyes-spark",
            isError && "bg-destructive glow-destructive scale-90 animate-pulse"
          )}
        >
          {/* Scanning Effect during Processing */}
          {isProcessing && (
            <div className="absolute inset-0 bg-white/20 animate-scan-horizontal" />
          )}
        </div>

        {/* Right Eye */}
        <div 
          className={cn(
            "eye-blink-target w-28 h-28 sm:w-44 sm:h-44 rounded-full transition-all duration-700 ease-in-out relative overflow-hidden",
            isIdle ? "scale-y-[0.02] opacity-20 blur-[2px] bg-[#33E0FF]" : undefined,
            isListening && "bg-[#33E0FF] glow-cyan scale-110",
            isProcessing && "bg-[#33E0FF]/60 blur-[1px] scale-95",
            status === 'speaking' && "bg-[#3377FF] scale-100 shadow-[0_0_40px_rgba(51,119,255,0.6)]",
            isError && "bg-destructive glow-destructive scale-90 animate-pulse"
          )}
        >
          {/* Scanning Effect during Processing */}
          {isProcessing && (
            <div className="absolute inset-0 bg-white/20 animate-scan-horizontal" />
          )}
        </div>
      </div>

      {/* Mouth - Reconstructed for fluid movement */}
      <div className="h-24 flex items-center justify-center overflow-visible">
        <div 
          style={{ 
            height: status === 'speaking' ? `${5 + (volume * 50)}px` : '1px',
            width: status === 'speaking' ? `${65 + (volume * 90)}px` : '40px',
            opacity: status === 'speaking' ? 1 : 0.1,
            boxShadow: status === 'speaking' && volume > 0.03 ? `0 0 ${12 + volume * 24}px rgba(51, 224, 255, ${0.65 + volume * 0.35})` : 'none',
            backgroundColor: isError ? 'hsl(var(--destructive))' : '#33E0FF',
            transformOrigin: 'center center'
          }}
          className={cn(
            "rounded-full transition-all duration-35 ease-out",
            status === 'speaking' && "animate-mouth-speak",
            isProcessing && "animate-pulse opacity-40"
          )}
        />
      </div>

      {/* Subtle Mood Background Glow */}
      <div className={cn(
        "absolute -z-10 w-[360px] h-[260px] rounded-[2rem] blur-[120px] transition-all duration-1000 opacity-20",
        isListening && "bg-cyan-500",
        isProcessing && "bg-blue-400",
        status === 'speaking' && "bg-blue-600",
        isError && "bg-destructive"
      )} />

      {/* Status Text */}
      <div className={cn(
        "absolute -bottom-32 font-headline tracking-[0.4em] uppercase text-[10px] font-bold transition-all duration-500",
        isError ? "text-destructive opacity-100" : "text-[#3377FF] opacity-40"
      )}>
        {status === 'listening' && 'Core Intake Active'}
        {status === 'processing' && 'Neural Processing'}
        {status === 'speaking' && 'Transmission'}
        {status === 'error' && 'System Instability'}
        {status === 'idle' && 'Deep Sleep'}
      </div>
    </div>
  );
};
