'use client';

import NextImage, { type ImageProps } from 'next/image';
import { useState } from 'react';

/** Les images Thalie sont accessibles au navigateur mais refusées par l'optimiseur Vercel. */
export default function StayImage({ src, unoptimized, onError, quality, ...props }: ImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps['src'] | null>(null);
  const isThalie = typeof src === 'string' && /^https?:\/\/(?:www\.)?thalie\.eu\//i.test(src);
  const resolvedSrc = isThalie ? (src as string).replace(/^http:/i, 'https:') : src;
  const loadDirectly = Boolean(unoptimized || isThalie || failedSource === src);

  return (
    <NextImage
      {...props}
      src={resolvedSrc}
      unoptimized={loadDirectly}
      quality={loadDirectly ? undefined : quality}
      onError={(event) => {
        if (!loadDirectly) setFailedSource(src);
        onError?.(event);
      }}
    />
  );
}
