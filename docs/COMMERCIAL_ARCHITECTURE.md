# Commercial Architecture

## Billing Domain

DeOrch uses a provider-independent billing domain. Payment processing is behind an adapter interface — no specific payment provider (Stripe, etc.) is integrated yet.

### Entities

- **Plan** — defines a product tier with entitlements and pricing
- **Subscription** — links an organization to a plan with lifecycle (TRIAL → ACTIVE → CANCELLED)
- **UsageRecord** — metered usage per org per metric per period
- **BillingEvent** — idempotent audit trail for billing state changes

### Plans (Seeded)

| Plan | Tier | Price | Users | Devices | Sessions | Workflows |
|------|------|-------|-------|---------|----------|-----------|
| Individual | individual | Free | 1 | 3 | 10/period | 5 |
| Team | team | $29/mo | 10 | 20 | Unlimited | 50 |
| Enterprise | enterprise | $99/mo | Unlimited | Unlimited | Unlimited | Unlimited |

### Entitlement Service

Centralized at `services/entitlements.py`:
- `check_entitlement(org_id, name)` — boolean check
- `check_usage_limit(org_id, metric)` — returns (within_limit, current, limit)
- `record_usage(org_id, metric)` — record metered event
- `get_current_usage(org_id, metric)` — current period total

### Subscription Lifecycle

```
TRIAL (14 days) → ACTIVE → CANCELLED
                → PAST_DUE → CANCELLED
                → EXPIRED
```

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/v1/billing/plans | List available plans |
| GET | /api/v1/billing/subscription | Get org subscription |
| POST | /api/v1/billing/subscribe | Start subscription (trial) |
| POST | /api/v1/billing/cancel | Cancel subscription |
| GET | /api/v1/billing/usage | Usage summary for org |

### Security

- Subscription management requires org admin/owner role
- Usage records scoped to org
- Billing events are idempotent (unique key constraint)
- No payment card data stored in DeOrch
- External payment provider integration deferred

### Payment Provider Integration (Deferred)

The billing domain is provider-independent. To integrate Stripe:
1. Create `services/stripe_adapter.py` implementing a `PaymentProvider` interface
2. Handle webhook events (subscription.created, invoice.paid, etc.)
3. Map Stripe subscription states to DeOrch subscription states
4. Validate webhook signatures
5. Never trust client-submitted payment status
