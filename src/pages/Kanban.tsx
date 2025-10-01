import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Loader2 } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  task_assignments: Array<{
    user_id: string;
    users: { full_name: string } | null;
  }>;
}

const statusColumns = [
  { key: 'not_started', label: 'Not Started', color: 'bg-slate-100' },
  { key: 'assigned', label: 'Assigned', color: 'bg-blue-100' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-yellow-100' },
  { key: 'pending', label: 'Pending', color: 'bg-orange-100' },
  { key: 'review', label: 'Review', color: 'bg-purple-100' },
  { key: 'completed', label: 'Completed', color: 'bg-green-100' },
  { key: 'delivered', label: 'Delivered', color: 'bg-emerald-100' },
];

const priorityColors: { [key: string]: 'default' | 'destructive' | 'outline' | 'secondary' } = {
  urgent: 'destructive',
  high: 'default',
  medium: 'secondary',
  low: 'outline',
};

export default function Kanban() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_assignments(
            user_id,
            users!task_assignments_user_id_fkey(full_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter((task) => task.status === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Kanban Board</h1>
        <Badge variant="outline">{tasks.length} Total Tasks</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {statusColumns.map((column) => {
          const columnTasks = getTasksByStatus(column.key);
          return (
            <div key={column.key} className="flex flex-col gap-2">
              <Card className={`${column.color} border-2`}>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    {column.label}
                    <Badge variant="secondary" className="ml-2">
                      {columnTasks.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
              </Card>

              <div className="space-y-2 min-h-[200px]">
                {columnTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  >
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm mb-2 line-clamp-2">
                        {task.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {task.description}
                      </p>
                      
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={priorityColors[task.priority]} className="text-xs">
                          {task.priority.toUpperCase()}
                        </Badge>
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground">
                            {dayjs(task.due_date).format('MMM DD')}
                          </span>
                        )}
                      </div>

                      {task.task_assignments && task.task_assignments.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          👤 {task.task_assignments[0]?.users?.full_name}
                          {task.task_assignments.length > 1 && (
                            <span> +{task.task_assignments.length - 1}</span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
