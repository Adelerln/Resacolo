import Image from 'next/image';

const LOGO_SRC = '/image/choisirsacolo/logos_choisirsacolo/logo-parents-detourre.png';

export function ChoisirSaColoLogo() {
  return (
    <div className="relative h-36 w-36 sm:h-44 sm:w-44">
      <Image
        src={LOGO_SRC}
        alt="Logo ChoisirSaColo.fr"
        fill
        className="object-contain"
        priority
      />
    </div>
  );
}
