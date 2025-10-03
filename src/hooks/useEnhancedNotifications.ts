import { useState, useEffect, useCallback, useRef } from 'react';
import { SupabaseNotificationService } from '@/services/supabaseNotificationService';
import { useNotifications } from './useNotifications';
import { useAuth } from './useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface NotificationPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  task_assignments: boolean;
  task_due_reminders: boolean;
  task_completions: boolean;
  team_updates: boolean;
}

export interface UseEnhancedNotificationsReturn {
  // Existing notification functionality
  notifications: any[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  
  // Enhanced features
  preferences: NotificationPreferences | null;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<boolean>;
  isPushSupported: boolean;
  isPushSubscribed: boolean;
  subscribeToPush: () => Promise<boolean>;
  unsubscribeFromPush: () => Promise<boolean>;
  userPresence: any[];
  isOnline: boolean;
  
  // Real-time features
  taskUpdates: any[];
  teamUpdates: any[];
}

export const useEnhancedNotifications = (limit: number = 50): UseEnhancedNotificationsReturn => {
  const { userProfile } = useAuth();
  const baseNotifications = useNotifications(limit);
  
  // Enhanced state
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [userPresence, setUserPresence] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [taskUpdates, setTaskUpdates] = useState<any[]>([]);
  const [teamUpdates, setTeamUpdates] = useState<any[]>([]);
  
  // Refs for subscriptions
  const enhancedSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  // Check push notification support
  useEffect(() => {
    const checkPushSupport = async () => {
      const supported = await SupabaseNotificationService.initializePushNotifications();
      setIsPushSupported(supported);
      
      if (supported) {
        // Check if already subscribed
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsPushSubscribed(!!subscription);
      }
    };

    checkPushSupport();
  }, []);

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!userProfile?.id) return;
      
      const prefs = await SupabaseNotificationService.getUserNotificationPreferences(userProfile.id);
      if (prefs) {
        setPreferences(prefs);
      }
    };

    loadPreferences();
  }, [userProfile?.id]);

  // Update preferences
  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    if (!userProfile?.id || !preferences) return false;

    const updatedPrefs = { ...preferences, ...newPreferences };
    const success = await SupabaseNotificationService.updateNotificationPreferences(
      userProfile.id,
      updatedPrefs
    );

    if (success) {
      setPreferences(updatedPrefs);
    }

    return success;
  }, [userProfile?.id, preferences]);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async () => {
    if (!userProfile?.id || !isPushSupported) return false;

    const success = await SupabaseNotificationService.subscribeToPushNotifications(userProfile.id);
    if (success) {
      setIsPushSubscribed(true);
      await updatePreferences({ push_notifications: true });
    }

    return success;
  }, [userProfile?.id, isPushSupported, updatePreferences]);

  // Unsubscribe from push notifications
  const unsubscribeFromPush = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        setIsPushSubscribed(false);
        await updatePreferences({ push_notifications: false });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }, [updatePreferences]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Set up enhanced real-time subscriptions
  useEffect(() => {
    if (!userProfile?.id) return;

    const subscription = SupabaseNotificationService.subscribeToEnhancedNotifications(
      userProfile.id,
      {
        onNotification: (notification) => {
          // This is handled by the base useNotifications hook
          console.log('Enhanced notification received:', notification);
        },
        onTaskUpdate: (task) => {
          setTaskUpdates(prev => [task, ...prev.slice(0, 19)]); // Keep last 20 updates
        },
        onTeamUpdate: (team) => {
          setTeamUpdates(prev => [team, ...prev.slice(0, 19)]); // Keep last 20 updates
        },
        onUserPresence: (presence) => {
          setUserPresence(Object.values(presence));
        },
      }
    );

    enhancedSubscriptionRef.current = subscription;

    return () => {
      if (enhancedSubscriptionRef.current) {
        enhancedSubscriptionRef.current.unsubscribe();
      }
    };
  }, [userProfile?.id]);

  // Track user presence
  useEffect(() => {
    if (!userProfile?.id) return;

    const trackPresence = async () => {
      const channel = await SupabaseNotificationService.trackUserPresence(
        userProfile.id,
        {
          status: isOnline ? 'online' : 'offline',
          last_seen: new Date().toISOString(),
        }
      );

      presenceChannelRef.current = channel;
    };

    trackPresence();

    return () => {
      if (presenceChannelRef.current) {
        presenceChannelRef.current.unsubscribe();
      }
    };
  }, [userProfile?.id, isOnline]);

  // Handle service worker messages
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICKED') {
        console.log('Notification clicked:', event.data);
        
        // Handle notification click actions
        if (event.data.data?.taskId) {
          // Navigate to task or trigger callback
          window.location.href = `/tasks/${event.data.data.taskId}`;
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      };
    }
  }, []);

  return {
    // Base notification functionality
    ...baseNotifications,
    
    // Enhanced features
    preferences,
    updatePreferences,
    isPushSupported,
    isPushSubscribed,
    subscribeToPush,
    unsubscribeFromPush,
    userPresence,
    isOnline,
    taskUpdates,
    teamUpdates,
  };
};
