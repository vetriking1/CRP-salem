import { Card, Row, Col, Statistic, Select, DatePicker, Space, Table, Progress, Tag } from 'antd';
import {
  TrophyOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

const { Option } = Select;
const { RangePicker } = DatePicker;

const COLORS = ['hsl(var(--accent))', 'hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

export default function Analytics() {
  const taskCompletionTrend = [
    { month: 'Jan', completed: 32, assigned: 40 },
    { month: 'Feb', completed: 38, assigned: 42 },
    { month: 'Mar', completed: 45, assigned: 48 },
    { month: 'Apr', completed: 40, assigned: 45 },
    { month: 'May', completed: 52, assigned: 55 },
    { month: 'Jun', completed: 48, assigned: 50 },
  ];

  const slaCompliance = [
    { name: 'Within SLA', value: 75 },
    { name: 'SLA Breached', value: 15 },
    { name: 'At Risk', value: 10 },
  ];

  const pendingReasons = [
    { reason: 'Data Missing', count: 12, percentage: 48 },
    { reason: 'Clarity Needed', count: 8, percentage: 32 },
    { reason: 'Under Review', count: 5, percentage: 20 },
  ];

  const teamPerformance = [
    { team: 'Tax Compliance', tasks: 145, completed: 120, onTime: 105, rating: 4.5 },
    { team: 'Data Management', tasks: 98, completed: 85, onTime: 78, rating: 4.2 },
  ];

  const specialtyData = [
    { specialty: 'GST Filing', value: 8.5 },
    { specialty: 'Income Tax', value: 7.8 },
    { specialty: 'TDS Return', value: 6.5 },
    { specialty: 'Audit Support', value: 9.2 },
    { specialty: 'Data Entry', value: 5.5 },
  ];

  const topPerformers = [
    { rank: 1, name: 'David Employee', completed: 28, avgTime: '5.2h', rating: 4.8 },
    { rank: 2, name: 'Emma Worker', completed: 24, avgTime: '6.1h', rating: 4.6 },
    { rank: 3, name: 'Lisa Reviewer', completed: 20, avgTime: '7.5h', rating: 4.5 },
    { rank: 4, name: 'Mike DataCollector', completed: 18, avgTime: '5.8h', rating: 4.3 },
  ];

  const workloadUtilization = [
    { name: 'David Employee', capacity: 40, utilized: 35, efficiency: 87 },
    { name: 'Emma Worker', capacity: 40, utilized: 38, efficiency: 95 },
    { name: 'Lisa Reviewer', capacity: 40, utilized: 32, efficiency: 80 },
    { name: 'Mike DataCollector', capacity: 40, utilized: 30, efficiency: 75 },
  ];

  const performerColumns = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      render: (rank: number) => (
        <Space>
          {rank === 1 && <TrophyOutlined className="text-warning text-lg" />}
          <span className="font-bold">#{rank}</span>
        </Space>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <span className="font-medium">{text}</span>,
    },
    {
      title: 'Tasks Completed',
      dataIndex: 'completed',
      key: 'completed',
      render: (value: number) => (
        <Space>
          <span className="font-bold text-accent">{value}</span>
          <RiseOutlined className="text-success" />
        </Space>
      ),
    },
    {
      title: 'Avg Time',
      dataIndex: 'avgTime',
      key: 'avgTime',
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      render: (rating: number) => (
        <Tag color="gold">{rating} ⭐</Tag>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Analytics</h1>
          <p className="text-muted-foreground">Comprehensive insights into team performance and task metrics</p>
        </div>
        <Space>
          <RangePicker />
          <Select defaultValue="all" className="w-40">
            <Option value="all">All Teams</Option>
            <Option value="tax">Tax Compliance</Option>
            <Option value="data">Data Management</Option>
          </Select>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="border-border">
            <Statistic
              title="Completion Rate"
              value={87.5}
              precision={1}
              suffix="%"
              prefix={<RiseOutlined className="text-success" />}
              valueStyle={{ color: 'hsl(var(--success))' }}
            />
            <div className="text-xs text-success mt-2">+5.2% from last month</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="border-border">
            <Statistic
              title="Avg Turnaround"
              value={6.4}
              precision={1}
              suffix="hrs"
              prefix={<ClockCircleOutlined className="text-primary" />}
              valueStyle={{ color: 'hsl(var(--primary))' }}
            />
            <div className="text-xs text-destructive mt-2">+0.3hrs from last month</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="border-border">
            <Statistic
              title="SLA Compliance"
              value={85}
              suffix="%"
              prefix={<CheckCircleOutlined className="text-accent" />}
              valueStyle={{ color: 'hsl(var(--accent))' }}
            />
            <div className="text-xs text-success mt-2">+2.5% from last month</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="border-border">
            <Statistic
              title="Active Members"
              value={24}
              prefix={<TeamOutlined className="text-warning" />}
              valueStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <div className="text-xs text-muted-foreground mt-2">Across 2 teams</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Task Completion Trend" className="border-border">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={taskCompletionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="completed" stroke="hsl(var(--accent))" strokeWidth={3} name="Completed" />
                <Line type="monotone" dataKey="assigned" stroke="hsl(var(--primary))" strokeWidth={3} name="Assigned" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="SLA Compliance" className="border-border">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={slaCompliance}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.name}: ${entry.value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {slaCompliance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Team Performance Comparison" className="border-border">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={teamPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="team" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="completed" fill="hsl(var(--accent))" name="Completed" radius={[8, 8, 0, 0]} />
                <Bar dataKey="onTime" fill="hsl(var(--primary))" name="On Time" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Average Time by Specialty" className="border-border">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={specialtyData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="specialty" stroke="hsl(var(--muted-foreground))" />
                <PolarRadiusAxis stroke="hsl(var(--muted-foreground))" />
                <Radar name="Avg Hours" dataKey="value" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.6} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Top Performers" className="border-border">
            <Table
              columns={performerColumns}
              dataSource={topPerformers}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Workload Utilization" className="border-border">
            <div className="space-y-4">
              {workloadUtilization.map((item, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.utilized}h / {item.capacity}h
                    </span>
                  </div>
                  <Progress
                    percent={item.efficiency}
                    strokeColor={
                      item.efficiency >= 90
                        ? 'hsl(var(--success))'
                        : item.efficiency >= 75
                        ? 'hsl(var(--accent))'
                        : 'hsl(var(--warning))'
                    }
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="Pending Task Reasons" className="border-border">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={pendingReasons} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
            <YAxis type="category" dataKey="reason" stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="count" fill="hsl(var(--warning))" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
