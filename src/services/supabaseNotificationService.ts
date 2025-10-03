import { supabase } from '@/integrations/supabase/client';
import { NotificationService, NotificationType, CreateNotificationParams } from './notificationService';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export interface EmailNotificationParams {
  to: string;
  subject: string;
  html: string;
  templateId?: string;
  templateData?: Record<string, any>;
}

export interface SMSNotificationParams {
  to: string;
  message: string;
}

export class SupabaseNotificationService extends NotificationService {
  private static vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  
  /**
   * Initialize push notification service worker
   */
  static async initializePushNotifications(): Promise<boolean> {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications not supported');
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      return false;
    }
  }

  /**
   * Subscribe user to push notifications
   */
  static async subscribeToPushNotifications(userId: string): Promise<boolean> {
    try {
      if (!this.vapidPublicKey) {
        console.error('VAPID public key not configured');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
      });

      // Store subscription in Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          subscription: subscription.toJSON(),
          endpoint: subscription.endpoint,
        });

      if (error) throw error;

      console.log('Push subscription saved:', subscription);
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return false;
    }
  }

  /**
   * Send push notification via Supabase Edge Function
   */
  static async sendPushNotification(
    userId: string,
    payload: PushNotificationPayload
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId,
          payload,
        },
      });

      if (error) throw error;
      return data?.success || false;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  /**
   * Send email notification via Supabase Edge Function
   */
  static async sendEmailNotification(params: EmailNotificationParams): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('send-email-notification', {
        body: params,
      });

      if (error) throw error;
      return data?.success || false;
    } catch (error) {
      console.error('Error sending email notification:', error);
      return false;
    }
  }

  /**
   * Send SMS notification via Supabase Edge Function
   */
  static async sendSMSNotification(params: SMSNotificationParams): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-notification', {
        body: params,
      });

      if (error) throw error;
      return data?.success || false;
    } catch (error) {
      console.error('Error sending SMS notification:', error);
      return false;
    }
  }

  /**
   * Enhanced notification creation with multiple channels
   */
  static async createEnhancedNotification(
    params: CreateNotificationParams & {
      channels?: Array<'database' | 'push' | 'email' | 'sms'>;
      pushPayload?: PushNotificationPayload;
      emailParams?: Omit<EmailNotificationParams, 'to'>;
      smsMessage?: string;
      userEmail?: string;
      userPhone?: string;
    }
  ): Promise<string | null> {
    try {
      const channels = params.channels || ['database'];
      let notificationId: string | null = null;

      // Always create database notification
      if (channels.includes('database')) {
        notificationId = await super.createNotification(params);
      }

      // Send push notification
      if (channels.includes('push') && params.pushPayload) {
        await this.sendPushNotification(params.userId, params.pushPayload);
      }

      // Send email notification
      if (channels.includes('email') && params.emailParams && params.userEmail) {
        await this.sendEmailNotification({
          to: params.userEmail,
          subject: params.emailParams.subject || params.title,
          html: params.emailParams.html || params.message || '',
          ...params.emailParams,
        });
      }

      // Send SMS notification
      if (channels.includes('sms') && params.smsMessage && params.userPhone) {
        await this.sendSMSNotification({
          to: params.userPhone,
          message: params.smsMessage,
        });
      }

      return notificationId;
    } catch (error) {
      console.error('Error creating enhanced notification:', error);
      return null;
    }
  }

  /**
   * Subscribe to real-time notifications with enhanced features
   */
  static subscribeToEnhancedNotifications(
    userId: string,
    callbacks: {
      onNotification?: (notification: any) => void;
      onTaskUpdate?: (task: any) => void;
      onTeamUpdate?: (team: any) => void;
      onUserPresence?: (presence: any) => void;
    }
  ) {
    const channels: any[] = [];

    // Notifications channel
    if (callbacks.onNotification) {
      const notificationChannel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          callbacks.onNotification
        )
        .subscribe();
      
      channels.push(notificationChannel);
    }

    // Task updates channel
    if (callbacks.onTaskUpdate) {
      const taskChannel = supabase
        .channel(`tasks:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tasks',
          },
          callbacks.onTaskUpdate
        )
        .subscribe();
      
      channels.push(taskChannel);
    }

    // Team updates channel
    if (callbacks.onTeamUpdate) {
      const teamChannel = supabase
        .channel(`teams:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'teams',
          },
          callbacks.onTeamUpdate
        )
        .subscribe();
      
      channels.push(teamChannel);
    }

    // User presence channel
    if (callbacks.onUserPresence) {
      const presenceChannel = supabase
        .channel(`presence:${userId}`)
        .on('presence', { event: 'sync' }, callbacks.onUserPresence)
        .on('presence', { event: 'join' }, callbacks.onUserPresence)
        .on('presence', { event: 'leave' }, callbacks.onUserPresence)
        .subscribe();
      
      channels.push(presenceChannel);
    }

    return {
      unsubscribe: () => {
        channels.forEach(channel => channel.unsubscribe());
      },
    };
  }

  /**
   * Track user presence
   */
  static async trackUserPresence(userId: string, metadata?: Record<string, any>) {
    const channel = supabase.channel(`presence:${userId}`);
    
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
          ...metadata,
        });
      }
    });

    return channel;
  }

  /**
   * Get user notification preferences
   */
  static async getUserNotificationPreferences(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      return data || {
        email_notifications: true,
        push_notifications: true,
        sms_notifications: false,
        task_assignments: true,
        task_due_reminders: true,
        task_completions: true,
        team_updates: true,
      };
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      return null;
    }
  }

  /**
   * Update user notification preferences
   */
  static async updateNotificationPreferences(
    userId: string,
    preferences: Record<string, boolean>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return false;
    }
  }

  /**
   * Batch send notifications to multiple users
   */
  static async batchSendNotifications(
    notifications: Array<CreateNotificationParams & {
      channels?: Array<'database' | 'push' | 'email' | 'sms'>;
      userEmail?: string;
      userPhone?: string;
    }>
  ): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('batch-send-notifications', {
        body: { notifications },
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error batch sending notifications:', error);
    }
  }

  /**
   * Utility function to convert VAPID key
   */
  private static urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
