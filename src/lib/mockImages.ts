type UnsplashImage = {
  /** Unsplash photo id (the part after /photo-... in the URL) */
  id: string;
  /** Optional default alt text (French) */
  alt: string;
};

function unsplashUrl(id: string, width: number, quality = 80) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=${quality}`;
}

/**
 * Images mock cohérentes avec la position sur le site.
 * Objectif: une DA homogène (enfants/activités/nature) plutôt que des photos aléatoires.
 */
export const mockImages = {
  home: {
    hero: {
      id: 'photo-1503454537195-1dcabb73ffb9',
      alt: 'Enfants heureux en colonie de vacances'
    } satisfies UnsplashImage,
    thematiques: {
      id: 'photo-1578198576814-8f1dff252730',
      alt: 'Enfants en activité de colonie'
    } satisfies UnsplashImage
  },
  sejours: {
    hero: {
      id: 'photo-1464822759023-fed622ff2c3b',
      alt: 'Paysage de montagne, aventure en nature'
    } satisfies UnsplashImage,
    fallbackCover: {
      id: 'photo-1506929562872-bb421503ef21',
      alt: 'Aventure en nature'
    } satisfies UnsplashImage,
    gallery: [
      { id: 'photo-1506929562872-bb421503ef21', alt: 'Aventure en nature' },
      { id: 'photo-1528543606781-2f6e6857f318', alt: 'Activités en plein air' },
      { id: 'photo-1503454537195-1dcabb73ffb9', alt: 'Vie en colonie' }
    ] satisfies UnsplashImage[]
  },
  sampleStays: [
    { id: 'photo-1500530855697-b586d89ba3ee', alt: 'Séjour nature en forêt' },
    { id: 'photo-1500534314209-a25ddb2bd429', alt: 'Randonnée en montagne' },
    { id: 'photo-1470229722913-7c0e2dbbafd3', alt: 'Activité et découverte' }
  ] satisfies UnsplashImage[]
} as const;

export function getMockImageUrl(image: UnsplashImage, width: number, quality?: number) {
  return unsplashUrl(image.id, width, quality);
}

