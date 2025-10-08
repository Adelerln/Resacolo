import { FeatureCard } from "@/components/features/FeatureCard";
import { MosaicGrid } from "@/components/mosaic/MosaicGrid";
import { Section } from "@/components/shared/Section";
import { homepageContent } from "@/lib/content";

export default function FeaturesPage() {
  const { mosaic, featureSection } = homepageContent;

  return (
    <div className="space-y-24">
      <Section
        eyebrow="Capabilities"
        title="Everything you need to compose cinematic launches"
        description="Combine hero layers, data visuals, automation, and governance in a single interface."
      >
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {featureSection.features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </Section>
      <Section
        eyebrow="Mosaic blueprint"
        title="Reusable patterns for every campaign"
        description="Start from curated sequences or design your own library of launch-ready layouts."
      >
        <MosaicGrid tiles={mosaic.tiles} shuffleInterval={0} />
      </Section>
    </div>
  );
}
