// Helper function for retry logic - handles various transient network errors
export async function withRetry<T>(
  fn: () => PromiseLike<T> | T,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await Promise.resolve(fn());
  } catch (error: any) {
    const errorMessage = error?.message?.toLowerCase?.() || String(error).toLowerCase();
    
    // Check for retryable errors
    const isRetryable = 
      retries > 0 && (
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('connect timeout') ||
        errorMessage.includes('und_err_connect_timeout') ||
        errorMessage.includes('networkerror') ||
        errorMessage.includes('network error') ||
        errorMessage.includes('econnrefused') ||
        errorMessage.includes('etimedout') ||
        errorMessage.includes('socket hang up') ||
        errorMessage.includes('connection reset') ||
        errorMessage.includes('connection refused') ||
        error?.code === 'ECONNRESET' ||
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'UND_ERR_CONNECT_TIMEOUT'
      );
    
    if (!isRetryable) {
      throw error;
    }
    
    console.log(`[withRetry] Retrying after ${delay}ms... (${retries} attempts left). Error: ${errorMessage.substring(0, 100)}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 1.5); // Less aggressive backoff
  }
}
