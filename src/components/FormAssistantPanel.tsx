import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Bot, User, Package, PlusCircle, HelpCircle } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Clickable action options rendered as buttons */
  actions?: ChatAction[];
}

export interface ChatAction {
  label: string;
  /** The text that gets sent as a user message when clicked */
  message: string;
  icon?: "package" | "plus" | "help";
}

export interface UnmatchedItem {
  parsed_name: string;
  quantity: number;
  candidates: { id: string; name: string; sku?: string | null }[];
}

export interface UnmatchedSupplier {
  parsed_name: string;
  candidates: { id: string; name: string; avg_lead_time_days?: number | null }[];
}

interface FormAssistantPanelProps {
  commandText: string;
  formContext: string;
  onIntentReceived: (intent: Record<string, any>) => string;
  onClose: () => void;
  /** Unmatched items from parse-command to surface on mount */
  unmatchedItems?: UnmatchedItem[];
  /** Unmatched supplier from parse-command to surface on mount */
  unmatchedSupplier?: UnmatchedSupplier;
}

const actionIcons = {
  package: Package,
  plus: PlusCircle,
  help: HelpCircle,
};

export function FormAssistantPanel({ commandText, formContext, onIntentReceived, onClose, unmatchedItems, unmatchedSupplier }: FormAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const unmatchedHandled = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Surface unmatched items as a proactive assistant message on mount
  useEffect(() => {
    if (!unmatchedItems || unmatchedItems.length === 0 || unmatchedHandled.current) return;
    unmatchedHandled.current = true;

    const newMessages: ChatMessage[] = [];

    for (const item of unmatchedItems) {
      const actions: ChatAction[] = [];

      // Option A: suggest closest candidates
      if (item.candidates.length > 0) {
        for (const candidate of item.candidates.slice(0, 3)) {
          const label = candidate.sku
            ? `Order ${item.quantity} "${candidate.name}" (${candidate.sku})`
            : `Order ${item.quantity} "${candidate.name}"`;
          actions.push({
            label,
            message: `Use "${candidate.name}" instead of "${item.parsed_name}", quantity ${item.quantity}`,
            icon: "package",
          });
        }
      }

      // Option B: create new part
      actions.push({
        label: `Add new part "${item.parsed_name}" and order ${item.quantity}`,
        message: `Create a new inventory item called "${item.parsed_name}" and add ${item.quantity} to this order`,
        icon: "plus",
      });

      // Option C: something else
      actions.push({
        label: "Something else",
        message: "",
        icon: "help",
      });

      const candidateNames = item.candidates.slice(0, 3).map(c => `"${c.name}"`).join(", ");
      const explanation = item.candidates.length > 0
        ? `I couldn't find an exact match for **"${item.parsed_name}"** in your inventory. I found some similar items (${candidateNames}). What would you like to do?`
        : `I couldn't find **"${item.parsed_name}"** in your inventory and there are no similar items. Would you like to create it as a new part?`;

      newMessages.push({
        role: "assistant",
        content: explanation,
        actions,
      });
    }

    if (newMessages.length > 0) {
      setMessages(newMessages);
    }
  }, [unmatchedItems]);

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("form-assistant", {
        body: {
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          formContext,
          commandText,
        },
      });

      if (error) throw error;

      const reply = data?.reply || "I've processed your request.";
      let assistantContent = reply;

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

  const handleActionClick = (action: ChatAction) => {
    if (action.icon === "help" && !action.message) {
      // Focus the input for free-text entry
      setInput("");
      const inputEl = document.querySelector<HTMLInputElement>('[data-assistant-input]');
      inputEl?.focus();
      return;
    }
    handleSend(action.message);
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
          <div key={i}>
            <div className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && <Bot className="h-4 w-4 mt-1 text-primary shrink-0" />}
              <div
                className={`rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.content.split(/(\*\*.*?\*\*)/g).map((part, j) =>
                  part.startsWith("**") && part.endsWith("**")
                    ? <strong key={j}>{part.slice(2, -2)}</strong>
                    : <span key={j}>{part}</span>
                )}
              </div>
              {msg.role === "user" && <User className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />}
            </div>

            {/* Action buttons */}
            {msg.actions && msg.actions.length > 0 && (
              <div className="ml-6 mt-2 space-y-1.5">
                {msg.actions.map((action, j) => {
                  const IconComp = action.icon ? actionIcons[action.icon] : null;
                  return (
                    <button
                      key={j}
                      onClick={() => handleActionClick(action)}
                      disabled={sending}
                      className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                    >
                      {IconComp && <IconComp className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
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
            data-assistant-input
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
