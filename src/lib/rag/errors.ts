function lowerMessage(error: unknown) {
  if (!error) return '';
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const value = (error as { message?: unknown }).message;
    return typeof value === 'string' ? value.toLowerCase() : '';
  }
  return String(error).toLowerCase();
}

export function isRagInfraMissingError(error: unknown) {
  const msg = lowerMessage(error);
  if (!msg) return false;

  return (
    msg.includes('could not find the table') ||
    msg.includes('schema cache') ||
    msg.includes('relation') ||
    msg.includes('does not exist') ||
    msg.includes('chat_sessions') ||
    msg.includes('chat_messages') ||
    msg.includes('chat_events') ||
    msg.includes('rag_documents') ||
    msg.includes('rag_chunks') ||
    msg.includes('rag_embeddings') ||
    msg.includes('rag_index_queue') ||
    msg.includes('match_rag_chunks') ||
    msg.includes('search_rag_chunks')
  );
}
