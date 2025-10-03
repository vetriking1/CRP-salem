import { useState, useEffect, useCallback } from 'react';
import { NotificationService } from '@/services/notificationService';
import { useAuth } from './useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Tables} from '@/integrations/supabase/types';

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}
export type NotificationType = 
  | 'task_assigned' 
  | 'task_due_soon' 
  | 'task_overdue' 
  | 'task_created' 
  | 'task_completed' 
  | 'task_status_changed';

export interface Notification extends Tables<'notifications'> {
  task?: {
    id: string;
    title: string;
    status?: string;
  };
}

export interface CreateNotificationParams {
  userId: string;
  taskId?: string;
  type: NotificationType;
  title: string;
  message?: string;
}

export const useNotifications = (limit: number = 50): UseNotificationsReturn => {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<RealtimeChannel | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!userProfile?.id) return;

    try {
      setLoading(true);
      const [notificationsData, count] = await Promise.all([
        NotificationService.getUserNotifications(userProfile.id, limit),
        NotificationService.getUnreadCount(userProfile.id),
      ]);

      setNotifications(notificationsData);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id, limit]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    const success = await NotificationService.markAsRead(notificationId);
    if (success) {
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true }
            : notification
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userProfile?.id) return;

    const success = await NotificationService.markAllAsRead(userProfile.id);
    if (success) {
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, is_read: true }))
      );
      setUnreadCount(0);
    }
  }, [userProfile?.id]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    const success = await NotificationService.deleteNotification(notificationId);
    if (success) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  }, [notifications]);

  // Refresh notifications
  const refreshNotifications = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  // Handle new notification from real-time subscription
  const handleNewNotification = useCallback((newNotification: Notification) => {
    setNotifications(prev => [newNotification, ...prev.slice(0, limit - 1)]);
    if (!newNotification.is_read) {
      setUnreadCount(prev => prev + 1);
    }

    // Show browser notification if permission is granted
    if (Notification.permission === 'granted') {
      new window.Notification(newNotification.title, {
        body: newNotification.message || '',
        icon: '/icon.jpg',
        tag: newNotification.id,
      });
    }
  }, [limit]);

  // Set up real-time subscription
  useEffect(() => {
    if (!userProfile?.id) return;

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Subscribe to real-time notifications
    const channel = NotificationService.subscribeToNotifications(
      userProfile.id,
      handleNewNotification
    );

    setSubscription(channel);

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [userProfile?.id, handleNewNotification]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [subscription]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  };
};
