import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Bot, User } from "lucide-react";
import { VoiceInputButton } from "@/components/VoiceInputButton";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AvailableReport {
  name: string;
  description: string;
  category: string;
}

interface ReportAction {
  type: "select_report";
  report_name: string;
  start_date: string | null;
  end_date: string | null;
  search_term?: string | null;
}

interface ReportAssistantPanelProps {
  availableReports: AvailableReport[];
  onSelectReport: (reportName: string, startDate?: string | null, endDate?: string | null, searchTerm?: string | null) => void;
  onClose: () => void;
  initialMessage?: string;
}

export function ReportAssistantPanel({ availableReports, onSelectReport, onClose, initialMessage }: ReportAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "What data are you looking for? I can help you find the right report and set up date ranges." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialSent = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Auto-send initial message from Command Center
  useEffect(() => {
    if (initialMessage && !initialSent.current) {
      initialSent.current = true;
      const userMsg: ChatMessage = { role: "user", content: initialMessage };
      const updated = [messages[0], userMsg];
      setMessages(updated);
      setSending(true);

      supabase.functions.invoke("report-assistant", {
        body: {
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
          available_reports: availableReports,
        },
      }).then(({ data, error }) => {
        if (error) {
          setMessages((prev) => [...prev, { role: "assistant", content: `Sorry, I couldn't process that: ${error.message}` }]);
        } else {
          const reply = data?.reply || "I couldn't process that request.";
          setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
          if (data?.action?.type === "select_report") {
            const action = data.action as ReportAction;
            onSelectReport(action.report_name, action.start_date, action.end_date, action.search_term);
          }
        }
      }).catch((err) => {
        setMessages((prev) => [...prev, { role: "assistant", content: `Sorry, I couldn't process that: ${err.message}` }]);
      }).finally(() => {
        setSending(false);
      });
    }
  }, [initialMessage, availableReports]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("report-assistant", {
        body: {
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
          available_reports: availableReports,
        },
      });

      if (error) throw error;

      const reply = data?.reply || "I couldn't process that request.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

      // Handle action
      if (data?.action?.type === "select_report") {
        const action = data.action as ReportAction;
        onSelectReport(action.report_name, action.start_date, action.end_date, action.search_term);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I couldn't process that: ${err.message}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-80 shrink-0 border-l bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Report Assistant</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Prompt */}
      <div className="px-4 py-2 border-b bg-muted/30">
        <p className="text-xs text-muted-foreground">
          Describe what data you need — I'll find the right report and time range.
        </p>
      </div>

      {/* Chat history */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && <Bot className="h-4 w-4 mt-1 text-primary shrink-0" />}
            <div
              className={`rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" && <User className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />}
          </div>
        ))}
        {sending && (
          <div className="flex gap-2">
            <Bot className="h-4 w-4 mt-1 text-primary shrink-0" />
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">Thinking...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. How much did we spend last quarter?"
              className="text-sm pr-8"
              disabled={sending}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <VoiceInputButton
                onTranscript={(text) => setInput(text)}
                disabled={sending}
                size="sm"
              />
            </div>
          </div>
          <Button type="submit" size="icon" disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          The assistant selects reports and date ranges for you.
        </p>
      </div>
    </div>
  );
}
