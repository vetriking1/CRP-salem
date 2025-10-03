import { supabase } from '@/integrations/supabase/client';
import { NotificationService } from './notificationService';
import { calculateDueDateInfo } from '@/utils/dueDateUtils';

/**
 * Service for handling scheduled notification jobs
 * In a production environment, these would be called by a cron job or scheduled task
 */
export class ScheduledJobService {
  /**
   * Check for tasks that are due soon and send notifications
   * Should be run daily
   */
  static async checkDueSoonTasks(): Promise<void> {
    try {
      console.log('Checking for due soon tasks...');
      
      // Get tasks that are due within 24 hours and not completed
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          due_date,
          status,
          task_assignments(
            user_id,
            users!task_assignments_user_id_fkey(full_name)
          )
        `)
        .not('due_date', 'is', null)
        .not('status', 'in', '(completed,delivered)')
        .gte('due_date', new Date().toISOString())
        .lte('due_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      if (!tasks || tasks.length === 0) {
        console.log('No due soon tasks found');
        return;
      }

      for (const task of tasks) {
        // Check if we already sent a notification for this task in the last 24 hours
        const { data: existingNotifications } = await supabase
          .from('notifications')
          .select('id')
          .eq('task_id', task.id)
          .eq('type', 'task_due_soon')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (existingNotifications && existingNotifications.length > 0) {
          console.log(`Skipping task ${task.id} - notification already sent`);
          continue;
        }

        // Send notifications to all assigned users
        const assignedUsers = task.task_assignments || [];
        for (const assignment of assignedUsers) {
          await NotificationService.createNotification({
            userId: assignment.user_id,
            taskId: task.id,
            type: 'task_due_soon',
            title: 'Task Due Soon',
            message: `Task "${task.title}" is due within 24 hours.`,
          });
        }

        console.log(`Sent due soon notifications for task: ${task.title}`);
      }

      console.log(`Processed ${tasks.length} due soon tasks`);
    } catch (error) {
      console.error('Error checking due soon tasks:', error);
    }
  }

  /**
   * Check for overdue tasks and send notifications
   * Should be run daily
   */
  static async checkOverdueTasks(): Promise<void> {
    try {
      console.log('Checking for overdue tasks...');
      
      // Get tasks that are overdue and not completed
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          due_date,
          status,
          task_assignments(
            user_id,
            users!task_assignments_user_id_fkey(full_name)
          )
        `)
        .not('due_date', 'is', null)
        .not('status', 'in', '(completed,delivered)')
        .lt('due_date', new Date().toISOString());

      if (error) throw error;

      if (!tasks || tasks.length === 0) {
        console.log('No overdue tasks found');
        return;
      }

      for (const task of tasks) {
        // Check if we already sent an overdue notification for this task in the last 24 hours
        const { data: existingNotifications } = await supabase
          .from('notifications')
          .select('id')
          .eq('task_id', task.id)
          .eq('type', 'task_overdue')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (existingNotifications && existingNotifications.length > 0) {
          console.log(`Skipping task ${task.id} - overdue notification already sent`);
          continue;
        }

        // Calculate how many days overdue
        const dueDateInfo = calculateDueDateInfo(task.due_date);
        const daysOverdue = Math.abs(dueDateInfo.daysUntilDue);

        // Send notifications to all assigned users
        const assignedUsers = task.task_assignments || [];
        for (const assignment of assignedUsers) {
          await NotificationService.createNotification({
            userId: assignment.user_id,
            taskId: task.id,
            type: 'task_overdue',
            title: 'Task Overdue',
            message: `Task "${task.title}" is overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}.`,
          });
        }

        console.log(`Sent overdue notifications for task: ${task.title}`);
      }

      console.log(`Processed ${tasks.length} overdue tasks`);
    } catch (error) {
      console.error('Error checking overdue tasks:', error);
    }
  }

  /**
   * Run all scheduled notification checks
   * This would typically be called by a cron job
   */
  static async runDailyNotificationChecks(): Promise<void> {
    console.log('Running daily notification checks...');
    
    await Promise.all([
      this.checkDueSoonTasks(),
      this.checkOverdueTasks(),
    ]);
    
    console.log('Daily notification checks completed');
  }

  /**
   * Clean up old notifications (older than 30 days)
   * Should be run weekly
   */
  static async cleanupOldNotifications(): Promise<void> {
    try {
      console.log('Cleaning up old notifications...');
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .lt('created_at', thirtyDaysAgo);

      if (error) throw error;
      
      console.log('Old notifications cleaned up successfully');
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
    }
  }

  /**
   * Initialize scheduled jobs (for development/testing)
   * In production, use a proper job scheduler like cron
   */
  static initializeScheduledJobs(): void {
    // Run daily checks every 24 hours
    setInterval(() => {
      this.runDailyNotificationChecks();
    }, 24 * 60 * 60 * 1000);

    // Run cleanup weekly
    setInterval(() => {
      this.cleanupOldNotifications();
    }, 7 * 24 * 60 * 60 * 1000);

    // Run initial check after 1 minute
    setTimeout(() => {
      this.runDailyNotificationChecks();
    }, 60 * 1000);

    console.log('Scheduled notification jobs initialized');
  }
}