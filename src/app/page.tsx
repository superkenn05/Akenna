"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AkennaFace } from '@/components/AkennaFace';
import { akennaAIChatInteraction } from '@/ai/flows/akenna-ai-chat-interaction';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Power } from 'lucide-react';

export default function AkennaPage() {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [isInitialized, setIsInitialized] = useState(false);
  const [volume, setVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Speech Recognition
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
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setIsInitialized(false);
        }
      };

      recognition.onend = () => {
        // If we are still "initialized" and not currently processing or speaking, restart listening
        if (isInitialized && status !== 'processing' && status !== 'speaking') {
          recognition.start();
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isInitialized, status]);

  const handleAkennaQuery = async (text: string) => {
    if (status === 'processing' || status === 'speaking') return;
    
    // Stop listening while processing to avoid hearing itself
    if (recognitionRef.current) recognitionRef.current.stop();
    
    setStatus('processing');
    try {
      const response = await akennaAIChatInteraction({ text });
      playResponse(response.audio);
    } catch (error) {
      console.error('Akenna interaction error:', error);
      setStatus('listening');
      if (recognitionRef.current) recognitionRef.current.start();
    }
  };

  const playResponse = (audioBase64: string) => {
    setStatus('speaking');
    
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const audio = new Audio(audioBase64);
    audioRef.current = audio;

    const source = audioContextRef.current.createMediaElementSource(audio);
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(audioContextRef.current.destination);
    analyserRef.current = analyser;

    const updateVolume = () => {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      setVolume(average / 128); // Normalize to approx 0-1
      
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };

    audio.onplay = () => {
      updateVolume();
    };

    audio.onended = () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setVolume(0);
      setStatus('listening');
      // Restart listening after speech ends
      if (recognitionRef.current) recognitionRef.current.start();
    };

    audio.play();
  };

  const toggleAkenna = () => {
    if (!isInitialized) {
      setIsInitialized(true);
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    } else {
      setIsInitialized(false);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (audioRef.current) audioRef.current.pause();
      setStatus('idle');
    }
  };

  useEffect(() => {
    if (isInitialized) {
      initSpeech();
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isInitialized, initSpeech]);

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center relative bg-[#050E10] px-6 py-12">
      {/* Central Visual Focus */}
      <div className="flex-1 flex items-center justify-center w-full">
        <AkennaFace 
          status={status} 
          isSpeaking={status === 'speaking'} 
          volume={volume}
        />
      </div>

      {/* Controller Area */}
      <div className="fixed bottom-12 z-10 flex flex-col items-center gap-6">
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
          </div>
        )}
      </div>

      {/* Decorative Accents */}
      <div className="fixed top-12 left-12 opacity-10 font-headline tracking-tighter pointer-events-none select-none">
        <div className="text-4xl font-bold text-[#33E0FF]">A K E N N A</div>
        <div className="text-sm text-[#3377FF] pl-1">V.01 LIVE_STREAM</div>
      </div>
      
      <div className="fixed bottom-12 right-12 flex gap-4 opacity-5 pointer-events-none select-none hidden sm:flex">
        <div className="flex flex-col items-end">
          <div className="text-[10px] text-[#33E0FF] uppercase tracking-widest">Neural Frequency</div>
          <div className="text-xl font-mono text-[#3377FF]">12.4 GHZ</div>
        </div>
      </div>
    </main>
  );
}
