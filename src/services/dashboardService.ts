import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type TaskWithAssignee = Tables<'tasks'> & {
  assignee?: Tables<'users'>;
  progress?: number;
};

export type TopPerformer = {
  id: string;
  name: string;
  completed: number;
  rank: number;
};

export type ActivityItem = {
  id: string;
  task_title: string;
  action: string;
  user_name: string;
  created_at: string;
};

export async function getDashboardStats() {
  // Get active tasks (not completed)
  const { count: activeCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'completed')
    .neq('status', 'delivered');

  // Get pending tasks
  const { count: pendingCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Get overdue tasks (due_date is in the past and not completed)
  const today = new Date().toISOString();
  const { count: overdueCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .lt('due_date', today)
    .neq('status', 'completed')
    .neq('status', 'delivered');

  // Get completed tasks for today
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const { count: completedTodayCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    // .gte('completed_at', startOfToday.toISOString())
    // .lte('completed_at', endOfToday.toISOString());

  // Get delivered tasks for today
  const { count: deliveredTodayCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'delivered')
    // .gte('completed_at', startOfToday.toISOString())
    // .lte('completed_at', endOfToday.toISOString());

  return {
    active: activeCount || 0,
    pending: pendingCount || 0,
    overdue: overdueCount || 0,
    completedToday: completedTodayCount || 0,
    deliveredToday: deliveredTodayCount || 0,
  };
}

export async function getRecentTasks(): Promise<TaskWithAssignee[]> {
  // First get the recent tasks
  const { data: tasksData, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      description,
      status,
      priority,
      created_at,
      completed_at,
      due_date
    `)
    .order('created_at', { ascending: false })
    .limit(5);

  if (tasksError) {
    console.error('Error fetching recent tasks:', tasksError);
    return [];
  }

  // For each task, get the assignee information
  const tasksWithAssignees: TaskWithAssignee[] = [];
  
  for (const task of tasksData) {
    // Get assignee for this task
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('task_assignments')
      .select(`
        user:users!inner (full_name)
      `)
      .eq('task_id', task.id)
      .eq('is_active', true)
      .limit(1)
      .single(); // Get only the first active assignment

    let assignee = null;
    if (!assignmentError && assignmentData?.user) {
      assignee = assignmentData.user;
    }

    // Calculate progress percentage
    let progress = 0;
    if (task.status === 'completed') {
      progress = 100;
    } else if (task.status === 'in_progress') {
      progress = 60; // Default progress for in-progress tasks
    } else if (task.status === 'assigned') {
      progress = 20; // Default progress for assigned tasks
    } else {
      progress = 0; // Default for not started
    }

    tasksWithAssignees.push({
      ...task,
      assignee,
      progress,
    });
  }

  return tasksWithAssignees;
}

export async function getTopPerformers(): Promise<TopPerformer[]> {
  // Get completed tasks from last 30 days
  const { data: completedTasks, error } = await supabase
    .from('tasks')
    .select('id')
    .eq('status', 'completed')
    .gte('completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (error || !completedTasks) {
    console.error('Error fetching top performers data:', error);
    return [];
  }

  const taskIds = completedTasks.map(t => t.id);
  if (taskIds.length === 0) return [];

  // Get active assignments for these tasks
  const { data: assignments, error: assignError } = await supabase
    .from('task_assignments')
    .select('user_id, users!task_assignments_user_id_fkey(id, full_name)')
    .in('task_id', taskIds)
    .eq('is_active', true);

  if (assignError || !assignments) {
    console.error('Error fetching assignments:', assignError);
    return [];
  }

  // Count completions per user
  const completionCounts: Record<string, { name: string; count: number }> = {};
  assignments.forEach(assignment => {
    const userId = assignment.user_id;
    const userName = assignment.users?.full_name || 'Unknown';
    if (!completionCounts[userId]) {
      completionCounts[userId] = { name: userName, count: 0 };
    }
    completionCounts[userId].count++;
  });

  // Convert to array and sort
  return Object.entries(completionCounts)
    .map(([id, data]) => ({
      id,
      name: data.name,
      completed: data.count,
      rank: 0
    }))
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5)
    .map((performer, index) => ({ ...performer, rank: index + 1 }));
}

export async function getRecentActivity(): Promise<ActivityItem[]> {
  // First get the recent activity from task_history
  const { data: historyData, error: historyError } = await supabase
    .from('task_history')
    .select(`
      id,
      action,
      created_at,
      task_id,
      user_id
    `)
    .order('created_at', { ascending: false })
    .limit(5);

  if (historyError) {
    console.error('Error fetching recent activity:', historyError);
    return [];
  }

  // For each activity item, get the task and user details
  const activityItems: ActivityItem[] = [];

  for (const activity of historyData) {
    // Get the task title
    let taskTitle = 'Unknown Task';
    if (activity.task_id) {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('title')
        .eq('id', activity.task_id)
        .single();

      if (!taskError && taskData?.title) {
        taskTitle = taskData.title;
      }
    }

    // Get the user name
    let userName = 'Unknown User';
    if (activity.user_id) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', activity.user_id)
        .single();

      if (!userError && userData?.full_name) {
        userName = userData.full_name;
      }
    }

    activityItems.push({
      id: activity.id,
      task_title: taskTitle,
      action: activity.action,
      user_name: userName,
      created_at: activity.created_at,
    });
  }

  return activityItems;
}

export async function getTasksByStatus() {
  const { data, error } = await supabase
    .from('tasks')
    .select('status')
    .not('status', 'is', null);

  if (error) {
    console.error('Error fetching tasks by status:', error);
    return [];
  }

  // Count tasks by status
  const statusCounts: Record<string, number> = {};
  data.forEach(task => {
    if (task.status) {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    }
  });

  return [
    { name: 'Completed', value: statusCounts.completed || 0 },
    { name: 'Delivered', value: statusCounts.delivered || 0 },
    { name: 'In Progress', value: statusCounts.in_progress || 0 },
    { name: 'Pending', value: statusCounts.pending || 0 },
    { name: 'Not Started', value: statusCounts.not_started || 0 },
    { name: 'Assigned', value: statusCounts.assigned || 0 },
    { name: 'Review', value: statusCounts.review || 0 },
  ];
}

export async function getWeeklyTaskData() {
  // Get the start of the current month (Monday)
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
  startOfWeek.setHours(0, 0, 0, 0);

  // Generate the last 30 days
  const days = [];
  for (let i = 0; i < 30; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    days.push(day);
  }

  // Format days as short names
  const dayNames = days.map(day => day.toLocaleDateString('en-US', { weekday: 'short' }));

  // Get completed tasks for the week
  const { data: completedTasks, error: completedError } = await supabase
    .from('tasks')
    .select('*')
    .gte('completed_at', startOfWeek.toISOString())
    .in('status', ['completed', 'delivered']);

  // Get assigned tasks for the week
  const { data: assignedTasks, error: assignedError } = await supabase
    .from('tasks')
    .select('*')
    .gte('created_at', startOfWeek.toISOString());

  if (completedError || assignedError) {
    console.error('Error fetching weekly data:', completedError || assignedError);
    return days.map((day, index) => ({
      day: dayNames[index],
      completed: 0,
      assigned: 0,
    }));
  }

  // Count tasks by day
  const completedByDay: Record<string, number> = {};
  const assignedByDay: Record<string, number> = {};

  completedTasks?.forEach(task => {
    if (task.completed_at) {
      const taskDate = new Date(task.completed_at);
      const dayIndex = taskDate.getDay();
      // Adjust to make Monday 0, Tuesday 1, etc.
      const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      completedByDay[adjustedDayIndex] = (completedByDay[adjustedDayIndex] || 0) + 1;
    }
  });

  assignedTasks?.forEach(task => {
    const taskDate = new Date(task.created_at || '');
    const dayIndex = taskDate.getDay();
    // Adjust to make Monday 0, Tuesday 1, etc.
    const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    assignedByDay[adjustedDayIndex] = (assignedByDay[adjustedDayIndex] || 0) + 1;
  });

  return days.map((day, index) => ({
    day: dayNames[index],
    completed: completedByDay[index] || 0,
    assigned: assignedByDay[index] || 0,
  }));
}