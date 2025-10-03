import { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Switch,
  message,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import dayjs from "dayjs";

const { Option } = Select;

export default function RecurringTasks() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [recurringTasks, setRecurringTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [form] = Form.useForm();
  const [taskTemplates, setTaskTemplates] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    if (!userProfile) return;

    if (userProfile.role !== "admin" && userProfile.role !== "data_collector") {
      navigate("/tasks");
      return;
    }

    fetchRecurringTasks();
    fetchTaskTemplates();
    fetchTeams();
  }, [userProfile]);

  const fetchRecurringTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("recurring_tasks")
        .select(
          `
          *,
          task_templates(name),
          teams(name)
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecurringTasks(data || []);
    } catch (error) {
      console.error("Error fetching recurring tasks:", error);
      message.error("Failed to load recurring tasks");
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskTemplates = async () => {
    const { data } = await supabase
      .from("task_templates")
      .select("id,name")
      .eq("is_active", true);
    if (data) setTaskTemplates(data);
  };

  const fetchTeams = async () => {
    const { data } = await supabase
      .from("teams")
      .select("id,name")
      .eq("is_active", true);
    if (data) setTeams(data);
  };

  const handleCreate = () => {
    setEditingTask(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingTask(record);
    form.setFieldsValue({
      ...record,
      recurrence_day: record.recurrence_day?.toString(),
      recurrence_month: record.recurrence_month?.toString(),
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("recurring_tasks")
        .delete()
        .eq("id", id);
      if (error) throw error;
      message.success("Recurring task deleted successfully");
      fetchRecurringTasks();
    } catch (error) {
      message.error("Failed to delete recurring task");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("recurring_tasks")
        .update({ is_active: !isActive })
        .eq("id", id);
      if (error) throw error;
      message.success(
        `Recurring task ${!isActive ? "activated" : "deactivated"}`
      );
      fetchRecurringTasks();
    } catch (error) {
      message.error("Failed to update recurring task");
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        title: values.title,
        description: values.description,
        template_id: values.template_id || null,
        team_id: values.team_id,
        priority: values.priority,
        difficulty: values.difficulty,
        estimated_hours: 0,
        recurrence_frequency: values.recurrence_frequency,
        recurrence_day: values.recurrence_day
          ? parseInt(values.recurrence_day)
          : null,
        recurrence_month: values.recurrence_month
          ? parseInt(values.recurrence_month)
          : null,
        recurrence_date: values.recurrence_date || null,
        is_active: true,
        created_by: userProfile?.id,
      };

      if (editingTask) {
        const { error } = await supabase
          .from("recurring_tasks")
          .update(payload)
          .eq("id", editingTask.id);
        if (error) throw error;
        message.success("Recurring task updated successfully");
      } else {
        const { error } = await supabase
          .from("recurring_tasks")
          .insert([payload]);
        if (error) throw error;
        message.success("Recurring task created successfully");
      }

      setModalVisible(false);
      form.resetFields();
      fetchRecurringTasks();
    } catch (error: any) {
      message.error(error.message || "Failed to save recurring task");
    }
  };

  const columns = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text: string) => <span className="font-medium">{text}</span>,
    },
    {
      title: "Team",
      key: "team",
      render: (record: any) => record.teams?.name || "-",
    },
    {
      title: "Frequency",
      dataIndex: "recurrence_frequency",
      key: "recurrence_frequency",
      render: (freq: string) => (
        <Tag color="blue" icon={<CalendarOutlined />}>
          {freq.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Schedule",
      key: "schedule",
      render: (record: any) => {
        if (record.recurrence_frequency === "weekly") {
          const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          return `Every ${days[record.recurrence_day]}`;
        } else if (record.recurrence_frequency === "monthly") {
          return `Day ${record.recurrence_day} of month`;
        } else {
          return dayjs(record.recurrence_date).format("MMM DD");
        }
      },
    },
    {
      title: "Next Generation",
      dataIndex: "next_generation_date",
      key: "next_generation_date",
      render: (date: string) =>
        date ? dayjs(date).format("MMM DD, YYYY") : "-",
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (priority: string) => (
        <Tag
          color={
            priority === "urgent"
              ? "red"
              : priority === "high"
              ? "orange"
              : priority === "medium"
              ? "blue"
              : "default"
          }
        >
          {priority.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "is_active",
      key: "is_active",
      render: (isActive: boolean, record: any) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleActive(record.id, isActive)}
          checkedChildren="Active"
          unCheckedChildren="Inactive"
        />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: any) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            Edit
          </Button>
          <Button
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
            danger
            size="small"
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">
          Recurring Tasks Management
        </h1>
        <Space>
          <Button onClick={() => navigate("/tasks")}>Back to Tasks</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create Recurring Task
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={recurringTasks}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingTask ? "Edit Recurring Task" : "Create Recurring Task"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="title"
            label="Task Title"
            rules={[{ required: true }]}
          >
            <Input placeholder="Enter task title" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Enter task description" />
          </Form.Item>

          <Form.Item name="team_id" label="Team" rules={[{ required: true }]}>
            <Select placeholder="Select team (optional)" allowClear>
              {teams.map((team) => (
                <Option key={team.id} value={team.id}>
                  {team.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="template_id" label="Task Template">
            <Select placeholder="Select template (optional)" allowClear>
              {taskTemplates.map((template) => (
                <Option key={template.id} value={template.id}>
                  {template.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Space style={{ width: "100%" }} size="large">
            <Form.Item
              name="priority"
              label="Priority"
              initialValue="medium"
              rules={[{ required: true }]}
            >
              <Select style={{ width: 150 }}>
                <Option value="low">Low</Option>
                <Option value="medium">Medium</Option>
                <Option value="high">High</Option>
                <Option value="urgent">Urgent</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="difficulty"
              label="Difficulty"
              initialValue="medium"
              rules={[{ required: true }]}
            >
              <Select style={{ width: 150 }}>
                <Option value="easy">Easy</Option>
                <Option value="medium">Medium</Option>
                <Option value="hard">Hard</Option>
                <Option value="expert">Expert</Option>
              </Select>
            </Form.Item>
          </Space>

          <Form.Item
            name="recurrence_frequency"
            label="Recurrence Frequency"
            rules={[{ required: true }]}
          >
            <Select
              placeholder="Select frequency"
              onChange={() =>
                form.setFieldsValue({
                  recurrence_day: undefined,
                  recurrence_month: undefined,
                  recurrence_date: undefined,
                })
              }
            >
              <Option value="weekly">Weekly</Option>
              <Option value="monthly">Monthly</Option>
              <Option value="yearly">Yearly</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) =>
              prev.recurrence_frequency !== curr.recurrence_frequency
            }
          >
            {({ getFieldValue }) => {
              const frequency = getFieldValue("recurrence_frequency");
              if (frequency === "weekly") {
                return (
                  <Form.Item
                    name="recurrence_day"
                    label="Day of Week"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="Select day">
                      <Option value="0">Sunday</Option>
                      <Option value="1">Monday</Option>
                      <Option value="2">Tuesday</Option>
                      <Option value="3">Wednesday</Option>
                      <Option value="4">Thursday</Option>
                      <Option value="5">Friday</Option>
                      <Option value="6">Saturday</Option>
                    </Select>
                  </Form.Item>
                );
              } else if (frequency === "monthly") {
                return (
                  <Form.Item
                    name="recurrence_day"
                    label="Day of Month"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="Select day">
                      {Array.from({ length: 31 }, (_, i) => (
                        <Option key={i + 1} value={String(i + 1)}>
                          {i + 1}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                );
              } else if (frequency === "yearly") {
                return (
                  <Space>
                    <Form.Item
                      name="recurrence_month"
                      label="Month"
                      rules={[{ required: true }]}
                    >
                      <Select placeholder="Select month" style={{ width: 150 }}>
                        {[
                          "Jan",
                          "Feb",
                          "Mar",
                          "Apr",
                          "May",
                          "Jun",
                          "Jul",
                          "Aug",
                          "Sep",
                          "Oct",
                          "Nov",
                          "Dec",
                        ].map((m, i) => (
                          <Option key={i + 1} value={String(i + 1)}>
                            {m}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      name="recurrence_date"
                      label="Date"
                      rules={[{ required: true }]}
                    >
                      <Input type="date" style={{ width: 200 }} />
                    </Form.Item>
                  </Space>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
