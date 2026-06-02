
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AkennaFace } from '@/components/AkennaFace';
import { akennaAIChatInteraction } from '@/ai/flows/akenna-ai-chat-interaction';
import { Button } from '@/components/ui/button';
import { MicOff, Power, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AkennaPage() {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [isInitialized, setIsInitialized] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const startMicAnalysis = useCallback(async () => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
      
      if (!micStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
      }
      
      if (!micAnalyserRef.current && audioContextRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(micStreamRef.current);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        micSourceNodeRef.current = source;
        micAnalyserRef.current = analyser;
      }

      const updateMicVolume = () => {
        if (micAnalyserRef.current && status === 'listening') {
          const bufferLength = micAnalyserRef.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          micAnalyserRef.current.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          setVolume(average / 128);
          animationFrameRef.current = requestAnimationFrame(updateMicVolume);
        } else if (status !== 'speaking') {
          setVolume(0);
        }
      };
      
      if (status === 'listening') {
        updateMicVolume();
      }
    } catch (err) {
      // Silent fail for mic analysis to avoid UI jitter
    }
  }, [status]);

  const initSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setStatus('listening');
      };

      recognition.onresult = async (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        if (transcript) {
          handleAkennaQuery(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        if (event.error === 'not-allowed') {
          setError("Microphone access denied.");
          setIsInitialized(false);
        }
      };

      recognition.onend = () => {
        if (isInitialized && status !== 'processing' && status !== 'speaking') {
          try {
            recognition.start();
          } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isInitialized, status]);

  const handleAkennaQuery = async (text: string) => {
    if (status === 'processing' || status === 'speaking') return;
    
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    setVolume(0);
    setStatus('processing');
    
    try {
      const response = await akennaAIChatInteraction({ text });
      playResponse(response.audio);
    } catch (err) {
      setStatus('listening');
      if (recognitionRef.current) {
         try { recognitionRef.current.start(); } catch(e) {}
      }
    }
  };

  const playResponse = async (audioBase64: string) => {
    if (!audioContextRef.current || !audioRef.current) return;

    try {
      setStatus('speaking');
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      audioRef.current.src = audioBase64;
      
      const updateVolume = () => {
        if (analyserRef.current && status === 'speaking') {
          const bufferLength = analyserRef.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          setVolume(average / 128);
          
          animationFrameRef.current = requestAnimationFrame(updateVolume);
        }
      };

      audioRef.current.onplay = () => {
        updateVolume();
      };

      audioRef.current.onended = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setVolume(0);
        setStatus('listening');
        if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch(e) {}
        }
      };

      await audioRef.current.play();
    } catch (err) {
      setError("Audio playback error. Resetting Akenna.");
      setStatus('idle');
    }
  };

  const toggleAkenna = async () => {
    setError(null);
    if (!isInitialized) {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        
        ctx.onstatechange = () => {
          if (ctx.state === 'closed') {
            setIsInitialized(false);
            setStatus('idle');
          }
        };

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        audioContextRef.current = ctx;

        const audio = new Audio();
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(ctx.destination);

        audioRef.current = audio;
        sourceNodeRef.current = source;
        analyserRef.current = analyser;

        setIsInitialized(true);
      } catch (err) {
        setError("Could not access audio device. Check permissions.");
      }
    } else {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (audioContextRef.current) {
        try {
          await audioContextRef.current.close();
        } catch (e) {}
        audioContextRef.current = null;
      }

      sourceNodeRef.current = null;
      analyserRef.current = null;
      micAnalyserRef.current = null;
      micSourceNodeRef.current = null;
      
      setIsInitialized(false);
      setStatus('idle');
      setVolume(0);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      initSpeech();
      startMicAnalysis();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }
    }
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isInitialized, initSpeech, startMicAnalysis]);

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center relative bg-[#050E10] px-6 py-12">
      <div className="flex-1 flex items-center justify-center w-full">
        <AkennaFace 
          status={status} 
          isSpeaking={status === 'speaking'} 
          volume={volume}
        />
      </div>

      <div className="fixed bottom-12 z-10 flex flex-col items-center gap-6 w-full max-w-md">
        {error && (
          <div className="bg-destructive/20 text-destructive text-xs px-4 py-2 rounded-full border border-destructive/30 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 mb-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {!isInitialized ? (
          <Button 
            onClick={toggleAkenna}
            className="rounded-full px-8 py-8 bg-transparent border-2 border-[#33E0FF] text-[#33E0FF] hover:bg-[#33E0FF]/10 transition-all group overflow-hidden"
          >
            <Power className="mr-3 w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="font-headline tracking-widest uppercase font-bold text-lg">Initialize Akenna</span>
          </Button>
        ) : (
          <div className="flex items-center gap-4">
             <Button 
              variant="outline"
              size="icon"
              onClick={toggleAkenna}
              className="rounded-full w-14 h-14 border-[#3377FF]/40 text-[#3377FF]/60 hover:text-[#3377FF] hover:border-[#3377FF] transition-all bg-transparent"
              title="Deactivate"
            >
              <MicOff className="w-6 h-6" />
            </Button>
            <div className="flex flex-col items-center">
              <div className="text-[10px] text-[#33E0FF]/40 font-headline uppercase tracking-[0.4em] mb-2">Live Mode Active</div>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-1 h-3 rounded-full bg-[#33E0FF] transition-all duration-300",
                      status === 'listening' ? "animate-pulse" : "opacity-20"
                    )}
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>
            <Button 
               variant="outline"
               size="icon"
               onClick={() => window.location.reload()}
               className="rounded-full w-14 h-14 border-white/10 text-white/20 hover:text-white hover:border-white transition-all bg-transparent ml-2"
               title="System Reboot"
             >
               <RefreshCw className="w-6 h-6" />
             </Button>
          </div>
        )}
      </div>

      <div className="fixed top-12 left-12 opacity-10 font-headline tracking-tighter pointer-events-none select-none">
        <div className="text-4xl font-bold text-[#33E0FF]">A K E N N A</div>
        <div className="text-sm text-[#3377FF] pl-1">V.01 LIVE_STREAM</div>
      </div>
    </main>
  );
}
