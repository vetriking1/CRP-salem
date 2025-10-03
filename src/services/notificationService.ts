import { supabase } from '@/integrations/supabase/client';
import { Tables} from '@/integrations/supabase/types';

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

export class NotificationService {
  /**
   * Create a new notification
   */
  static async createNotification(params: CreateNotificationParams): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: params.userId,
          task_id: params.taskId || null,
          type: params.type,
          title: params.title,
          message: params.message || null,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }

  /**
   * Get notifications for a user
   */
  static async getUserNotifications(
    userId: string, 
    limit: number = 50,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    try {
      let query = supabase
        .from('notifications')
        .select(`
          *,
          task:tasks(id, title, status)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  /**
   * Subscribe to real-time notifications for a user
   */
  static subscribeToNotifications(
    userId: string, 
    onNotification: (notification: Notification) => void
  ) {
    return supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          // Fetch the complete notification with task details
          const { data } = await supabase
            .from('notifications')
            .select(`
              *,
              task:tasks(id, title, status)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            onNotification(data as Notification);
          }
        }
      )
      .subscribe();
  }

  /**
   * Notify team managers when a task is created
   */
  static async notifyTeamManagersOnTaskCreation(
    taskId: string,
    taskTitle: string,
    teamId: string,
    createdBy: string
  ): Promise<void> {
    try {
      // Get team managers
      const { data: managers } = await supabase
        .from('team_members')
        .select(`
          user_id,
          users!inner(id, full_name, role)
        `)
        .eq('team_id', teamId)
        .in('users.role', ['manager', 'admin']);

      if (managers) {
        for (const manager of managers) {
          if (manager.user_id !== createdBy) {
            await this.createNotification({
              userId: manager.user_id,
              taskId,
              type: 'task_created',
              title: 'New Task Created',
              message: `A new task "${taskTitle}" has been created and assigned to your team.`,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error notifying team managers:', error);
    }
  }

  /**
   * Notify user when assigned to a task (Enhanced version)
   */
  static async notifyTaskAssignment(
    userId: string,
    taskId: string,
    taskTitle: string,
    options?: {
      channels?: Array<'database' | 'push' | 'email' | 'sms'>;
      userEmail?: string;
      userPhone?: string;
    }
  ): Promise<void> {
    // Use enhanced notification service if available
    if (options?.channels && options.channels.length > 1) {
      const { SupabaseNotificationService } = await import('./supabaseNotificationService');
      
      await SupabaseNotificationService.createEnhancedNotification({
        userId,
        taskId,
        type: 'task_assigned',
        title: 'Task Assigned to You',
        message: `You have been assigned to task: "${taskTitle}"`,
        channels: options.channels,
        pushPayload: {
          title: 'New Task Assignment',
          body: `You've been assigned to: ${taskTitle}`,
          icon: '/icon.jpg',
          data: { taskId, type: 'task_assigned' },
          actions: [
            { action: 'view', title: 'View Task' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        },
        emailParams: {
          subject: 'New Task Assignment - Flowchart Pilot',
          html: `<p>You have been assigned to a new task: <strong>${taskTitle}</strong></p>`,
        },
        smsMessage: `New task assigned: ${taskTitle}`,
        userEmail: options.userEmail,
        userPhone: options.userPhone,
      });
    } else {
      // Fallback to standard notification
      await this.createNotification({
        userId,
        taskId,
        type: 'task_assigned',
        title: 'Task Assigned to You',
        message: `You have been assigned to task: "${taskTitle}"`,
      });
    }
  }

  /**
   * Notify users about due soon tasks
   */
  static async notifyDueSoonTasks(): Promise<void> {
    try {
      // Get tasks due within 24 hours
      const { data: dueSoonTasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          due_date,
          task_assignments!inner(user_id)
        `)
        .gte('due_date', new Date().toISOString())
        .lte('due_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
        .eq('status', 'assigned');

      if (error) throw error;

      for (const task of dueSoonTasks || []) {
        for (const assignment of task.task_assignments) {
          await this.createNotification({
            userId: assignment.user_id,
            taskId: task.id,
            type: 'task_due_soon',
            title: 'Task Due Soon',
            message: `Task "${task.title}" is due within 24 hours`,
          });
        }
      }
    } catch (error) {
      console.error('Error checking due soon tasks:', error);
    }
  }

  /**
   * Notify users about overdue tasks
   */
  static async notifyOverdueTasks(): Promise<void> {
    try {
      // Get overdue tasks
      const { data: overdueTasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          due_date,
          task_assignments!inner(user_id)
        `)
        .lt('due_date', new Date().toISOString())
        .in('status', ['assigned', 'in_progress']);

      if (error) throw error;

      for (const task of overdueTasks || []) {
        for (const assignment of task.task_assignments) {
          await this.createNotification({
            userId: assignment.user_id,
            taskId: task.id,
            type: 'task_overdue',
            title: 'Task Overdue',
            message: `Task "${task.title}" is overdue`,
          });
        }
      }
    } catch (error) {
      console.error('Error checking overdue tasks:', error);
    }
  }

  /**
   * Notify when task status changes
   */
  static async notifyTaskStatusChange(
    taskId: string,
    taskTitle: string,
    oldStatus: string,
    newStatus: string,
    assignedUsers: string[]
  ): Promise<void> {
    const statusMessages: Record<string, string> = {
      'assigned': 'has been assigned',
      'in_progress': 'is now in progress',
      'pending': 'is now pending',
      'review': 'is ready for review',
      'completed': 'has been completed',
      'delivered': 'has been delivered',
      'rejected': 'has been rejected',
    };

    const message = `Task "${taskTitle}" ${statusMessages[newStatus] || `status changed to ${newStatus}`}`;

    for (const userId of assignedUsers) {
      await this.createNotification({
        userId,
        taskId,
        type: 'task_status_changed',
        title: 'Task Status Updated',
        message,
      });
    }
  }

  /**
   * Get notification icon based on type
   */
  static getNotificationIcon(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
      'task_assigned': '👤',
      'task_due_soon': '⏰',
      'task_overdue': '🚨',
      'task_created': '📝',
      'task_completed': '✅',
      'task_status_changed': '🔄',
    };
    return icons[type] || '📋';
  }

  /**
   * Get notification color based on type
   */
  static getNotificationColor(type: NotificationType): string {
    const colors: Record<NotificationType, string> = {
      'task_assigned': 'blue',
      'task_due_soon': 'orange',
      'task_overdue': 'red',
      'task_created': 'green',
      'task_completed': 'green',
      'task_status_changed': 'purple',
    };
    return colors[type] || 'default';
  }
}
