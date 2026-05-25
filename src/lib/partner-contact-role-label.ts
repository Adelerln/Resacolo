export function readPartnerContactRoleLabelFromFormData(formData: FormData) {
  const normalized = String(formData.get('role_label') ?? '').trim();
  return normalized || null;
}
