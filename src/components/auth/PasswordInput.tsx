'use client';

import { useId, useState, type ComponentPropsWithoutRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export type PasswordInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'className'> & {
  /** Conteneur autour du champ (bouton œil inclus). */
  className?: string;
  /** Classes appliquées au `<input>`. */
  inputClassName?: string;
};

export function PasswordInput({
  className,
  inputClassName,
  autoComplete = 'current-password',
  ...rest
}: PasswordInputProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      <div className="relative">
        <input
          {...rest}
          id={id}
          type={visible ? 'text' : 'password'}
          className={inputClassName}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

