"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/Container";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import { HeroBackground } from "@/components/hero/HeroBackground";

type HeroMetric = {
  label: string;
  value: string;
};

type HeroProps = {
  badge: string;
  title: string;
  subtitle: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  metrics: HeroMetric[];
};

export function Hero({ badge, title, subtitle, primaryCta, secondaryCta, metrics }: HeroProps) {
  const { scrollYProgress } = useScroll({ offset: ["start start", "end start"] });
  const translateY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  return (
    <section className="relative overflow-hidden py-28 md:py-[8.5rem]">
      <HeroBackground />
      <div className="noise-overlay" aria-hidden />
      <Container className="relative grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <motion.div variants={staggerContainer(0.12)} initial="hidden" animate="show" className="space-y-8">
          <motion.span
            variants={fadeInUp}
            className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-accent"
          >
            {badge}
          </motion.span>
          <motion.h1 variants={fadeInUp} className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">
            {title}
          </motion.h1>
          <motion.p variants={fadeInUp} className="max-w-2xl text-lg text-muted-foreground">
            {subtitle}
          </motion.p>
          <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link href={primaryCta.href}>{primaryCta.label}</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="border border-border/80 bg-transparent text-foreground">
              <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          style={{ translateY }}
          className="relative hidden min-h-[320px] rounded-3xl border border-border/40 bg-card/70 p-8 shadow-2xl backdrop-blur md:flex"
        >
          <div className="absolute inset-0 rounded-3xl border border-border/30" aria-hidden />
          <div className="relative flex w-full flex-col justify-between">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.42em] text-accent/60">Ce qui arrive</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Préparez-vous à composer des surfaces mosaïque avec des presets motion, des déclencheurs de données et une orchestration collaborative.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-border/40 bg-background/70 p-4 text-sm text-muted-foreground">
                    <p className="text-xs uppercase tracking-[0.28em]">{metric.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-foreground">{metric.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-accent">
                <p className="text-xs uppercase tracking-[0.28em]">Prochaine étape</p>
                <p className="mt-3 text-base text-accent-foreground/80">Validation des premiers comptes et ateliers de prise en main.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
