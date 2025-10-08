import { FAQ } from "@/components/faq/FAQ";
import { PricingTable } from "@/components/pricing/PricingTable";
import { Section } from "@/components/shared/Section";
import { CONTACT_EMAIL } from "@/lib/constants";

export default function PricingPage() {
  return (
    <div className="space-y-24">
      <Section
        eyebrow="Plans"
        title="Flexible pricing for teams of every size"
        description="Choose a plan that matches your launch velocity. Switch plans anytime, or talk to us for custom requirements."
      >
        <PricingTable />
      </Section>
      <Section
        eyebrow="Questions"
        title="FAQ"
        description="Can’t find the answer you’re looking for? Email us at"
        actions={<a href={`mailto:${CONTACT_EMAIL}`} className="text-accent">{CONTACT_EMAIL}</a>}
      >
        <FAQ />
      </Section>
    </div>
  );
}
