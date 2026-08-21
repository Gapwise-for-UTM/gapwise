import { Check, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import type { Entitlement } from "@/features/entitlements/entitlements";
import { requestEntitlementRefresh } from "@/features/entitlements/use-entitlement";
import { startProCheckout } from "./billing-client";

const expiryFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "long",
  day: "numeric",
});

export type BillingReturnStatus = "success" | "cancelled" | null;

export function BillingPanel({
  entitlement,
  returnStatus,
}: {
  userId: string;
  entitlement: Entitlement;
  returnStatus: BillingReturnStatus;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (returnStatus === "cancelled") {
      setMessage("Checkout was cancelled. Nothing was charged.");
      return;
    }
    if (returnStatus !== "success") return;
    setMessage("Payment received. Confirming Gapwise Pro access…");
    const delays = [0, 800, 2_000, 4_000, 7_000];
    const timers = delays.map((delay) =>
      window.setTimeout(() => requestEntitlementRefresh(), delay),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [returnStatus]);

  useEffect(() => {
    if (returnStatus !== "success" || entitlement.tier !== "free") return;
    const timer = window.setTimeout(() => {
      setMessage(
        "Payment received. Gapwise Pro is still being confirmed. Reopen Plan & billing in a moment if access has not appeared yet.",
      );
    }, 9_000);
    return () => window.clearTimeout(timer);
  }, [entitlement.tier, returnStatus]);

  useEffect(() => {
    if (returnStatus !== "success") return;
    if (entitlement.tier === "pro" || entitlement.tier === "founder") {
      setMessage("Payment confirmed. Gapwise Pro is active.");
    }
  }, [entitlement.tier, returnStatus]);

  async function upgrade() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const url = await startProCheckout();
      window.location.assign(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout is unavailable right now.");
      setBusy(false);
    }
  }

  if (entitlement.tier === "founder") {
    return (
      <section className="rounded-xl border border-accent/25 bg-accent/5 p-4 sm:p-5">
        <p className="text-sm font-semibold">Gapwise Pro · Founder access</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Permanent Pro access is attached to this account. No purchase or renewal is required.
        </p>
      </section>
    );
  }

  if (entitlement.tier === "pro") {
    const parsedExpiry = entitlement.expiresAt ? Date.parse(entitlement.expiresAt) : Number.NaN;
    return (
      <section className="rounded-xl border border-accent/25 bg-accent/5 p-4 sm:p-5">
        <p className="text-sm font-semibold">Gapwise Pro</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {Number.isFinite(parsedExpiry)
            ? `Access through ${expiryFormat.format(new Date(parsedExpiry))}.`
            : "Pro access is active on this account."}
        </p>
        {message ? <p className="mt-3 text-xs font-medium text-accent">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border/70 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/8">
          <CreditCard className="h-4 w-4 text-accent" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Gapwise Pro · Fall 2026</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">CA$9.99</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            One payment for the Fall 2026 pass. No subscription and no automatic renewal.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-sm">
        {[
          "Fit coursework into your real timetable with Build My Plan",
          "Add planned study blocks directly to Today and Timetable",
          "Reschedule, complete, miss, and rebuild work without losing workload history",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {message ? <p className="mt-4 text-xs leading-5 text-muted-foreground">{message}</p> : null}
      <button
        type="button"
        onClick={() => void upgrade()}
        disabled={busy}
        className="button-primary mt-4 min-h-11 w-full px-4 text-sm font-semibold disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Opening secure checkout…" : "Upgrade to Pro · CA$9.99"}
      </button>
      <p className="mt-3 text-[0.7rem] leading-5 text-muted-foreground">
        Payment is handled by Stripe. Gapwise never receives or stores your card number.
      </p>
    </section>
  );
}
