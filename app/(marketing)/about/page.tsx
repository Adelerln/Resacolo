import { Section } from "@/components/shared/Section";
import { siteContent } from "@/lib/content";

const milestones = [
  { year: "2021", title: "Prototype", description: "We sketched the first mosaic layouts for internal launch pages." },
  { year: "2022", title: "Beta", description: "Design partners shipped 40+ campaigns with adaptive grids and motion." },
  { year: "2023", title: "Scale", description: "Introduced automation, analytics overlays, and enterprise governance." },
  { year: "2024", title: "Global", description: "MosaicFlow powers product storytelling across 26 markets." }
];

export default function AboutPage() {
  return (
    <div className="space-y-24">
      <Section
        eyebrow="Our story"
        title="Designing the marketing OS for teams who lead with motion"
        description={siteContent.valueProp}
      >
        <div className="grid gap-10 lg:grid-cols-2">
          <p className="text-base text-muted-foreground">
            MosaicFlow began as an internal toolkit for our launch engineers. We needed something flexible enough to create
            cinematic hero moments, but strict enough to keep legal and localization in sync. The result is a platform that
            lets creative teams compose, orchestrate, and measure every pixel of their story.
          </p>
          <div className="rounded-3xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
            <p className="mb-4 text-sm uppercase tracking-[0.28em] text-accent/80">We believe in</p>
            <ul className="space-y-3">
              <li>• Crafting with clarity and motion.</li>
              <li>• Shipping faster with thoughtful guardrails.</li>
              <li>• Building transparent roadmaps with customers.</li>
            </ul>
          </div>
        </div>
      </Section>
      <Section eyebrow="Milestones" title="From prototype to platform">
        <div className="grid gap-8 md:grid-cols-2">
          {milestones.map((milestone) => (
            <div key={milestone.year} className="rounded-3xl border border-border/50 bg-card/70 p-6">
              <p className="text-xs uppercase tracking-[0.32em] text-accent/60">{milestone.year}</p>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{milestone.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{milestone.description}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
