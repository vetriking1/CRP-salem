import { useState, useEffect } from "react";
import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Badge,
  Progress,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import dayjs from "dayjs";
import {
  calculateDueDateInfo,
  getDueDateStatusText,
  getDueDateStatusColor,
  shouldUpdatePriority,
  type Priority,
} from "@/utils/dueDateUtils";

const { Option } = Select;

export default function Tasks() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined
  );
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>(
    undefined
  );
  const [templateFilter, setTemplateFilter] = useState<string | undefined>(
    undefined
  );
  const [dueDateFilter, setDueDateFilter] = useState<string | undefined>(
    undefined
  );
  const [taskTemplates, setTaskTemplates] = useState<any[]>([]);
  // "My Tasks" filter - default ON for employees
  const [showMyTasksOnly, setShowMyTasksOnly] = useState<boolean>(
    userProfile?.role === "employee" || userProfile?.role === "senior"
  );

  useEffect(() => {
    fetchTasks();
    fetchTaskTemplates();

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
          created_by_user:users!tasks_created_by_fkey(full_name),
          task_assignments(
            user_id,
            is_active,
            is_primary,
            users!task_assignments_user_id_fkey(full_name)
          ),
          task_templates(name)
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

  // Expose refresh function so other components can trigger an update
  useEffect(() => {
    // This will make fetchTasks globally available
    (window as any).refreshTasks = fetchTasks;

    // Clean up function when component unmounts
    return () => {
      delete (window as any).refreshTasks;
    };
  }, [fetchTasks]);

  const fetchTaskTemplates = async () => {
    const { data } = await supabase.from("task_templates").select("id,name");
    if (data) {
      setTaskTemplates(data);
    }
  };

  const statusColors: { [key: string]: string } = {
    not_started: "default",
    assigned: "cyan",
    in_progress: "processing",
    pending: "error",
    review: "warning",
    completed: "success",
    delivered: "purple",
    rejected: "error",
  };

  const priorityColors: { [key: string]: string } = {
    urgent: "error",
    high: "warning",
    medium: "processing",
    low: "default",
  };

  // Function to get effective priority (considering due date)
  const getEffectivePriority = (
    task: any
  ): { priority: Priority; isAdjusted: boolean } => {
    const dueDateInfo = calculateDueDateInfo(
      task.due_date,
      task.priority as Priority
    );
    const shouldAdjust = shouldUpdatePriority(
      task.priority as Priority,
      dueDateInfo.suggestedPriority
    );
    return {
      priority: shouldAdjust
        ? dueDateInfo.suggestedPriority
        : (task.priority as Priority),
      isAdjusted: shouldAdjust,
    };
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchText.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = !statusFilter || task.status === statusFilter;
    const matchesPriority = !priorityFilter || task.priority === priorityFilter;
    const matchesTemplate =
      !templateFilter || task.template_id === templateFilter;

    // "My Tasks" filter - show tasks where current user is an active assignee
    const matchesMyTasks =
      !showMyTasksOnly ||
      task.task_assignments?.some(
        (a: any) => a.user_id === userProfile?.id && a.is_active
      );

    // Due date filter
    let matchesDueDate = true;
    if (dueDateFilter) {
      const dueDateInfo = calculateDueDateInfo(task.due_date);
      const isCompleted =
        task.status === "completed" || task.status === "delivered";
      switch (dueDateFilter) {
        case "overdue":
          matchesDueDate = dueDateInfo.isOverdue && !isCompleted;
          break;
        case "due_today":
          matchesDueDate = dueDateInfo.isDueToday;
          break;
        case "due_soon":
          matchesDueDate = dueDateInfo.isDueSoon;
          break;
        default:
          matchesDueDate = true;
      }
    }

    return (
      matchesSearch &&
      matchesStatus &&
      matchesPriority &&
      matchesTemplate &&
      matchesDueDate &&
      matchesMyTasks
    );
  });

  const columns = [
    // {
    //   title: "Task ID",
    //   dataIndex: "id",
    //   key: "id",
    //   render: (id: string) => (
    //     <span className="font-mono text-xs">{id.slice(0, 8)}</span>
    //   ),
    // },
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text: string) => <span className="font-medium">{text}</span>,
    },
    {
      title: "Template",
      dataIndex: "task_templates",
      key: "template",
      render: (template: { name: string } | null) => template?.name || "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={statusColors[status] || "default"}>
          {status.replace("_", " ").toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (priority: string, record: any) => {
        const { priority: effectivePriority, isAdjusted } =
          getEffectivePriority(record);
        const dueDateInfo = calculateDueDateInfo(
          record.due_date,
          priority as Priority
        );
        const isCompleted =
          record.status === "completed" || record.status === "delivered";

        return (
          <Space direction="vertical" size={0}>
            <Space size={4}>
              <Tag color={priorityColors[effectivePriority]}>
                {effectivePriority.toUpperCase()}
              </Tag>
              {isAdjusted && (
                <Tooltip title="Priority auto-adjusted due to due date">
                  <ExclamationCircleOutlined style={{ color: "#ff7875" }} />
                </Tooltip>
              )}
            </Space>
            {dueDateInfo.status !== "normal" && !isCompleted && (
              <Tag
                color={getDueDateStatusColor(dueDateInfo)}
                icon={<ClockCircleOutlined />}
                className="text-xs"
              >
                {getDueDateStatusText(dueDateInfo)}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: "Assignee",
      key: "assignee",
      render: (record: any) => {
        const assignees = record.task_assignments
          ?.map((a: any) => a.users?.full_name)
          .filter(Boolean);
        return assignees?.length > 0 ? assignees.join(", ") : "Unassigned";
      },
    },
    {
      title: "Due Date",
      dataIndex: "due_date",
      key: "due_date",
      render: (date: string, record: any) => {
        if (!date) return "-";

        const dueDateInfo = calculateDueDateInfo(date);
        const formattedDate = dayjs(date).format("MMM DD, YYYY");
        const isCompleted =
          record.status === "completed" || record.status === "delivered";

        return (
          <Space direction="vertical" size={0}>
            <span
              className={
                dueDateInfo.isOverdue && !isCompleted
                  ? "text-red-600 font-medium"
                  : ""
              }
            >
              {formattedDate}
            </span>
            {dueDateInfo.status !== "normal" && !isCompleted && (
              <Tag
                color={getDueDateStatusColor(dueDateInfo)}
                icon={<ClockCircleOutlined />}
                className="text-xs"
              >
                {getDueDateStatusText(dueDateInfo)}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: "Progress",
      key: "progress",
      render: (record: any) => {
        const progress =
          record.status === "completed" || record.status === "delivered"
            ? 100
            : record.status === "in_progress"
            ? 50
            : record.status === "assigned"
            ? 25
            : 0;

        const dueDateInfo = calculateDueDateInfo(record.due_date);
        const isCompleted =
          record.status === "completed" || record.status === "delivered";
        const strokeColor =
          dueDateInfo.isOverdue && progress < 100 && !isCompleted
            ? "#ff4d4f"
            : undefined;

        return (
          <Progress
            percent={progress}
            size="small"
            strokeColor={strokeColor}
            status={
              dueDateInfo.isOverdue && progress < 100 && !isCompleted
                ? "exception"
                : "normal"
            }
          />
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: any) => (
        <Button
          icon={<EyeOutlined />}
          onClick={() => navigate(`/tasks/${record.id}`)}
          size="small"
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
        <Space>
          {(userProfile?.role === "admin" ||
            userProfile?.role === "data_collector") && (
            <Button
              icon={<ReloadOutlined />}
              onClick={() => navigate("/recurring-tasks")}
              size="large"
            >
              Recurring Tasks
            </Button>
          )}
          {userProfile?.role === "data_collector" && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/tasks/create")}
              size="large"
            >
              Create Task
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchTasks}
            size="large"
            title="Refresh Tasks"
          >
            Refresh
          </Button>
        </Space>
      </div>

      <Card>
        <Space direction="vertical" size="large" className="w-full">
          <div className="flex gap-4 items-center flex-wrap">
            <Input
              placeholder="Search tasks..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
            />

            <Select
              placeholder="Filter by Status"
              style={{ width: 200 }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              suffixIcon={<FilterOutlined />}
            >
              <Option value="not_started">Not Started</Option>
              <Option value="assigned">Assigned</Option>
              <Option value="in_progress">In Progress</Option>
              <Option value="pending">Pending</Option>
              <Option value="review">Review</Option>
              <Option value="completed">Completed</Option>
              <Option value="delivered">Delivered</Option>
            </Select>

            <Select
              placeholder="Filter by Priority"
              style={{ width: 200 }}
              allowClear
              value={priorityFilter}
              onChange={setPriorityFilter}
              suffixIcon={<FilterOutlined />}
            >
              <Option value="urgent">Urgent</Option>
              <Option value="high">High</Option>
              <Option value="medium">Medium</Option>
              <Option value="low">Low</Option>
            </Select>

            <Select
              placeholder="Filter by Template"
              style={{ width: 200 }}
              allowClear
              value={templateFilter}
              onChange={setTemplateFilter}
              suffixIcon={<FilterOutlined />}
            >
              {taskTemplates.map((template) => (
                <Option key={template.id} value={template.id}>
                  {template.name}
                </Option>
              ))}
            </Select>

            <Select
              placeholder="Filter by Due Date"
              style={{ width: 200 }}
              allowClear
              value={dueDateFilter}
              onChange={setDueDateFilter}
              suffixIcon={<FilterOutlined />}
            >
              <Option value="overdue">Overdue</Option>
              <Option value="due_today">Due Today</Option>
              <Option value="due_soon">Due Soon</Option>
            </Select>

            {(userProfile?.role === "employee" ||
              userProfile?.role === "senior" ||
              userProfile?.role === "manager") && (
              <Button
                type={showMyTasksOnly ? "primary" : "default"}
                icon={<UserOutlined />}
                onClick={() => setShowMyTasksOnly(!showMyTasksOnly)}
              >
                {showMyTasksOnly ? "My Tasks" : "All Tasks"}
              </Button>
            )}

            <Badge count={filteredTasks.length} showZero>
              <Button>Total Tasks</Button>
            </Badge>
          </div>

          <Table
            columns={columns}
            dataSource={filteredTasks}
            loading={loading}
            rowKey="id"
            rowClassName={(record) => {
              const dueDateInfo = calculateDueDateInfo(record.due_date);
              const isCompleted =
                record.status === "completed" || record.status === "delivered";
              if (dueDateInfo.isOverdue && !isCompleted)
                return "bg-red-50 border-l-4 border-l-red-500";
              if (dueDateInfo.isDueToday && !isCompleted)
                return "bg-orange-50 border-l-4 border-l-orange-500";
              if (dueDateInfo.isDueSoon && !isCompleted)
                return "bg-blue-50 border-l-4 border-l-blue-500";
              return "";
            }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} tasks`,
            }}
          />
        </Space>
      </Card>
    </div>
  );
}
