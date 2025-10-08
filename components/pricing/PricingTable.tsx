"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { pricingContent } from "@/lib/content";
import { cn, formatPriceWithInterval } from "@/lib/utils";
import { fadeInUp, staggerContainer } from "@/lib/animations";

type Interval = "monthly" | "annual";

export function PricingTable() {
  const { plans, featureMatrix, currency, toggle } = pricingContent;
  const [interval, setInterval] = useState<Interval>("monthly");

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-center gap-4 rounded-full border border-border/40 bg-card/60 px-6 py-3 text-sm text-muted-foreground">
        <span>{toggle.monthly}</span>
        <Switch
          checked={interval === "annual"}
          onCheckedChange={(checked) => setInterval(checked ? "annual" : "monthly")}
          aria-label="Toggle pricing interval"
        />
        <span>{toggle.annual}</span>
      </div>

      <motion.div
        variants={staggerContainer(0.16)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="grid gap-6 lg:grid-cols-3"
      >
        {plans.map((plan) => {
          const isPopular = plan.badge != null;
          return (
            <motion.article
              key={plan.id}
              variants={fadeInUp}
              className={cn(
                "relative flex h-full flex-col gap-6 overflow-hidden rounded-3xl border border-border/50 bg-card/70 p-8 backdrop-blur transition hover:border-accent/40",
                isPopular && "border-accent/60 shadow-xl"
              )}
            >
              {isPopular && (
                <span className="absolute right-4 top-4 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-accent">
                  {plan.badge}
                </span>
              )}
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>
              <div>
                <p className="text-4xl font-semibold text-foreground">
                  {formatPriceWithInterval(plan.price[interval], interval, currency)}
                </p>
                {interval === "annual" && plan.price.annual && plan.price.monthly && (
                  <p className="mt-1 text-xs uppercase tracking-[0.24em] text-accent/80">
                    Save {Math.round((1 - plan.price.annual / plan.price.monthly) * 100)}%
                  </p>
                )}
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="mt-auto">
                <Link href={plan.cta.href}>{plan.cta.label}</Link>
              </Button>
            </motion.article>
          );
        })}
      </motion.div>

      <div className="overflow-hidden rounded-3xl border border-border/60">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-card/60 text-muted-foreground">
            <tr>
              <th className="px-6 py-4 text-left font-semibold text-foreground">Compare features</th>
              {plans.map((plan) => (
                <th key={plan.id} className="px-6 py-4 text-left font-semibold text-foreground">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureMatrix.rows.map((row) => (
              <tr key={row.label} className="border-t border-border/40">
                <td className="px-6 py-4 text-muted-foreground">{row.label}</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-6 py-4">
                    {row.plans[plan.id] ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-accent">
                        ✓
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
