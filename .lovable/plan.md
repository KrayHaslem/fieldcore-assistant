

## Plan: Stripe Subscription Billing (Test Mode)

### Prerequisites
1. Enable Stripe integration via the Lovable Stripe tool
2. User provides their `sk_test_...` secret key from the Stripe test dashboard

### After Stripe is enabled, implementation will include:

**1. Create Stripe Products & Prices**
- Product: "FieldCore Pro" (or similar)
- Monthly price: $50/month with 30-day free trial
- Annual price: $1,000/year with 30-day free trial

**2. Subscription Management**
- Edge function for creating Checkout Sessions with trial period
- Edge function for Stripe webhooks (handle subscription lifecycle events)
- Store subscription status per organization (new `subscriptions` table or field on `organizations`)

**3. UI Changes**
- Billing/subscription tab in Settings page
- Plan selection (monthly vs annual)
- "Subscribe" button that redirects to Stripe Checkout
- Display current plan status, trial info, next billing date
- Manage/cancel subscription link

**4. Access Control**
- Check subscription status (active/trialing) before allowing access to the app
- Grace period handling for failed payments

### Next Step
I need to enable Stripe first, which will prompt you for your test secret key. Once that's done, I'll get detailed tooling and can begin implementation.

