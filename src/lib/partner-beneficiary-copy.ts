export function formatNoPaymentAsBeneficiaryMessage(partnerName: string | null | undefined) {
  const name = partnerName?.trim();
  if (name) {
    return `Aucun règlement requis en tant qu'ayant-droit de ${name}`;
  }
  return "Aucun règlement requis en tant qu'ayant-droit";
}
