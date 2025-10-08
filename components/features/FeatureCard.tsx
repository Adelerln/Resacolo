"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { type LucideIcon, Sparkles, Gauge, Layout, Workflow, Shield, Cloud } from "lucide-react";

const iconMap = new Map<string, LucideIcon>([
  ["sparkles", Sparkles],
  ["gauge", Gauge],
  ["layout", Layout],
  ["workflow", Workflow],
  ["shield", Shield],
  ["cloud", Cloud],
]);

type FeatureCardProps = {
  icon: string;
  title: string;
  description: string;
  href: string;
  className?: string;
};

export function FeatureCard({ icon, title, description, href, className }: FeatureCardProps) {
  const Icon = iconMap.get(icon) ?? Sparkles;

  return (
    <motion.article
      variants={fadeInUp}
      className={cn(
        "group relative flex h-full flex-col gap-4 rounded-3xl border border-border/50 bg-card/70 p-8 backdrop-blur transition-colors hover:border-accent/40",
        className
      )}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border/40 bg-background/70 text-accent">
        <Icon className="h-5 w-5" />
      </span>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Link href={href} className="mt-auto inline-flex items-center gap-2 text-sm text-accent">
        Learn more
        <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
      </Link>
    </motion.article>
  );
}
