import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { Loader2, Search, Calendar, Filter } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  created_at: string;
  task_assignments: Array<{
    user_id: string;
    users: { full_name: string } | null;
  }>;
}

const statusColumns = [
  { key: "not_started", label: "Not Started", color: "bg-slate-100" },
  { key: "assigned", label: "Assigned", color: "bg-blue-100" },
  { key: "in_progress", label: "In Progress", color: "bg-yellow-100" },
  { key: "pending", label: "Pending", color: "bg-orange-100" },
  { key: "review", label: "Review", color: "bg-purple-100" },
  { key: "completed", label: "Completed", color: "bg-green-100" },
  { key: "delivered", label: "Delivered", color: "bg-emerald-100" },
];

const priorityColors: {
  [key: string]: "default" | "destructive" | "outline" | "secondary";
} = {
  urgent: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

export default function Kanban() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  // Filter state variables
  const [searchText, setSearchText] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>(
    undefined
  );
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined
  );
  const [startDateFilter, setStartDateFilter] = useState<string | undefined>(
    undefined
  );
  const [endDateFilter, setEndDateFilter] = useState<string | undefined>(
    undefined
  );
  const [createdFromDate, setCreatedFromDate] = useState<string | undefined>(
    undefined
  );
  const [createdToDate, setCreatedToDate] = useState<string | undefined>(
    undefined
  );
  const [myTasksOnly, setMyTasksOnly] = useState(false);

  const resetFilters = () => {
    setSearchText("");
    setPriorityFilter(undefined);
    setStatusFilter(undefined);
    setStartDateFilter(undefined);
    setEndDateFilter(undefined);
    setCreatedFromDate(undefined);
    setCreatedToDate(undefined);
    setMyTasksOnly(false);
  };

  useEffect(() => {
    fetchTasks();

    // Set up real-time subscription to tasks table
    const channel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tasks",
        },
        (payload) => {
          console.log("New task inserted:", payload.new);
          fetchTasks(); // Refresh tasks when a new task is added
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
        },
        (payload) => {
          console.log("Task updated:", payload.new);
          fetchTasks(); // Refresh tasks when a task is updated
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "tasks",
        },
        (payload) => {
          console.log("Task deleted:", payload.old);
          fetchTasks(); // Refresh tasks when a task is deleted
        }
      )
      .subscribe();

    // Clean up subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          *,
          task_assignments(
            user_id,
            users!task_assignments_user_id_fkey(full_name)
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const isTaskFiltered = (task: Task) => {
    // Apply search filter
    if (
      searchText &&
      !task.title.toLowerCase().includes(searchText.toLowerCase()) &&
      (!task.description ||
        !task.description.toLowerCase().includes(searchText.toLowerCase()))
    ) {
      return false;
    }

    // Apply priority filter
    if (priorityFilter && task.priority !== priorityFilter) return false;

    // Apply status filter
    if (statusFilter && task.status !== statusFilter) return false;

    // Apply my tasks filter
    if (myTasksOnly && userProfile?.id) {
      const isAssignedToUser = task.task_assignments?.some(
        (assignment) => assignment.user_id === userProfile.id
      );
      if (!isAssignedToUser) return false;
    }

    // Apply creation date filters
    if (task.created_at) {
      const taskCreatedDate = dayjs(task.created_at);

      if (
        createdFromDate &&
        taskCreatedDate.isBefore(dayjs(createdFromDate), "day")
      )
        return false;
      if (createdToDate && taskCreatedDate.isAfter(dayjs(createdToDate), "day"))
        return false;
    } else if (createdFromDate || createdToDate) {
      // If there's a creation date filter but the task has no creation date, exclude it
      if (createdFromDate || createdToDate) return false;
    }

    // Apply due date filters
    if (task.due_date) {
      const taskDueDate = dayjs(task.due_date);

      if (
        startDateFilter &&
        taskDueDate.isBefore(dayjs(startDateFilter), "day")
      )
        return false;
      if (endDateFilter && taskDueDate.isAfter(dayjs(endDateFilter), "day"))
        return false;
    } else if (startDateFilter || endDateFilter) {
      // If there's a due date filter but the task has no due date, we might want to handle this case
      // For now, we'll exclude tasks without due dates if date filters are applied
      if (startDateFilter || endDateFilter) return false;
    }

    return true;
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter((task) => {
      // Check if task matches current status
      if (task.status !== status) return false;

      // Apply all other filters using the helper function
      return isTaskFiltered(task);
    });
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
        <Badge variant="outline">
          {tasks.filter(isTaskFiltered).length} Filtered Tasks
        </Badge>
      </div>

      {/* Filter Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="max-w-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={createdFromDate || ""}
            onChange={(e) => setCreatedFromDate(e.target.value || undefined)}
            placeholder="Created from"
            className="max-w-[140px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={createdToDate || ""}
            onChange={(e) => setCreatedToDate(e.target.value || undefined)}
            placeholder="Created to"
            className="max-w-[140px]"
          />
        </div> */}

        {/* <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={startDateFilter || ""}
            onChange={(e) => setStartDateFilter(e.target.value || undefined)}
            placeholder="Due from"
            className="max-w-[140px]"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={endDateFilter || ""}
            onChange={(e) => setEndDateFilter(e.target.value || undefined)}
            placeholder="Due to"
            className="max-w-[140px]"
          />
        </div> */}

        {(userProfile?.role === "employee" ||
          userProfile?.role === "senior" ||
          userProfile?.role === "manager") && (
          <div className="flex items-center gap-2 lg:col-span-1">
            <button
              onClick={() => setMyTasksOnly(!myTasksOnly)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                myTasksOnly
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {myTasksOnly ? "My Tasks" : "All Tasks"}
            </button>
            <button
              onClick={resetFilters}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium text-gray-700"
            >
              Reset
            </button>
          </div>
        )}
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
                        <Badge
                          variant={priorityColors[task.priority]}
                          className="text-xs"
                        >
                          {task.priority.toUpperCase()}
                        </Badge>
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground">
                            {dayjs(task.due_date).format("MMM DD")}
                          </span>
                        )}
                      </div>

                      {task.task_assignments &&
                        task.task_assignments.length > 0 && (
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
