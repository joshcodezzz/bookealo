import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";

export type LegalSection = { title: string; body: ReactNode };

/** Plantilla común de las páginas legales: título, fecha y secciones numeradas. */
export function LegalPage({
  title,
  subtitle,
  updated,
  sections,
}: {
  title: string;
  subtitle: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader eyebrow="Legal" title={title} subtitle={subtitle} />
      <p className="-mt-6 mb-10 text-[13px] text-[#86868b]">Última actualización: {updated}</p>
      <div className="space-y-9">
        {sections.map((section, index) => (
          <section key={section.title} aria-labelledby={`legal-${index}`}>
            <h2
              id={`legal-${index}`}
              className="text-[21px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#f5f5f7]"
            >
              {index + 1}. {section.title}
            </h2>
            <div className="mt-3 space-y-3 text-[16px] leading-[1.55] text-[#f5f5f7]/80 [&_a]:text-[#2997ff] [&_a:hover]:underline [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
              {section.body}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
