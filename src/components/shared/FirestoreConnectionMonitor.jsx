// components/shared/FirestoreConnectionMonitor.jsx
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { onSnapshotsInSync, enableNetwork, disableNetwork } from 'firebase/firestore';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

import { logger } from "../../lib/logger";
/**
 * FirestoreConnectionMonitor Component
 * Displays connection status banner when Firestore goes offline
 * Provides manual reconnect option
 */
export default function FirestoreConnectionMonitor() {
  const [isConnected, setIsConnected] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    let reconnectTimer = null;
    let hideTimer = null;

    // Monitor Firestore sync state
    const unsubscribe = onSnapshotsInSync(db, () => {
      setIsConnected(true);
      setIsReconnecting(false);
      
      // Hide banner after successful reconnection (with delay)
      if (showBanner) {
        hideTimer = setTimeout(() => {
          setShowBanner(false);
        }, 3000);
      }
    });

    // Listen for network state changes
    const handleOnline = () => {
      logger.log('🌐 Browser online');
      setIsConnected(true);
      setShowBanner(false);
    };

    const handleOffline = () => {
      logger.log('📡 Browser offline');
      setIsConnected(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Monitor for Firestore errors globally
    const handleGlobalError = (event) => {
      const message = event.message || '';
      
      if (message.includes('Failed to fetch') || 
          message.includes('NetworkError') ||
          message.includes('ERR_BLOCKED_BY_CLIENT') ||
          message.includes('ERR_NETWORK_IO_SUSPENDED') ||
          message.includes('ERR_INTERNET_DISCONNECTED')) {
        
        logger.warn('⚠️ Firestore connection issue detected:', message);
        setIsConnected(false);
        setShowBanner(true);
        
        // Auto-retry after 3 seconds
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          handleManualReconnect();
        }, 3000);
      }
    };

    window.addEventListener('error', handleGlobalError, true);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('error', handleGlobalError, true);
      clearTimeout(reconnectTimer);
      clearTimeout(hideTimer);
    };
  }, [showBanner]);

  const handleManualReconnect = async () => {
    setIsReconnecting(true);
    
    try {
      // Disable then re-enable network to force reconnection
      await disableNetwork(db);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await enableNetwork(db);
      
      logger.log('✅ Manual reconnection successful');
      
      // Wait for sync confirmation
      setTimeout(() => {
        setIsReconnecting(false);
      }, 2000);
      
    } catch (error) {
      logger.error('❌ Manual reconnection failed:', error);
      setIsReconnecting(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4">
      <Alert 
        variant={isConnected ? "default" : "destructive"}
        className="shadow-lg"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <Wifi className="h-5 w-5 text-green-600" />
            ) : (
              <WifiOff className="h-5 w-5" />
            )}
            <AlertDescription className="m-0">
              {isConnected ? (
                <span className="text-green-700 font-medium">
                  ✅ Connection restored - All data synced
                </span>
              ) : isReconnecting ? (
                <span>🔄 Reconnecting to database...</span>
              ) : (
                <span>
                  ⚠️ Connection lost - Working offline with cached data
                </span>
              )}
            </AlertDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {!isConnected && !isReconnecting && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleManualReconnect}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            )}
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </Alert>
    </div>
  );
}
