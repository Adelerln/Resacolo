import Image from "next/image";
import { Container } from "@/components/shared/Container";
import logosJson from "@/content/logos.json" assert { type: "json" };

export function LogoMarquee({ title }: { title?: string }) {
  const logos = logosJson.items ?? [];
  const duplicated = [...logos, ...logos];

  return (
    <section className="relative py-16">
      <Container className="space-y-10">
        {title && <p className="text-center text-sm uppercase tracking-[0.32em] text-muted-foreground">{title}</p>}
        <div className="group relative overflow-hidden">
          <div className="animate-marquee flex min-w-max gap-12" aria-hidden>
            {duplicated.map((logo, index) => (
              <div
                key={`${logo.src}-${index}`}
                className="flex h-16 w-40 items-center justify-center rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur transition-colors group-hover:border-border"
              >
                <Image src={logo.src} alt={logo.name} width={120} height={36} className="h-auto w-full" />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
