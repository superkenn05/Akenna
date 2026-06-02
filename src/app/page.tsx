"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AkennaFace } from '@/components/AkennaFace';
import { akennaAIChatInteraction } from '@/ai/flows/akenna-ai-chat-interaction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MicOff, Power, RefreshCw, AlertCircle, Send, Terminal, MessageSquare, Volume2, VolumeX, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

type HistoryMessage = { role: 'user' | 'model'; text: string };

export default function AkennaPage() {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [isInitialized, setIsInitialized] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  // Dialogue states
  const [userTranscript, setUserTranscript] = useState('');
  const [aiTextResponse, setAiTextResponse] = useState('');
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startMicAnalysis = useCallback(async () => {
    try {
      if (!audioContextRef.current) return;
      if (!micStreamRef.current) {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (!micAnalyserRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(micStreamRef.current!);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        micAnalyserRef.current = analyser;
      }

      const updateMicVolume = () => {
        if (micAnalyserRef.current && status === 'listening') {
          const bufferLength = micAnalyserRef.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          micAnalyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
          const level = Math.min(1.5, (sum / bufferLength) / 40);
          setVolume(level);
          animationFrameRef.current = requestAnimationFrame(updateMicVolume);
        } else if (status !== 'speaking') {
          setVolume(0);
        }
      };
      if (status === 'listening') updateMicVolume();
    } catch (err) {
      console.warn("[Akenna System] Mic analysis unavailable:", err);
    }
  }, [status]);

  const handleAkennaQuery = async (text: string) => {
    if (status === 'processing' || status === 'speaking' || !text.trim()) return;
    
    setError(null);
    setAiTextResponse('');
    setUserTranscript(text);

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    setVolume(0);
    setStatus('processing');
    
    try {
      const response = await akennaAIChatInteraction({ 
        text, 
        history: history.slice(-6), 
        voiceEnabled 
      });
      
      if (response.text) {
        setAiTextResponse(response.text);
        setHistory(prev => [...prev, 
          { role: 'user', text }, 
          { role: 'model', text: response.text! }
        ]);
      }

      if (response.error) {
        setError(response.error);
      }

      if (voiceEnabled) {
        if (response.audio) {
          playResponse(response.audio);
        } else if (response.text) {
          playBrowserFallback(response.text);
        } else {
          setStatus('listening');
          setTimeout(() => restartRecognition(), 100);
        }
      } else {
        setStatus('listening');
        setTimeout(() => restartRecognition(), 100);
      }
    } catch (err: any) {
      setError("Communication array offline. Please wait or refresh.");
      setStatus('listening');
      restartRecognition();
    }
  };

  const restartRecognition = () => {
    if (recognitionRef.current && isInitialized && status !== 'processing' && status !== 'speaking') {
      try { 
        recognitionRef.current.start(); 
      } catch (e) {}
    }
  };

  const initSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setStatus('listening');
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            handleAkennaQuery(event.results[i][0].transcript.trim());
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (interimTranscript) setUserTranscript(interimTranscript);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        if (event.error === 'not-allowed') {
          setError("Microphone access denied.");
          setIsInitialized(false);
          setStatus('idle');
        }
      };

      recognition.onend = () => {
        if (isInitialized && status === 'listening') restartRecognition();
      };

      recognitionRef.current = recognition;
    } else {
      setError("Speech recognition engine not supported.");
    }
  }, [isInitialized, status]);

  const playBrowserFallback = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.1;

    utterance.onstart = () => {
      setStatus('speaking');
      const simulateVolume = () => {
        if (status === 'speaking') {
          setVolume(0.2 + Math.random() * 0.3);
          animationFrameRef.current = requestAnimationFrame(simulateVolume);
        }
      };
      simulateVolume();
    };

    utterance.onend = () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setVolume(0);
      setStatus('listening');
      restartRecognition();
    };

    utterance.onerror = () => {
      setStatus('listening');
      restartRecognition();
    };

    window.speechSynthesis.speak(utterance);
  };

  const playResponse = async (audioBase64: string) => {
    if (!audioContextRef.current || !audioRef.current) return;
    try {
      setStatus('speaking');
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      
      audioRef.current.src = audioBase64;
      
      const updateVolume = () => {
        if (analyserRef.current && status === 'speaking') {
          const bufferLength = analyserRef.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
          setVolume((sum / bufferLength) / 80); 
          animationFrameRef.current = requestAnimationFrame(updateVolume);
        }
      };

      audioRef.current.onplay = () => updateVolume();
      audioRef.current.onended = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setVolume(0);
        setStatus('listening');
        restartRecognition();
      };
      
      await audioRef.current.play();
    } catch (err) {
      if (aiTextResponse) playBrowserFallback(aiTextResponse);
      else {
        setStatus('listening');
        restartRecognition();
      }
    }
  };

  const toggleAkenna = async () => {
    setError(null);
    setAiTextResponse('');
    setUserTranscript('');
    setHistory([]);
    
    if (!isInitialized) {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
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
        setStatus('listening');
      } catch (err) {
        setError("Audio system initialization failed.");
      }
    } else {
      cleanup();
      setIsInitialized(false);
      setStatus('idle');
      setVolume(0);
    }
  };

  const cleanup = () => {
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {}
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
  };

  useEffect(() => {
    if (isInitialized) {
      initSpeech();
      startMicAnalysis();
      restartRecognition();
    }
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isInitialized, initSpeech, startMicAnalysis]);

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center relative bg-[#050E10] px-6 py-12 overflow-hidden">
      
      {/* User Dialogue Overlay - Top Right */}
      {userTranscript && (
        <div className="fixed top-8 right-8 z-30 flex flex-col items-end max-w-[30%] pointer-events-none select-none animate-in fade-in slide-in-from-right-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-3 backdrop-blur-sm shadow-lg">
            <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1 font-bold text-right">You</div>
            <div className="text-white/80 text-sm italic text-right">"{userTranscript}"</div>
          </div>
        </div>
      )}

      {/* AI Dialogue Overlay - Top Center */}
      {aiTextResponse && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-6 pointer-events-none select-none animate-in fade-in zoom-in-95">
          <div className="bg-[#33E0FF]/5 border border-[#33E0FF]/20 rounded-2xl px-6 py-4 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-3 h-3 text-[#33E0FF]" />
              <span className="text-[10px] text-[#33E0FF] uppercase tracking-widest font-bold">Akenna</span>
            </div>
            <div className="text-white text-base leading-relaxed">{aiTextResponse}</div>
          </div>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center w-full">
        <AkennaFace status={status} isSpeaking={status === 'speaking'} volume={volume} />
      </div>

      {/* Control Area - Stealth Mode (Hover to Reveal) */}
      <div className="fixed bottom-12 z-40 flex flex-col items-center gap-6 w-full max-w-md px-4 group/controls transition-all duration-500">
        
        {error && (
          <div className="bg-destructive/20 text-destructive text-xs px-4 py-2 rounded-full border border-destructive/30 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 mb-2 text-center max-w-[90vw]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-col items-center gap-6 w-full opacity-0 group-hover/controls:opacity-100 transition-opacity duration-300">
          
          {isInitialized && (
            <div className="flex items-center gap-6 bg-white/5 px-6 py-3 rounded-full border border-white/10 backdrop-blur-sm pointer-events-auto shadow-xl">
              <div className="flex items-center gap-3">
                {voiceEnabled ? <Volume2 className="w-4 h-4 text-[#33E0FF]" /> : <VolumeX className="w-4 h-4 text-white/40" />}
                <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
                <Label className="text-[10px] uppercase tracking-wider text-white/60">Voice Response</Label>
              </div>
              <Separator orientation="vertical" className="h-6 bg-white/10" />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className={cn("w-8 h-8", showDiagnostics ? "text-[#33E0FF]" : "text-white/40")}
              >
                <Terminal className="w-4 h-4" />
              </Button>
            </div>
          )}

          {isInitialized && showDiagnostics && (
            <div className="w-full bg-black/40 border border-white/10 rounded-xl p-4 mb-2 backdrop-blur-md animate-in fade-in zoom-in-95 pointer-events-auto flex flex-col gap-3 shadow-2xl">
              <div className="flex gap-2">
                <Input 
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Type a query..."
                  className="bg-black/40 border-white/10 text-white text-xs h-9"
                  onKeyDown={(e) => e.key === 'Enter' && handleAkennaQuery(testInput)}
                />
                <Button onClick={() => handleAkennaQuery(testInput)} className="bg-[#33E0FF] text-black h-9 px-3 hover:bg-[#33E0FF]/80">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <Button 
                variant="outline" 
                onClick={() => playBrowserFallback("System voice test active. All modules are within normal parameters.")}
                className="w-full text-[10px] uppercase tracking-widest border-white/10 bg-white/5 h-8 hover:bg-[#33E0FF]/20"
              >
                <Play className="w-3 h-3 mr-2 text-[#33E0FF]" />
                Quick Voice Test
              </Button>
            </div>
          )}

          {!isInitialized ? (
            <Button 
              onClick={toggleAkenna}
              className="rounded-full px-12 py-8 bg-transparent border-2 border-[#33E0FF] text-[#33E0FF] hover:bg-[#33E0FF]/10 group animate-in fade-in slide-in-from-bottom-4 shadow-[0_0_30px_rgba(51,224,255,0.2)]"
            >
              <Power className="mr-3 w-6 h-6 group-hover:scale-110 transition-transform" />
              <span className="font-headline tracking-widest uppercase font-bold text-lg">Initialize Akenna</span>
            </Button>
          ) : (
            <div className="flex items-center gap-4 animate-in zoom-in-95 duration-500">
              <Button 
                variant="outline"
                size="icon"
                onClick={toggleAkenna}
                className="rounded-full w-14 h-14 border-[#3377FF]/40 text-[#3377FF]/60 hover:text-[#3377FF] bg-transparent hover:bg-[#3377FF]/5 shadow-lg"
              >
                <MicOff className="w-6 h-6" />
              </Button>
              <div className="flex flex-col items-center">
                <div className="text-[10px] text-[#33E0FF]/40 font-headline uppercase tracking-[0.4em] mb-2">
                  {status === 'listening' ? 'Intake' : status === 'processing' ? 'Thinking' : 'Talking'}
                </div>
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={cn("w-1 h-3 rounded-full bg-[#33E0FF] transition-all", status === 'listening' || status === 'processing' ? "animate-pulse" : "opacity-20")}
                      style={{ animationDelay: `${i * 0.1}s`, height: status === 'listening' ? `${3 + volume * 25}px` : '3px' }}
                    />
                  ))}
                </div>
              </div>
              <Button 
                variant="outline" size="icon" onClick={() => window.location.reload()}
                className="rounded-full w-10 h-10 border-white/10 text-white/20 hover:text-white bg-transparent hover:bg-white/5"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
