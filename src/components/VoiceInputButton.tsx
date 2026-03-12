import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface VoiceInputButtonProps {
  /** Called with the transcript text as the user speaks */
  onTranscript: (text: string) => void;
  /** Called with the final transcript when recognition ends */
  onFinalTranscript?: (text: string) => void;
  disabled?: boolean;
  className?: string;
  /** Size variant */
  size?: "sm" | "md";
}

// Check for browser support
const SpeechRecognition =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export function VoiceInputButton({
  onTranscript,
  onFinalTranscript,
  disabled = false,
  className,
  size = "md",
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    transcriptRef.current = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      const combined = (final + interim).trim();
      transcriptRef.current = combined;
      onTranscript(combined);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (transcriptRef.current && onFinalTranscript) {
        onFinalTranscript(transcriptRef.current);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [onTranscript, onFinalTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Don't render if browser doesn't support speech recognition
  if (!SpeechRecognition) return null;

  const sizeClasses = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggleListening}
            disabled={disabled}
            className={cn(
              "inline-flex items-center justify-center rounded-md transition-colors",
              "text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
              isListening && "text-destructive hover:text-destructive animate-pulse",
              sizeClasses,
              className
            )}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
          >
            {isListening ? (
              <MicOff className={iconSize} />
            ) : (
              <Mic className={iconSize} />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{isListening ? "Stop listening" : "Voice input"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
