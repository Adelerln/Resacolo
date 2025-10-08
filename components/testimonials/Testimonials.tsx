"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { testimonialsContent } from "@/lib/content";
import { fadeIn, fadeInUp } from "@/lib/animations";

const ROTATION_INTERVAL = 6000;

export function Testimonials() {
  const testimonials = testimonialsContent.items;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex((index) => (index + 1) % testimonials.length);
    }, ROTATION_INTERVAL);
    return () => clearInterval(id);
  }, [testimonials.length]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-10 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 pb-6">
        {testimonials.map((testimonial, index) => (
          <button
            key={testimonial.name}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="flex items-center gap-2 rounded-full border border-transparent px-3 py-1 text-xs uppercase tracking-[0.32em] text-muted-foreground transition hover:text-foreground"
            aria-pressed={index === activeIndex}
          >
            <span className="relative h-8 w-8 overflow-hidden rounded-full">
              <Image src={testimonial.avatar} alt={testimonial.name} fill className="object-cover" />
            </span>
            {testimonial.company}
          </button>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-[0.35fr_1fr] md:items-start">
        <AnimatePresence mode="popLayout" initial={false}>
          {testimonials.map((testimonial, index) =>
            index === activeIndex ? (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6 md:col-span-2"
              >
                <motion.blockquote
                  variants={fadeIn}
                  initial="hidden"
                  animate="show"
                  className="text-balance text-2xl font-medium leading-relaxed text-foreground"
                >
                  “{testimonial.quote}”
                </motion.blockquote>
                <motion.footer variants={fadeInUp} initial="hidden" animate="show" className="flex items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-full">
                    <Image src={testimonial.avatar} alt={testimonial.name} fill className="object-cover" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {testimonial.role}, {testimonial.company}
                    </p>
                  </div>
                </motion.footer>
              </motion.div>
            ) : null
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
