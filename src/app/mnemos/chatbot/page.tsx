import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${(value * 100).toFixed(1)}%`;
}

export default async function MnemosChatbotPage() {
  const supabase = getServerSupabaseClient();

  const { data: events } = await supabase
    .from('chat_events')
    .select('event_type,payload,created_at')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(5000);

  const totalEvents = events?.length ?? 0;
  const opened = (events ?? []).filter((event) => event.event_type === 'chat_opened').length;
  const sent = (events ?? []).filter((event) => event.event_type === 'message_sent').length;
  const rendered = (events ?? []).filter((event) => event.event_type === 'answer_rendered').length;
  const citationClicks = (events ?? []).filter((event) => event.event_type === 'citation_clicked').length;
  const handoffs = (events ?? []).filter((event) => event.event_type === 'handoff_triggered').length;
  const ctr = rendered > 0 ? citationClicks / rendered : 0;

  const clicksByUrl = new Map<string, number>();
  for (const event of events ?? []) {
    if (event.event_type !== 'citation_clicked') continue;
    const payload =
      event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
        ? (event.payload as Record<string, unknown>)
        : {};
    const url = typeof payload.url === 'string' ? payload.url : '';
    if (!url) continue;
    clicksByUrl.set(url, (clicksByUrl.get(url) ?? 0) + 1);
  }
  const topUrls = Array.from(clicksByUrl.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Chatbot public</h1>
        <p className="mt-1 text-sm text-slate-400">
          Suivi des 30 derniers jours ({totalEvents} événements).
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Ouvertures', value: opened },
          { label: 'Questions', value: sent },
          { label: 'Réponses', value: rendered },
          { label: 'Clics citations', value: citationClicks },
          { label: 'Handoffs', value: handoffs }
        ].map((metric) => (
          <article
            key={metric.label}
            className="rounded-xl border border-violet-900/50 bg-slate-900/70 px-4 py-3"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-violet-200">{metric.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-violet-900/50 bg-slate-900/70 p-4">
        <h2 className="text-lg font-semibold text-white">CTR vers fiches</h2>
        <p className="mt-1 text-sm text-slate-400">
          Clics citations / réponses rendues: <strong className="text-violet-200">{formatPercent(ctr)}</strong>
        </p>
      </section>

      <section className="rounded-2xl border border-violet-900/50 bg-slate-900/70 p-4">
        <h2 className="text-lg font-semibold text-white">Top URLs cliquées</h2>
        {topUrls.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Aucun clic enregistré.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {topUrls.map(([url, count]) => (
              <li key={url} className="rounded-lg border border-violet-900/30 bg-slate-950/60 px-3 py-2">
                <p className="font-medium text-slate-100">{url}</p>
                <p className="text-xs text-slate-400">{count} clic(s)</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
