// lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  onSnapshotsInSync,
  enableNetwork,
  disableNetwork
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { logger } from "./logger";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton pattern to prevent multiple initializations)
let app;
let db;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  
  // CRITICAL: Use initializeFirestore (not getFirestore) to set cache before first use
  // This prevents the deprecation warning about enableMultiTabIndexedDbPersistence
  if (typeof window !== 'undefined') {
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch (error) {
      logger.warn('⚠️ Firebase: Persistence setup failed, using memory cache:', error.message);
      // Don't call getFirestore here - let it fail gracefully
      db = getFirestore(app);
    }
  } else {
    // Server-side: no persistence needed
    db = getFirestore(app);
  }
} else {
  // App already initialized - get existing instances
  app = getApps()[0];
  // CRITICAL: Don't call getFirestore again, it's already initialized
  try {
    db = getFirestore(app);
  } catch (error) {
    logger.error('❌ Failed to get Firestore instance:', error);
  }
}

// Initialize services
export const auth = getAuth(app);
export { db };
export const storage = getStorage(app);

// Initialize App Check (only in browser)
if (typeof window !== 'undefined') {
  // Enable debug token for localhost development
  if (process.env.NODE_ENV === 'development') {
    // @ts-ignore
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  // Initialize App Check with reCAPTCHA v3
  if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
      logger.log('✅ Firebase App Check: Initialized with reCAPTCHA v3');
    } catch (error) {
      logger.warn('⚠️ Firebase App Check: Initialization failed:', error.message);
    }
  } else {
    logger.warn('⚠️ Firebase App Check: NEXT_PUBLIC_RECAPTCHA_SITE_KEY not set');
  }
}

// Connection state monitoring and auto-reconnect
if (typeof window !== 'undefined') {
  let isOnline = navigator.onLine;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 2000;

  // Monitor Firestore sync state
  onSnapshotsInSync(db, () => {
    if (reconnectAttempts > 0) {
      logger.log('✅ Firestore: Reconnected successfully');
      reconnectAttempts = 0;
    }
  });

  // Network state change handler
  const handleOnline = async () => {
    logger.log('🌐 Network: Online detected');
    isOnline = true;
    reconnectAttempts = 0;
    
    try {
      await enableNetwork(db);
      logger.log('✅ Firestore: Network re-enabled');
    } catch (error) {
      logger.error('❌ Firestore: Failed to re-enable network:', error);
    }
  };

  const handleOffline = async () => {
    logger.log('📡 Network: Offline detected');
    isOnline = false;
  };

  // Automatic reconnection with exponential backoff
  const attemptReconnect = async () => {
    if (!isOnline || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    reconnectAttempts++;
    const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
    
    logger.log(`🔄 Firestore: Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await disableNetwork(db);
        await new Promise(resolve => setTimeout(resolve, 500));
        await enableNetwork(db);
        logger.log('✅ Firestore: Reconnection successful');
        reconnectAttempts = 0;
      } catch (error) {
        logger.error('❌ Firestore: Reconnection failed:', error.message);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          attemptReconnect();
        }
      }
    }, delay);
  };

  // Listen for network changes
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Monitor for connection errors and trigger reconnect
  window.addEventListener('error', (event) => {
    if (event.message?.includes('Failed to fetch') || 
        event.message?.includes('NetworkError') ||
        event.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
      logger.warn('⚠️ Network error detected, attempting reconnect...');
      attemptReconnect();
    }
  }, true);
}
