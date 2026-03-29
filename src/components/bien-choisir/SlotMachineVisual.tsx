import Image from 'next/image';

const MACHINE_GIF_SRC = '/image/choisirsacolo/gif_choisirsacolo/machine%202.gif';

export function SlotMachineVisual() {
  return (
    <div className="w-full max-w-[440px]">
      <Image
        src={MACHINE_GIF_SRC}
        alt="Machine Choisir sa Colo"
        width={985}
        height={651}
        className="h-auto w-full"
        unoptimized
        priority
      />
    </div>
  );
}
