import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Table,
  Tag,
  Timeline,
  Space,
  Spin,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  TeamOutlined,
  TrophyOutlined,
  RiseOutlined,
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useEffect, useState } from "react";
import {
  getDashboardStats,
  getRecentTasks,
  getTopPerformers,
  getRecentActivity,
  getTasksByStatus,
  getWeeklyTaskData,
  TaskWithAssignee,
  TopPerformer,
  ActivityItem,
} from "@/services/dashboardService";

const COLORS = [
  "hsl(var(--accent))",
  "hsl(var(--primary))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
];

export default function Dashboard() {
  const [stats, setStats] = useState<
    {
      title: string;
      value: number;
      icon: JSX.Element;
      color: string;
      prefix: JSX.Element | null;
    }[]
  >([]);
  const [tasksByStatus, setTasksByStatus] = useState<
    { name: string; value: number }[]
  >([]);
  const [weeklyData, setWeeklyData] = useState<
    { day: string; completed: number; assigned: number }[]
  >([]);
  const [recentTasks, setRecentTasks] = useState<TaskWithAssignee[]>([]);
  const [leaderboard, setLeaderboard] = useState<TopPerformer[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const statusColors: { [key: string]: string } = {
    in_progress: "processing",
    assigned: "default",
    review: "warning",
    pending: "error",
    completed: "success",
    not_started: "default",
    delivered: "success",
    rejected: "error",
  };

  const priorityColors: { [key: string]: string } = {
    urgent: "error",
    high: "warning",
    medium: "processing",
    low: "default",
  };

  const columns = [
    {
      title: "Task",
      dataIndex: "title",
      key: "title",
      render: (text: string) => <span className="font-medium">{text}</span>,
    },
    {
      title: "Assignee",
      dataIndex: "assignee",
      key: "assignee",
      render: (assignee: any) => (
        <span>{assignee?.full_name || "Unassigned"}</span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={statusColors[status] || "default"}>
          {status?.replace("_", " ").toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (priority: string) => (
        <Tag color={priorityColors[priority] || "default"}>
          {priority?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Progress",
      dataIndex: "progress",
      key: "progress",
      render: (progress: number) => (
        <Progress
          percent={progress}
          size="small"
          strokeColor="hsl(var(--accent))"
        />
      ),
    },
  ];

  const leaderboardColumns = [
    {
      title: "Rank",
      dataIndex: "rank",
      key: "rank",
      render: (rank: number) => (
        <Space>
          {rank === 1 && <TrophyOutlined className="text-warning text-lg" />}
          <span className="font-bold">#{rank}</span>
        </Space>
      ),
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <span className="font-medium">{text}</span>,
    },
    {
      title: "Tasks Completed",
      dataIndex: "completed",
      key: "completed",
      render: (value: number) => (
        <Space>
          <span className="font-bold text-accent">{value}</span>
          <RiseOutlined className="text-success" />
        </Space>
      ),
    },
  ];

  const timelineItems = recentActivity.map((activity) => ({
    color:
      activity.action.includes("completed") ||
      activity.action.includes("delivered")
        ? "green"
        : activity.action.includes("assigned")
        ? "blue"
        : activity.action.includes("pending")
        ? "orange"
        : activity.action.includes("review")
        ? "purple"
        : "gray",
    children: (
      <div>
        <strong>{activity.action}:</strong> {activity.task_title}
        <div className="text-xs text-muted-foreground">
          {new Date(activity.created_at).toLocaleString()}
        </div>
      </div>
    ),
  }));

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch all data concurrently
        const [
          statsData,
          recentTasksData,
          leaderboardData,
          activityData,
          statusData,
          weeklyData,
        ] = await Promise.all([
          getDashboardStats(),
          getRecentTasks(),
          getTopPerformers(),
          getRecentActivity(),
          getTasksByStatus(),
          getWeeklyTaskData(),
        ]);

        // Map stats to the expected format
        setStats([
          {
            title: "Active Tasks",
            value: statsData.active,
            icon: <CheckCircleOutlined />,
            color: "text-accent",
            prefix: null,
          },
          {
            title: "Pending",
            value: statsData.pending,
            icon: <ClockCircleOutlined />,
            color: "text-warning",
            prefix: null,
          },
          {
            title: "Overdue",
            value: statsData.overdue,
            icon: <ExclamationCircleOutlined />,
            color: "text-destructive",
            prefix: null,
          },
          {
            title: "Completed Tasks",
            value: statsData.completedToday,
            icon: <CheckCircleOutlined />,
            color: "text-success",
            prefix: null,
          },
        ]);

        setTasksByStatus(statusData);
        setWeeklyData(weeklyData);
        setRecentTasks(recentTasksData);
        setLeaderboard(leaderboardData);
        setRecentActivity(activityData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's your task overview.
        </p>
      </div>

      <Row gutter={[16, 16]}>
        {stats.map((stat, idx) => (
          <Col xs={24} sm={12} lg={6} key={idx}>
            <Card className="hover:shadow-lg transition-shadow border-border">
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={
                  <span className={`${stat.color} text-2xl`}>{stat.icon}</span>
                }
                valueStyle={{ color: "hsl(var(--foreground))" }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Monthly Task Overview" className="border-border">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="completed"
                  fill="hsl(var(--accent))"
                  name="Completed"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="assigned"
                  fill="hsl(var(--primary))"
                  name="Assigned"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Tasks by Status" className="border-border">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tasksByStatus}
                  cx="40%"
                  cy="40%"
                  labelLine={false}
                  label={(entry: any) =>
                    `${entry.name}: ${((entry.percent || 0) * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tasksByStatus.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Recent Tasks" className="border-border">
            <Table
              columns={columns}
              dataSource={recentTasks.map((task, index) => ({
                ...task,
                key: task.id,
                task: task.title,
                assignee: task.assignee,
              }))}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <TeamOutlined />
                <span>Top Performers</span>
              </Space>
            }
            className="border-border"
          >
            <Table
              columns={leaderboardColumns}
              dataSource={leaderboard.map((performer, index) => ({
                ...performer,
                key: performer.id,
              }))}
              pagination={false}
              size="small"
              showHeader={false}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Recent Activity" className="border-border">
        <Timeline items={timelineItems} />
      </Card>
    </div>
  );
}
