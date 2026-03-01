# Firestore Connection Troubleshooting

This guide helps resolve common Firestore connection issues including ad blocker interference, network errors, and offline persistence problems.

## Quick Diagnosis

Run this in your browser console to check Firebase status:

```javascript
// Check Firestore cache status
console.log('Cache enabled:', typeof indexedDB !== 'undefined');

// Check network status
console.log('Browser online:', navigator.onLine);

// Test Firestore connection
import { db } from './src/lib/firebase.js';
import { collection, query, limit, getDocs } from 'firebase/firestore';

getDocs(query(collection(db, 'users'), limit(1)))
  .then(() => console.log('✅ Firestore connected'))
  .catch(err => console.error('❌ Firestore error:', err.code, err.message));
```

## Common Error Codes

### ERR_BLOCKED_BY_CLIENT

**Cause:** Browser extension (usually ad blocker) blocking Firebase domains

**Solution:**

1. **Disable ad blocker** for your app domain:
   - uBlock Origin: Click icon → Click power button → Refresh page
   - AdBlock Plus: Click icon → "Enabled on this site" toggle
   - Brave Browser: Shield icon → "Shields down for this site"

2. **Whitelist Firebase domains** in ad blocker settings:
   ```
   firestore.googleapis.com
   firebaseinstallations.googleapis.com
   firebasestorage.googleapis.com
   [your-project].firebaseapp.com
   ```

3. **Check browser extensions** that might interfere:
   - Privacy Badger
   - Ghostery
   - NoScript
   - Disconnect
   - Any "tracker blocker" extension

### ERR_NETWORK_IO_SUSPENDED / ERR_INTERNET_DISCONNECTED

**Cause:** Network connection lost or browser went into power-saving mode

**Solution:**

1. **Check internet connection**
   - Verify WiFi/Ethernet is connected
   - Try opening another website

2. **Browser power-saving mode** (common on laptops):
   - Close/reopen browser tab
   - Disable battery saver mode
   - Check browser flags: `chrome://flags/#network-service-in-process`

3. **VPN interference**:
   - Temporarily disable VPN
   - Add Firebase domains to VPN split tunnel

4. **Firewall/Antivirus**:
   - Check if firewall is blocking WebSocket connections
   - Add exception for Firebase domains

### ERR_FAILED_PRECONDITION

**Cause:** Multiple tabs trying to enable persistence simultaneously (fixed in v12.4.0+)

**Solution:**
- Already fixed in our new implementation using `persistentMultipleTabManager()`
- If you see this, clear browser cache and reload

## Auto-Reconnection Features

The app now includes automatic reconnection:

### Automatic Features
- ✅ Detects network online/offline events
- ✅ Auto-retries with exponential backoff (max 5 attempts)
- ✅ Shows connection status banner at top
- ✅ Works offline with cached data
- ✅ Syncs changes when connection restored

### Manual Reconnection
Click the **"Retry"** button in the connection banner to force reconnection.

## Browser Console Logs

### Healthy Connection
```
✅ Firebase: Multi-tab persistence enabled
🌐 Network: Online detected
✅ Firestore: Network re-enabled
✅ Firestore: Reconnected successfully
```

### Connection Issues
```
📡 Network: Offline detected
⚠️ Network error detected, attempting reconnect...
🔄 Firestore: Reconnect attempt 1/5 in 2000ms
```

## Testing Connection Recovery

1. **Simulate offline mode:**
   ```javascript
   // Browser DevTools → Network tab → "Offline" checkbox
   // OR
   window.dispatchEvent(new Event('offline'));
   ```

2. **Simulate reconnection:**
   ```javascript
   window.dispatchEvent(new Event('online'));
   ```

3. **Force Firestore offline:**
   ```javascript
   import { disableNetwork, enableNetwork } from 'firebase/firestore';
   import { db } from './src/lib/firebase.js';
   
   await disableNetwork(db);  // Go offline
   await enableNetwork(db);   // Go online
   ```

## Persistent Issues

If problems continue after trying above solutions:

### 1. Clear Browser Cache
```
Chrome: Settings → Privacy → Clear browsing data → Cached images and files
Firefox: Settings → Privacy → Clear Data → Cached Web Content
```

### 2. Check IndexedDB
```javascript
// Browser DevTools → Application tab → IndexedDB
// Look for: firestore/[your-project-id]/main
// If corrupted, delete and refresh page
```

### 3. Verify Firebase Configuration
Check `.env.local` has all required variables:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 4. Check Firestore Rules
Verify your Firestore rules allow authenticated access:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Monitor Network Tab
DevTools → Network tab:
- Filter by `firestore.googleapis.com`
- Check status codes (should be 200 or 101 for WebSocket)
- Red entries indicate blocked/failed requests

## Migration from Old Persistence API

If upgrading from old version with deprecation warning:

### Old (Deprecated)
```javascript
enableMultiTabIndexedDbPersistence(db).catch(...);
```

### New (Current)
```javascript
initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
```

## Known Issues

### Chrome/Edge Incognito Mode
- IndexedDB persistence may fail
- Error: "The user denied permission to access the database"
- **Workaround:** Use regular browsing mode or disable persistence for incognito

### Firefox Private Browsing
- IndexedDB disabled by default
- **Workaround:** App falls back to memory cache automatically

### Safari 14.0 and older
- Multi-tab persistence not supported
- **Workaround:** App falls back to single-tab persistence

## Getting Help

If none of the above solutions work:

1. **Export browser console logs:**
   - DevTools → Console → Right-click → "Save as..."
   - Attach to GitHub issue

2. **Check Firebase Status:**
   - https://status.firebase.google.com/

3. **Report issue with:**
   - Browser name and version
   - Operating system
   - Network conditions (WiFi/Ethernet/Mobile)
   - Extensions installed
   - Console error messages
   - Network tab HAR file (DevTools → Network → Export HAR)

## Related Documentation

- [Firebase Offline Persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
