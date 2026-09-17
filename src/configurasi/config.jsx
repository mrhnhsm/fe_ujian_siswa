// src/config/index.js
import axios from "axios";

const BASE_URL = "http://localhost:8080/api"; //BACKEND PHP LOCAL
// const BASE_URL = 'http://127.0.0.1:8000/api'; //Backend Fast API Local
// const BASE_URL = 'https://url/api'; //Production

// Store credentials in memory
let credentials = {
  clientId: null,
  clientSecret: null,
  expiresAt: null,
};

let refreshTimer = null;
let isRefreshing = false;
let refreshPromise = null;

/**
 * Fetch new client credentials from API
 */
async function fetchClientCredentials() {
  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      // tokenUser opsional: kalau ada (mis. suatu saat balik pakai
      // sessionStorage), tetap disertakan. Kalau tidak ada, auth tetap
      // jalan lewat cookie (withCredentials di bawah).
      const tokenUser = sessionStorage.getItem("tokenUser");

      const response = await axios.get(
        `${BASE_URL}/auth/generate-credentials`,
        {
          withCredentials: true,
          headers: tokenUser ? { Authorization: `Bearer ${tokenUser}` } : {},
        },
      );

      if (response.data) {
        const { client_id, client_secret, expires_in } = response?.data?.data;

        // Store credentials
        credentials.clientId = client_id;
        credentials.clientSecret = client_secret;

        // Set expiration time (current time + expires_in seconds)
        credentials.expiresAt = Date.now() + expires_in * 1000;

        // Schedule refresh after 4 minutes (240 seconds)
        // This ensures refresh happens before 5-minute expiration
        scheduleCredentialsRefresh(240);

        return true;
      } else {
        return false;
      }
    } catch (error) {
      // Retry after 30 seconds if failed
      scheduleCredentialsRefresh(30);
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Schedule automatic credentials refresh
 * @param {number} delayInSeconds - Delay before refresh in seconds
 */
function scheduleCredentialsRefresh(delayInSeconds) {
  // Clear existing timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  // Schedule new refresh
  refreshTimer = setTimeout(async () => {
    try {
      await fetchClientCredentials();
    } catch (error) {
      // Silent fail
    }
  }, delayInSeconds * 1000);
}

/**
 * Get current client ID (with auto-refresh if expired)
 */
async function getClientId() {
  // If credentials are expired or about to expire (less than 30 seconds remaining)
  if (!credentials.clientId || Date.now() >= credentials.expiresAt - 30000) {
    await fetchClientCredentials();
  }
  return credentials.clientId;
}

/**
 * Get current client secret (with auto-refresh if expired)
 */
async function getClientSecret() {
  // If credentials are expired or about to expire (less than 30 seconds remaining)
  if (
    !credentials.clientSecret ||
    Date.now() >= credentials.expiresAt - 30000
  ) {
    await fetchClientCredentials();
  }
  return credentials.clientSecret;
}

/**
 * Get both credentials at once (with auto-refresh if expired)
 */
async function getCredentials() {
  // If credentials are expired or about to expire (less than 30 seconds remaining)
  if (
    !credentials.clientId ||
    !credentials.clientSecret ||
    Date.now() >= credentials.expiresAt - 30000
  ) {
    await fetchClientCredentials();
  }
  return {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
  };
}

/**
 * Initialize credentials - call this on app start
 */
async function initializeCredentials() {
  try {
    await fetchClientCredentials();
    return true;
  } catch (error) {
    // Retry initialization after 10 seconds
    setTimeout(() => {
      initializeCredentials();
    }, 10000);
    return false;
  }
}

/**
 * Check if credentials are valid
 */
function isCredentialsValid() {
  return (
    credentials.clientId &&
    credentials.clientSecret &&
    credentials.expiresAt &&
    Date.now() < credentials.expiresAt - 30000
  ); // Valid if more than 30 seconds remaining
}

/**
 * Get time remaining until expiration (in seconds)
 */
function getTimeUntilExpiration() {
  if (!credentials.expiresAt) return 0;
  return Math.max(0, Math.floor((credentials.expiresAt - Date.now()) / 1000));
}

/**
 * Clear credentials and stop auto-refresh
 */
function clearCredentials() {
  credentials.clientId = null;
  credentials.clientSecret = null;
  credentials.expiresAt = null;

  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

const configurasi = {
  BASE_URL,
  getClientId,
  getClientSecret,
  getCredentials,
  initializeCredentials,
  fetchClientCredentials,
  isCredentialsValid,
  getTimeUntilExpiration,
  clearCredentials,
};

export default configurasi;
