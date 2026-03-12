import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Bot, Send, User, Play, AlertTriangle } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ReportSqlAssistantProps {
  sqlQuery: string;
  onSqlChange: (sql: string) => void;
  accessLevel: string;
}

/**
 * Extract raw SQL from markdown code fences as a client-side fallback.
 */
function extractSqlFromFences(text: string): string | null {
  const fenceRegex = /```(?:sql)?\s*\n?([\s\S]*?)```/i;
  const match = text.match(fenceRegex);
  if (match) {
    const inner = match[1].trim().replace(/;$/, "");
    const upper = inner.toUpperCase();
    if (upper.startsWith("SELECT") || upper.startsWith("WITH")) {
      return inner;
    }
  }
  return null;
}

export function ReportSqlAssistant({ sqlQuery, onSqlChange, accessLevel }: ReportSqlAssistantProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "I can help you write a SQL query for your custom report. Describe what data you want to see and I'll write the query for you." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ columns: string[]; rows: Record<string, any>[] } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Clear stale test results when SQL changes
  useEffect(() => {
    setTestResult(null);
    setTestError(null);
  }, [sqlQuery]);

  const applySql = (sql: string) => {
    onSqlChange(sql);
    toast({ title: "SQL query updated", description: "The assistant filled in the query. You can edit it or preview results." });
  };

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
        },
      });
      if (error) throw error;

      let reply = data?.reply || "I couldn't generate a response.";
      const warnings = data?.warnings as string[] | undefined;
      if (warnings && warnings.length > 0) {
        reply += "\n\n🛡️ **SQL Guardrails:**\n" + warnings.map((w: string) => `• ${w}`).join("\n");
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

      if (data?.sql) {
        applySql(data.sql);
      } else {
        // Client-side fallback: try extracting SQL from markdown fences in the reply
        const extracted = extractSqlFromFences(reply);
        if (extracted) {
          applySql(extracted);
        }
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  };

  const handleTest = async () => {
    if (!sqlQuery.trim() || !user) return;
    setTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      const { data, error } = await supabase.functions.invoke("run-report", {
        body: {
          inline_sql: sqlQuery,
          inline_access_level: accessLevel,
          user_id: user.id,
          start_date: new Date(new Date().getFullYear(), 0, 1).toISOString(),
          end_date: new Date().toISOString(),
        },
      });

      // Edge function may return error in data body even with 200, or throw on non-2xx
      if (data?.error) {
        setTestError(data.error);
      } else if (error) {
        // supabase.functions.invoke throws FunctionsHttpError for non-2xx
        const msg = typeof error === "object" && error.message ? error.message : String(error);
        setTestError(
          msg.includes("non-2xx")
            ? "Query failed. Check your SQL syntax and try again."
            : msg
        );
      } else {
        setTestResult(data);
      }
    } catch (err: any) {
      const msg = err.message || "Unknown error";
      setTestError(
        msg.includes("non-2xx")
          ? "Query failed. Check your SQL syntax and try again."
          : msg
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-warning" />
        Custom SQL is executed against your organization's data. Queries are automatically scoped via RLS. Use :start_date, :end_date, and :org_id as parameter placeholders.
      </div>

      <div className="grid grid-cols-2 gap-3 min-h-[300px]">
        {/* Left: Chat panel */}
        <div className="border rounded-md flex flex-col">
          <div className="flex items-center gap-2 border-b px-3 py-2 bg-muted/30">
            <Bot className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">Describe your report to the AI assistant</span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0 max-h-[250px]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && <Bot className="h-3.5 w-3.5 mt-1 text-primary shrink-0" />}
                <div className={`rounded-md px-2 py-1.5 text-xs max-w-[85%] whitespace-pre-wrap ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}>
                  {msg.content}
                </div>
                {msg.role === "user" && <User className="h-3.5 w-3.5 mt-1 text-muted-foreground shrink-0" />}
              </div>
            ))}
            {sending && (
              <div className="flex gap-1.5">
                <Bot className="h-3.5 w-3.5 mt-1 text-primary shrink-0" />
                <div className="bg-muted rounded-md px-2 py-1.5 text-xs text-muted-foreground">Thinking...</div>
              </div>
            )}
          </div>
          <div className="border-t p-2">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-1.5">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. Show monthly revenue by item..."
                className="text-xs h-8"
                disabled={sending}
              />
              <Button type="submit" size="icon" className="h-8 w-8" disabled={sending || !input.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </div>

        {/* Right: SQL editor */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">SQL Query (auto-filled by assistant or enter manually)</label>
          <Textarea
            value={sqlQuery}
            onChange={(e) => onSqlChange(e.target.value)}
            rows={10}
            className="font-mono text-xs flex-1 min-h-[200px]"
            placeholder="SELECT ..."
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing || !sqlQuery.trim()}
            className="self-start"
          >
            <Play className="h-3.5 w-3.5" />
            {testing ? "Running..." : "Preview Results"}
          </Button>
        </div>
      </div>

      {/* Test results */}
      {testError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {testError}
        </div>
      )}
      {testResult && (
        <div className="border rounded-md overflow-hidden max-h-[200px] overflow-y-auto">
          {testResult.rows.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">Query returned no rows.</div>
          ) : (
            <table className="w-full text-xs">
              <thead><tr className="border-b bg-muted/50">
                {testResult.columns.map((col) => (
                  <th key={col} className="px-2 py-1.5 text-left font-medium text-muted-foreground">{col}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y">
                {testResult.rows.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {testResult.columns.map((col) => (
                      <td key={col} className="px-2 py-1 text-foreground">{String(row[col] ?? "—")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {testResult.rows.length > 10 && (
            <div className="px-2 py-1 text-xs text-muted-foreground bg-muted/30 border-t">
              Showing 10 of {testResult.rows.length} rows
            </div>
          )}
        </div>
      )}
    </div>
  );
}
