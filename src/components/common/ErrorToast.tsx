'use client';

import FlashToast from '@/components/common/FlashToast';

type ErrorToastProps = {
  message: string;
  clearParams?: string[];
};

export default function ErrorToast({ message, clearParams }: ErrorToastProps) {
  return <FlashToast message={message} variant="error" clearParams={clearParams ?? ['error']} />;
}
