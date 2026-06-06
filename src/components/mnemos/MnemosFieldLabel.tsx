import { mnemosLabel } from '@/lib/mnemos-display';

type MnemosFieldLabelProps = {
  children: string;
  className?: string;
};

export function MnemosFieldLabel({ children, className }: MnemosFieldLabelProps) {
  return <span className={className}>{mnemosLabel(children)}</span>;
}

type MnemosDtProps = {
  children: string;
  className?: string;
};

export function MnemosDt({ children, className }: MnemosDtProps) {
  return <dt className={className}>{mnemosLabel(children)}</dt>;
}
