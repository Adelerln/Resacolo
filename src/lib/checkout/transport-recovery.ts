type Transport = {
  stay_id: string | null;
  session_id: string | null;
  departure_city: string | null;
  return_city: string | null;
};

function cityKey(value: string | null): string {
  const parts = (value ?? '').trim().toLocaleLowerCase('fr').split('→')
    .map((part) => part.trim().replace(/\s+/g, ' '));
  // Certains anciens imports répètent « Paris → Paris » dans le champ ville.
  return parts.every((part) => part === parts[0]) ? parts[0] : parts.join(' → ');
}

export function findReplacementTransport<T extends Transport>(options: T[], selection: {
  stayId: string;
  sessionId: string;
  departureCity: string | null;
  returnCity: string | null;
  leg: 'roundtrip' | 'outbound' | 'return';
}): T | null {
  const departure = cityKey(selection.departureCity);
  const arrival = cityKey(selection.returnCity);
  if (selection.leg !== 'return' && !departure) return null;
  if (selection.leg !== 'outbound' && !arrival) return null;
  const matches = options.filter((option) =>
    option.stay_id === selection.stayId &&
    (!option.session_id || option.session_id === selection.sessionId) &&
    (selection.leg === 'return' || cityKey(option.departure_city) === departure) &&
    (selection.leg === 'outbound' || cityKey(option.return_city) === arrival)
  );
  return matches.length === 1 ? matches[0] : null;
}
