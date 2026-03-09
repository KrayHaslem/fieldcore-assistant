import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Bot, User } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface FormAssistantPanelProps {
  /** The original command text */
  commandText: string;
  /** Description of the current form for AI context */
  formContext: string;
  /** Called with parsed intent data so the parent can update form fields. Return a human-readable summary of what changed. */
  onIntentReceived: (intent: Record<string, any>) => string;
  onClose: () => void;
}

export function FormAssistantPanel({ commandText, formContext, onIntentReceived, onClose }: FormAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("form-assistant", {
        body: {
          messages: updatedMessages,
          formContext,
          commandText,
        },
      });

      if (error) throw error;

      const reply = data?.reply || "I've processed your request.";
      let assistantContent = reply;

      // If intent was extracted, let parent handle it and append summary
      if (data?.intent) {
        const summary = onIntentReceived(data.intent);
        if (summary) {
          assistantContent = `${reply}\n\n📋 ${summary}`;
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
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
          <span className="text-sm font-semibold text-foreground">Assistant</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Original command */}
      <div className="border-b px-4 py-3">
        <p className="text-xs text-muted-foreground mb-1">Original command:</p>
        <p className="text-sm text-foreground font-medium">{commandText}</p>
      </div>

      {/* Prompt */}
      <div className="px-4 py-2 border-b bg-muted/30">
        <p className="text-xs text-muted-foreground">Ask questions about the form or provide additional details:</p>
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
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question or give instructions..."
            className="text-sm"
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          The assistant updates form fields only. You must review and submit manually.
        </p>
      </div>
    </div>
  );
}
