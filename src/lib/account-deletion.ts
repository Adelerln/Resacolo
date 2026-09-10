export const ACCOUNT_DELETION_STATUS_VALUES = ['pending', 'processed', 'rejected'] as const;

export type AccountDeletionStatus = (typeof ACCOUNT_DELETION_STATUS_VALUES)[number];

export const ACCOUNT_DELETION_STATUS_LABELS: Record<AccountDeletionStatus, string> = {
  pending: 'En attente',
  processed: 'Traité',
  rejected: 'Refusé'
};

export function isAccountDeletionStatus(value: string): value is AccountDeletionStatus {
  return (ACCOUNT_DELETION_STATUS_VALUES as readonly string[]).includes(value);
}

export type AccountDeletionRequest = {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  email: string;
  fullName: string;
  reason: string;
  status: AccountDeletionStatus;
  notes: string;
  processedAt: string | null;
  processedBy: string | null;
};
