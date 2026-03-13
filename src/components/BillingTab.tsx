import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, ExternalLink, RefreshCw, Check } from "lucide-react";

const PLANS = {
  monthly: {
    price_id: "price_1TAcl21UbJLrggAK72QiA2lz",
    product_id: "prod_U8ualv3TGGI8Cm",
    name: "Monthly",
    price: "$50",
    interval: "month",
    description: "$50/month, billed monthly",
  },
  annual: {
    price_id: "price_1TAcpD1UbJLrggAKh25YjSdE",
    product_id: "prod_U8ueQWrIai94JN",
    name: "Annual",
    price: "$500",
    interval: "year",
    description: "$500/year (save $100)",
  },
} as const;

type SubscriptionData = {
  subscribed: boolean;
  status?: string;
  product_id?: string;
  price_id?: string;
  subscription_end?: string;
  trial_end?: string;
  cancel_at_period_end?: boolean;
};

export function BillingTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      setSubscription(data);
    } catch (e: any) {
      console.error("check-subscription error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
    // Auto-refresh every 60s
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const handleCheckout = async (planKey: "monthly" | "annual") => {
    setCheckoutLoading(planKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { price_id: PLANS[planKey].price_id },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast({ title: "Checkout failed", description: e.message, variant: "destructive" });
    }
    setCheckoutLoading(null);
  };

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast({ title: "Portal failed", description: e.message, variant: "destructive" });
    }
    setPortalLoading(false);
  };

  const currentPlan = subscription?.subscribed
    ? Object.entries(PLANS).find(([, p]) => p.price_id === subscription.price_id)?.[0] as "monthly" | "annual" | undefined
    : null;

  if (loading) {
    return (
      <div className="fieldcore-card p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Checking subscription status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subscription Status */}
      {subscription?.subscribed && (
        <div className="fieldcore-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Current Subscription
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge variant={subscription.status === "trialing" ? "secondary" : "default"} className="capitalize">
                {subscription.status === "trialing" ? "Free Trial" : subscription.status}
              </Badge>
              {subscription.cancel_at_period_end && (
                <Badge variant="destructive">Cancels at period end</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Plan:</span>
              <span className="text-sm font-medium text-foreground">{currentPlan ? PLANS[currentPlan].name : "Pro"}</span>
            </div>
            {subscription.trial_end && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Trial ends:</span>
                <span className="text-sm text-foreground">{new Date(subscription.trial_end).toLocaleDateString()}</span>
              </div>
            )}
            {subscription.subscription_end && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Next billing:</span>
                <span className="text-sm text-foreground">{new Date(subscription.subscription_end).toLocaleDateString()}</span>
              </div>
            )}
            <div className="pt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={handleManage} disabled={portalLoading}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                {portalLoading ? "Loading..." : "Manage Subscription"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setLoading(true); checkSubscription(); }}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Selection */}
      <div className="fieldcore-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {subscription?.subscribed ? "Change Plan" : "Choose a Plan"}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          All plans include a 30-day free trial. No charge until the trial ends.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.entries(PLANS) as [string, typeof PLANS[keyof typeof PLANS]][]).map(([key, plan]) => {
            const isCurrentPlan = currentPlan === key;
            return (
              <div
                key={key}
                className={`relative rounded-lg border-2 p-5 transition-colors ${
                  isCurrentPlan
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                {isCurrentPlan && (
                  <Badge className="absolute -top-2.5 left-4 bg-primary text-primary-foreground">
                    <Check className="h-3 w-3 mr-1" />
                    Your Plan
                  </Badge>
                )}
                <h4 className="text-lg font-semibold text-foreground">{plan.name}</h4>
                <div className="mt-1">
                  <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">/{plan.interval}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                <ul className="mt-3 space-y-1">
                  <li className="text-sm text-foreground flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-primary" /> Full platform access
                  </li>
                  <li className="text-sm text-foreground flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-primary" /> Unlimited users
                  </li>
                  <li className="text-sm text-foreground flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-primary" /> 30-day free trial
                  </li>
                  {key === "annual" && (
                    <li className="text-sm text-primary font-medium flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" /> Save $100/year
                    </li>
                  )}
                </ul>
                <Button
                  className="w-full mt-4"
                  variant={isCurrentPlan ? "outline" : "default"}
                  disabled={isCurrentPlan || !!checkoutLoading}
                  onClick={() => handleCheckout(key as "monthly" | "annual")}
                >
                  {checkoutLoading === key
                    ? "Redirecting..."
                    : isCurrentPlan
                    ? "Current Plan"
                    : "Start Free Trial"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Test Mode Notice */}
      <div className="fieldcore-card p-4 border-dashed">
        <p className="text-xs text-muted-foreground">
          🧪 <strong>Test Mode:</strong> Stripe is running in test mode. Use card number{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">4242 4242 4242 4242</code> with any future expiry date and CVC.
        </p>
      </div>
    </div>
  );
}
