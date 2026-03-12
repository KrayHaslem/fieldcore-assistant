import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Bot, User } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TemplateFieldUpdates {
  name?: string;
  description?: string;
  access_level?: string;
  chart_type?: string;
  supports_date_range?: boolean;
  sql_query?: string;
}

interface TemplateAssistantPanelProps {
  onFieldsUpdate: (fields: TemplateFieldUpdates) => void;
  onClose: () => void;
  initialMessage?: string;
}

export function TemplateAssistantPanel({ onFieldsUpdate, onClose, initialMessage }: TemplateAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Describe the report you want to create. I can suggest the name, description, access level, chart type, and SQL query." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialSent = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const processResponse = (data: any) => {
    const reply = data?.reply || "";
    const fields = data?.fields as TemplateFieldUpdates | undefined;
    const hasFields = fields && Object.keys(fields).length > 0;
    const warnings = data?.warnings as string[] | undefined;

    // Build a meaningful reply even if AI returned empty content (common with tool calls)
    let displayReply = reply || (hasFields
      ? "I've updated the template fields based on your description."
      : "I couldn't process that request.");

    // Append guardrail warnings so the user sees what was corrected
    if (warnings && warnings.length > 0) {
      displayReply += "\n\n🛡️ **SQL Guardrails:**\n" + warnings.map((w) => `• ${w}`).join("\n");
    }

    setMessages((prev) => [...prev, { role: "assistant", content: displayReply }]);

    if (hasFields) {
      // Guard against empty sql_query being set
      if (fields.sql_query !== undefined && !fields.sql_query.trim()) {
        delete fields.sql_query;
      }
      if (Object.keys(fields).length > 0) {
        onFieldsUpdate(fields);
      }
    }
  };

  // Auto-send initial message from Command Center
  useEffect(() => {
    if (initialMessage && !initialSent.current) {
      initialSent.current = true;
      const userMsg: ChatMessage = { role: "user", content: initialMessage };
      const updated = [messages[0], userMsg];
      setMessages(updated);
      setSending(true);

      supabase.functions.invoke("report-sql-assistant", {
        body: {
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
          reportDescription: initialMessage,
          mode: "template",
          instruction: "The user navigated here from a command center. Analyze their request carefully, suggest ALL template fields including a valid SQL query, and explain what you set.",
        },
      }).then(({ data, error }) => {
        if (error) {
          setMessages((prev) => [...prev, { role: "assistant", content: `Sorry, I couldn't process that: ${error.message}` }]);
        } else {
          processResponse(data);
        }
      }).catch((err) => {
        setMessages((prev) => [...prev, { role: "assistant", content: `Sorry, I couldn't process that: ${err.message}` }]);
      }).finally(() => {
        setSending(false);
      });
    }
  }, [initialMessage]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("report-sql-assistant", {
        body: {
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
          reportDescription: "",
          mode: "template",
        },
      });

      if (error) throw error;
      processResponse(data);
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
          <span className="text-sm font-semibold text-foreground">Template Assistant</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Prompt */}
      <div className="px-4 py-2 border-b bg-muted/30">
        <p className="text-xs text-muted-foreground">
          Describe your report — I'll suggest the template fields and SQL query.
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
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Monthly spending by department..."
            className="text-sm"
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          The assistant updates form fields. Review and submit manually.
        </p>
      </div>
    </div>
  );
}
