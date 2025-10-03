import dayjs from 'dayjs';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type DueDateStatus = 'overdue' | 'due_today' | 'due_soon' | 'normal';

export interface DueDateInfo {
  status: DueDateStatus;
  daysUntilDue: number;
  suggestedPriority: Priority;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean;
}

/**
 * Calculate due date information and suggest priority based on due date
 */
export const calculateDueDateInfo = (dueDate: string | null, currentPriority?: Priority): DueDateInfo => {
  if (!dueDate) {
    return {
      status: 'normal',
      daysUntilDue: Infinity,
      suggestedPriority: currentPriority || 'medium',
      isOverdue: false,
      isDueToday: false,
      isDueSoon: false,
    };
  }

  const now = dayjs();
  const due = dayjs(dueDate);
  const daysUntilDue = due.diff(now, 'day');
  
  let status: DueDateStatus = 'normal';
  let suggestedPriority: Priority = currentPriority || 'medium';
  
  const isOverdue = daysUntilDue < 0;
  const isDueToday = daysUntilDue === 0;
  const isDueSoon = daysUntilDue > 0 && daysUntilDue <= 3;

  // Determine status
  if (isOverdue) {
    status = 'overdue';
  } else if (isDueToday) {
    status = 'due_today';
  } else if (isDueSoon) {
    status = 'due_soon';
  }

  // Auto-adjust priority based on due date
  if (isOverdue) {
    suggestedPriority = 'urgent';
  } else if (isDueToday) {
    suggestedPriority = 'urgent';
  } else if (daysUntilDue <= 1) {
    suggestedPriority = 'high';
  } else if (daysUntilDue <= 3) {
    suggestedPriority = daysUntilDue <= 2 ? 'high' : 'medium';
  } else if (daysUntilDue <= 7) {
    // Only upgrade priority if current is low
    if (currentPriority === 'low') {
      suggestedPriority = 'medium';
    }
  }

  return {
    status,
    daysUntilDue,
    suggestedPriority,
    isOverdue,
    isDueToday,
    isDueSoon,
  };
};

/**
 * Get display text for due date status
 */
export const getDueDateStatusText = (dueDateInfo: DueDateInfo): string => {
  const { status, daysUntilDue, isOverdue, isDueToday } = dueDateInfo;
  
  if (isOverdue) {
    const overdueDays = Math.abs(daysUntilDue);
    return `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
  }
  
  if (isDueToday) {
    return 'Due Today';
  }
  
  if (status === 'due_soon') {
    return `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`;
  }
  
  return '';
};

/**
 * Get color for due date status
 */
export const getDueDateStatusColor = (dueDateInfo: DueDateInfo): string => {
  const { status } = dueDateInfo;
  
  switch (status) {
    case 'overdue':
      return 'error';
    case 'due_today':
      return 'warning';
    case 'due_soon':
      return 'processing';
    default:
      return 'default';
  }
};

/**
 * Check if priority should be automatically updated based on due date
 */
export const shouldUpdatePriority = (currentPriority: Priority, suggestedPriority: Priority): boolean => {
  const priorityLevels = { low: 1, medium: 2, high: 3, urgent: 4 };
  return priorityLevels[suggestedPriority] > priorityLevels[currentPriority];
};
