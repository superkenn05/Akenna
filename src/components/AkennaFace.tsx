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

  return (
    <div className="flex flex-col items-center justify-center gap-24 relative face-container">
      {/* Eyes Container */}
      <div className="flex gap-24 sm:gap-40 items-center justify-center relative">
        
        {/* Left Eye */}
        <div 
          className={cn(
            "w-24 h-24 sm:w-36 sm:h-36 rounded-full transition-all duration-700 ease-in-out relative overflow-hidden",
            isIdle ? "scale-y-[0.02] opacity-20 blur-[2px] bg-[#33E0FF]" : "animate-eye-blink",
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

        {/* Right Eye */}
        <div 
          className={cn(
            "w-24 h-24 sm:w-36 sm:h-36 rounded-full transition-all duration-700 ease-in-out relative overflow-hidden",
            isIdle ? "scale-y-[0.02] opacity-20 blur-[2px] bg-[#33E0FF]" : "animate-eye-blink",
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
            height: isIdle ? '1px' : `${4 + (volume * 60)}px`,
            width: isIdle ? '40px' : `${60 + (volume * 120)}px`,
            opacity: !isIdle ? 1 : 0.1,
            boxShadow: volume > 0.05 && !isIdle ? `0 0 ${15 + volume * 30}px rgba(51, 224, 255, ${0.5 + volume * 0.5})` : 'none',
            backgroundColor: isError ? 'hsl(var(--destructive))' : '#33E0FF'
          }}
          className={cn(
            "rounded-full transition-all duration-100 ease-out",
            isProcessing && "animate-pulse opacity-40"
          )}
        />
      </div>

      {/* Subtle Mood Background Glow */}
      <div className={cn(
        "absolute -z-10 w-[400px] h-[400px] rounded-full blur-[120px] transition-all duration-1000 opacity-20",
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
