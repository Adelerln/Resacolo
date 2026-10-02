'use client';

import FlashToast from '@/components/common/FlashToast';

type SavedToastProps = {
  message: string;
  clearParams?: string[];
};

export default function SavedToast({ message, clearParams }: SavedToastProps) {
  return <FlashToast message={message} variant="success" clearParams={clearParams} />;
}
