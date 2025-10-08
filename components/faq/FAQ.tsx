"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { faqContent } from "@/lib/content";

export function FAQ() {
  return (
    <Accordion type="single" collapsible className="space-y-4">
      {faqContent.items.map((item, index) => (
        <AccordionItem
          key={item.question}
          value={`item-${index}`}
          className="overflow-hidden rounded-2xl border border-border/40 bg-card/70 px-6"
        >
          <AccordionTrigger className="text-left text-base font-medium text-foreground">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="pb-6 text-sm text-muted-foreground">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
