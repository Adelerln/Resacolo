import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Source assistant ${id} | Resacolo`,
    description: "Source consultée par l'assistant Resacolo."
  };
}

export default async function AssistantSourcePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = getServerSupabaseClient();

  const { data: document } = await supabase
    .from('rag_documents')
    .select('id,title,source_type,source_ref,source_url,metadata,updated_at')
    .eq('id', id)
    .maybeSingle();

  if (!document) {
    notFound();
  }

  const { data: chunks } = await supabase
    .from('rag_chunks')
    .select('chunk_index,content')
    .eq('document_id', document.id)
    .order('chunk_index', { ascending: true });

  return (
    <div className="section-container py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assistant source</p>
          <h1 className="text-2xl font-semibold text-slate-900">{document.title}</h1>
          <p className="text-sm text-slate-600">
            Type: <strong>{document.source_type}</strong> · Réf: <code>{document.source_ref}</code>
          </p>
          <p className="text-sm text-slate-600">
            Dernière indexation: {new Date(document.updated_at).toLocaleString('fr-FR')}
          </p>
          {document.source_url ? (
            <Link href={document.source_url} className="text-sm font-medium text-brand-700 underline">
              Ouvrir la page d’origine
            </Link>
          ) : null}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Métadonnées</h2>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(document.metadata ?? {}, null, 2)}
          </pre>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Extraits indexés</h2>
          <div className="mt-4 space-y-4">
            {(chunks ?? []).map((chunk) => (
              <article key={chunk.chunk_index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Extrait {chunk.chunk_index + 1}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{chunk.content}</p>
              </article>
            ))}
            {(chunks ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">Aucun extrait disponible pour cette source.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
