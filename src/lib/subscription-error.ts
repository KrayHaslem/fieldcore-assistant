/**
 * Detects if a Supabase error is a subscription-related RLS policy violation
 * and returns a user-friendly message with navigation action.
 */
export function isSubscriptionError(errorMessage: string): boolean {
  return errorMessage.includes("Require active subscription");
}

export const SUBSCRIPTION_ERROR_TITLE = "Subscription Required";
export const SUBSCRIPTION_ERROR_DESCRIPTION =
  "Your organization needs an active subscription to create new records.";
