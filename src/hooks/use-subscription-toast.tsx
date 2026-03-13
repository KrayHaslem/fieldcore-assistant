import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";
import { isSubscriptionError, SUBSCRIPTION_ERROR_TITLE, SUBSCRIPTION_ERROR_DESCRIPTION } from "@/lib/subscription-error";

/**
 * Hook that wraps useToast to automatically detect subscription RLS errors
 * and show a user-friendly message with a link to billing settings.
 */
export function useSubscriptionToast() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const showErrorToast = useCallback(
    (error: { message: string }, fallbackTitle = "Error") => {
      if (isSubscriptionError(error.message)) {
        toast({
          title: SUBSCRIPTION_ERROR_TITLE,
          description: SUBSCRIPTION_ERROR_DESCRIPTION,
          variant: "destructive",
          action: (
            <button
              className="shrink-0 rounded-md bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm ring-1 ring-border hover:bg-accent transition-colors"
              onClick={() => navigate("/settings?tab=billing")}
            >
              Subscribe
            </button>
          ),
        });
      } else {
        toast({ title: fallbackTitle, description: error.message, variant: "destructive" });
      }
    },
    [toast, navigate]
  );

  return { toast, showErrorToast };
}
