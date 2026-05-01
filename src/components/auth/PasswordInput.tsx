'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordInputProps = {
  name: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
};

export function PasswordInput({ name, required, className, inputClassName }: PasswordInputProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          required={required}
          className={inputClassName}
          autoComplete="current-password"
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

