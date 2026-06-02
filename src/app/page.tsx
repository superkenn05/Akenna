"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AkennaFace } from '@/components/AkennaFace';
import { akennaAIChatInteraction } from '@/ai/flows/akenna-ai-chat-interaction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MicOff, Power, RefreshCw, AlertCircle, Send, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AkennaPage() {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [isInitialized, setIsInitialized] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    console.log(`[Akenna System] Status updated: ${status}`);
  }, [status]);

  const startMicAnalysis = useCallback(async () => {
    try {
      if (!audioContextRef.current) return;
      
      if (!micStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
      }
      
      if (!micAnalyserRef.current && audioContextRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(micStreamRef.current!);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);
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
          setVolume(Math.min(1.5, average / 40));
          animationFrameRef.current = requestAnimationFrame(updateMicVolume);
        } else if (status !== 'speaking') {
          setVolume(0);
        }
      };
      
      if (status === 'listening') {
        updateMicVolume();
      }
    } catch (err) {
      console.warn('[Akenna Mic] Analysis failed:', err);
    }
  }, [status]);

  const initSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setStatus('listening');
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript.trim()) {
          handleAkennaQuery(finalTranscript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        console.error('[Akenna Speech] Error:', event.error);
        if (event.error === 'not-allowed') {
          setError("Microphone permission denied.");
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
    } else {
      setError("Speech recognition not supported in this browser.");
    }
  }, [isInitialized, status]);

  const handleAkennaQuery = async (text: string) => {
    if (status === 'processing' || status === 'speaking' || !text.trim()) return;
    
    setError(null);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    setVolume(0);
    setStatus('processing');
    
    try {
      const response = await akennaAIChatInteraction({ text });
      playResponse(response.audio);
    } catch (err: any) {
      console.error('[Akenna System] Interaction error:', err);
      // Use the specific error message from the AI Flow if available
      setError(err.message || "AI failed to respond. Check connection.");
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
          setVolume(average / 80); 
          
          animationFrameRef.current = requestAnimationFrame(updateVolume);
        }
      };

      audioRef.current.onplay = () => updateVolume();

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
      console.error('[Akenna Audio] Playback failed:', err);
      setStatus('listening');
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch(e) {}
      }
    }
  };

  const toggleAkenna = async () => {
    setError(null);
    if (!isInitialized) {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const audio = new Audio();
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(ctx.destination);

        audioContextRef.current = ctx;
        audioRef.current = audio;
        analyserRef.current = analyser;

        setIsInitialized(true);
      } catch (err) {
        console.error('[Akenna System] Initialization error:', err);
        setError("Audio system failed to start. Refresh the page.");
      }
    } else {
      cleanup();
      setIsInitialized(false);
      setStatus('idle');
      setVolume(0);
    }
  };

  const cleanup = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
      recognitionRef.current = null;
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
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    micAnalyserRef.current = null;
    analyserRef.current = null;
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
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isInitialized, initSpeech, startMicAnalysis]);

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center relative bg-[#050E10] px-6 py-12 overflow-hidden">
      <div className="flex-1 flex items-center justify-center w-full">
        <AkennaFace 
          status={status} 
          isSpeaking={status === 'speaking'} 
          volume={volume}
        />
      </div>

      <div className="fixed bottom-12 z-10 flex flex-col items-center gap-6 w-full max-w-md px-4">
        {error && (
          <div className="bg-destructive/20 text-destructive text-xs px-4 py-2 rounded-full border border-destructive/30 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 mb-2 text-center max-w-[90vw]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {isInitialized && showDiagnostics && (
          <div className="w-full bg-white/5 border border-white/10 rounded-xl p-4 mb-4 backdrop-blur-md animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 mb-3 text-[10px] text-[#33E0FF] uppercase tracking-widest font-bold">
              <Terminal className="w-3 h-3" />
              Manual Diagnostic Input
            </div>
            <div className="flex gap-2">
              <Input 
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Type a message to test..."
                className="bg-black/40 border-white/10 text-white text-xs h-9 focus-visible:ring-[#33E0FF]"
                onKeyDown={(e) => e.key === 'Enter' && handleAkennaQuery(testInput)}
              />
              <Button 
                onClick={() => {
                  handleAkennaQuery(testInput);
                  setTestInput('');
                }}
                disabled={status !== 'listening' || !testInput.trim()}
                className="bg-[#33E0FF] hover:bg-[#33E0FF]/80 text-black h-9 px-3"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
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
              <div className="text-[10px] text-[#33E0FF]/40 font-headline uppercase tracking-[0.4em] mb-2">
                {status === 'listening' ? 'Vocal Intake' : status === 'processing' ? 'Neural Processing' : 'Vocal Synthesis'}
              </div>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-1 h-3 rounded-full bg-[#33E0FF] transition-all duration-300",
                      status === 'listening' ? "animate-pulse" : status === 'processing' ? "animate-bounce" : "opacity-20"
                    )}
                    style={{ 
                      animationDelay: `${i * 0.1}s`,
                      height: status === 'listening' ? `${3 + volume * 25}px` : '3px'
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                 variant="outline"
                 size="icon"
                 onClick={() => window.location.reload()}
                 className="rounded-full w-10 h-10 border-white/10 text-white/20 hover:text-white hover:border-white transition-all bg-transparent"
                 title="System Reboot"
               >
                 <RefreshCw className="w-4 h-4" />
               </Button>
               <Button 
                 variant="outline"
                 size="icon"
                 onClick={() => setShowDiagnostics(!showDiagnostics)}
                 className={cn(
                   "rounded-full w-10 h-10 border-white/10 transition-all bg-transparent",
                   showDiagnostics ? "text-[#33E0FF] border-[#33E0FF]/30" : "text-white/20 hover:text-white"
                 )}
                 title="Toggle Diagnostics"
               >
                 <Terminal className="w-4 h-4" />
               </Button>
            </div>
          </div>
        )}
      </div>

      <div className="fixed top-12 left-12 opacity-10 font-headline tracking-tighter pointer-events-none select-none">
        <div className="text-4xl font-bold text-[#33E0FF]">A K E N N A</div>
        <div className="text-sm text-[#3377FF] pl-1">V.01 CORE_SYSTEM</div>
      </div>
    </main>
  );
}
