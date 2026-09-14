export type InquiryRow = {
  id: string;
  inquiry_type: string;
  status: string;
  subject: string | null;
  message: string;
  source?: string | null;
  organizer_id?: string | null;
  assigned_to_user_id?: string | null;
  created_at: string;
  updated_at?: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  contact_email?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  internal_notes?: string | null;
};

export function buildContactInquiryInsert(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  message: string;
}) {
  return {
    inquiry_type: 'GENERAL',
    status: 'NEW',
    source: 'CONTACT_FORM',
    email: input.email,
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone?.trim() || null,
    subject: 'Demande de contact depuis le formulaire public',
    message: input.message,
    organizer_id: null
  };
}

export function buildChatbotHandoffInquiryInsert(input: {
  contactEmail: string;
  contactName?: string | null;
  subject: string;
  message: string;
}) {
  const fullName = input.contactName?.trim() ?? '';
  const [firstName, ...lastParts] = fullName.split(/\s+/).filter(Boolean);
  const lastName = lastParts.join(' ');

  return {
    inquiry_type: 'GENERAL',
    status: 'NEW',
    source: 'PLATFORM',
    email: input.contactEmail,
    first_name: firstName || null,
    last_name: lastName || null,
    phone: null,
    subject: input.subject,
    message: input.message
  };
}

export function formatInquiryContact(row: InquiryRow) {
  const nameFromParts = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  const name = row.contact_name?.trim() || nameFromParts || null;
  const email = row.contact_email?.trim() || row.email?.trim() || '';
  const phone = row.contact_phone?.trim() || row.phone?.trim() || null;
  return { name, email, phone };
}
