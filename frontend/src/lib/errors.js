// Turning a failed request into something worth reading.
//
// The server's own messages are already written for the reader, so they are
// shown as-is. What this adds is the cases the server never gets to answer:
// the network was down, the request timed out, the session ended. Those used
// to surface as "Failed to load data" or, worse, advice to check whether a
// backend was running -- which is not a sentence a teacher should ever meet.

const GENERIC = "Something went wrong. Please try again.";

export function friendlyError(error, fallback = GENERIC) {
  if (!error) return fallback;

  // No response at all: the request never reached the server.
  if (!error.response) {
    if (error.code === "ECONNABORTED") {
      return "That took too long to respond. Please check your connection and try again.";
    }
    return "You appear to be offline. Check your connection and try again.";
  }

  const { status, data } = error.response;

  // The server explains itself in plain language; pass it through.
  if (typeof data?.detail === "string" && data.detail.trim()) {
    return data.detail;
  }

  switch (status) {
    case 401:
      return "Your session has ended. Please sign in again.";
    case 403:
      return "You do not have permission to do this.";
    case 404:
      return "That is no longer available.";
    case 413:
      return "That file is too large.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    default:
      return status >= 500
        ? "Something went wrong at our end. Please try again shortly."
        : fallback;
  }
}

export default friendlyError;
