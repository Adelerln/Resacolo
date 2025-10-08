import { ContactForm } from "@/components/forms/ContactForm";
import { Section } from "@/components/shared/Section";
import { CONTACT_EMAIL, VALUE_PROP } from "@/lib/constants";

export default function ContactPage() {
  return (
    <Section eyebrow="Let’s talk" title="Plan your next launch with MosaicFlow" description={VALUE_PROP}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Tell us about your campaign goals, audience, and launch timeline. We’ll turn that into a guided onboarding plan with
            recommended sections, automations, and motion presets.
          </p>
          <p>
            Prefer email? Reach us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent">{CONTACT_EMAIL}</a>.
          </p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-card/80 p-8 shadow-lg backdrop-blur">
          <ContactForm />
        </div>
      </div>
    </Section>
  );
}
