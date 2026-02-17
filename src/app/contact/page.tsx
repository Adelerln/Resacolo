'use client';

import { FormEvent, useState } from 'react';
import { User, Headset, Home, Flag, Key, ChevronDown } from 'lucide-react';

const BLUE = '#3B82F6';
const ORANGE = '#F97316';

const recipients = [
  { value: '', label: 'Sélectionner un destinataire' },
  { value: 'organisateur', label: 'Un organisateur de séjour' },
  { value: 'assistance', label: 'Assistance technique ResaColo' }
];

type CaptchaChoice = 'home' | 'flag' | 'key' | null;

export default function ContactPage() {
  const [recipient, setRecipient] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [captcha, setCaptcha] = useState<CaptchaChoice>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const captchaValid = captcha === 'flag';

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!captchaValid) {
      setErrorMessage('Veuillez sélectionner Le Drapeau pour prouver que vous n\'êtes pas un robot.');
      return;
    }
    setStatus('loading');
    setErrorMessage(null);
    try {
      // Placeholder: replace with your API or Supabase
      await new Promise((r) => setTimeout(r, 800));
      setStatus('success');
      setRecipient('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setMessage('');
      setCaptcha(null);
    } catch (err) {
      setStatus('error');
      setErrorMessage('L\'envoi a échoué. Veuillez réessayer.');
    }
  };

  const inputClass =
    'w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20';

  return (
    <div className="min-h-screen bg-white">
      {/* Section 1: Header */}
      <section
        className="border-b border-slate-100 px-4 py-16 sm:px-6 md:py-20"
        style={{ backgroundColor: '#F9FAFB' }}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
          <div className="flex-1 lg:max-w-[60%]">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Assistance
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              Contactez-<span style={{ color: ORANGE }}>nous</span>
            </h1>
            <p className="mt-6 max-w-xl leading-relaxed text-slate-600">
              Pour toute question ou précision sur une colonie de vacances ou un séjour, vous pouvez
              solliciter directement son organisateur.
            </p>
          </div>
          <div className="flex flex-shrink-0 justify-center gap-6 sm:gap-8 lg:max-w-[40%]">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-md sm:h-32 sm:w-32">
              <User className="h-10 w-10 sm:h-12 sm:w-12" style={{ color: ORANGE }} />
              <span
                className="absolute -right-0.5 -top-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: ORANGE, color: 'white' }}
                aria-hidden
              >
                ?
              </span>
            </div>
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-md sm:h-32 sm:w-32">
              <Headset className="h-10 w-10 sm:h-12 sm:w-12" style={{ color: ORANGE }} />
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Contact Form */}
      <section className="px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-center font-display text-2xl font-bold text-slate-900 sm:text-3xl">
              <span style={{ color: BLUE }}>Formulaire</span> de contact
            </h2>
            <p className="mt-4 text-center text-slate-600 text-sm leading-relaxed">
              Vous souhaitez contacter un organisateur ou joindre notre assistance technique,
              <br />
              Complétez les champs ci-dessous et envoyez votre demande.
              <br />
              Nous vous répondrons dans les plus brefs délais.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-8">
              {/* Step 1: Recipient */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  1. Choisissez un destinataire *
                </label>
                <div className="relative">
                  <select
                    required
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className={`${inputClass} appearance-none pr-10`}
                  >
                    {recipients.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* Step 2: Personal Info */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  2. Renseignez vos informations *
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="text"
                    required
                    placeholder="Prénom*"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    required
                    placeholder="Nom*"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="email"
                    required
                    placeholder="Email*"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="tel"
                    placeholder="Téléphone (facultatif)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Step 3: Message */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  3. Rédigez votre message *
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="Précisez votre demande : nom du séjour, saison, date de départ..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`${inputClass} min-h-[120px] resize-y`}
                />
              </div>

              {/* Visual Captcha */}
              <div>
                <p className="mb-3 text-sm text-slate-700">
                  Veuillez prouver que vous n&apos;êtes pas un robot en sélectionnant{' '}
                  <span className="font-semibold" style={{ color: BLUE }}>
                    Le Drapeau
                  </span>
                  .
                </p>
                <div className="flex gap-4">
                  {[
                    { id: 'home' as const, Icon: Home, label: 'Maison' },
                    { id: 'flag' as const, Icon: Flag, label: 'Drapeau' },
                    { id: 'key' as const, Icon: Key, label: 'Clé' }
                  ].map(({ id, Icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCaptcha(id)}
                      className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border-2 transition sm:h-16 sm:w-16 ${
                        captcha === id
                          ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      aria-label={label}
                    >
                      <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-slate-500" />
                    </button>
                  ))}
                </div>
              </div>

              {errorMessage && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
              )}
              {status === 'success' && (
                <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                  Merci ! Votre message a bien été envoyé.
                </p>
              )}

              {/* Footer Action */}
              <div className="flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">* obligatoire</p>
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full rounded-xl px-8 py-4 font-semibold uppercase tracking-wide text-white shadow-md transition hover:opacity-95 disabled:opacity-70 sm:w-auto"
                  style={{ backgroundColor: ORANGE }}
                >
                  {status === 'loading' ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
