import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, Button, Tag, DatePicker, Space, Spin, Empty } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, ReloadOutlined } from '@ant-design/icons';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Loader2 } from 'lucide-react';

const { Option } = Select;
const { RangePicker } = DatePicker;

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
  teams: { name: string } | null;
  team_id: string;
}

interface Team {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string;
}

export default function GanttChart() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  
  const today = dayjs();
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(5, 'day'),
    dayjs().add(12, 'day')
  ]);
  
  const startDate = dateRange[0];
  const endDate = dateRange[1];
  const totalDays = endDate.diff(startDate, 'day') + 1;
  const dates = Array.from({ length: totalDays }, (_, i) => startDate.add(i, 'day'));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // Fetch teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .eq('is_active', true);
          
        if (teamsError) throw teamsError;
        setTeams(teamsData || []);
        
        // Fetch users
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('*')
          .eq('is_active', true);
          
        if (usersError) throw usersError;
        setUsers(usersData || []);
        
        // Fetch tasks with team and assignee information
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select(`
            *,
            teams:team_id(name),
            task_assignments(
              users:user_id(full_name)
            )
          `)
          .order('created_at', { ascending: false });
          
        if (tasksError) throw tasksError;
        setTasks(tasksData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const calculateProgress = (task: Task) => {
    switch (task.status) {
      case 'not_started': return 0;
      case 'assigned': return 10;
      case 'in_progress': return 40;
      case 'pending': return 60;
      case 'review': return 80;
      case 'completed': 
      case 'delivered': return 100;
      default: return 0;
    }
  };
  
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (teamFilter !== 'all' && task.team_id !== teamFilter) return false;
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      
      const assignee = task.task_assignments.length > 0 
        ? task.task_assignments[0].users?.full_name || 'Unassigned'
        : 'Unassigned';
        
      if (assigneeFilter !== 'all' && assignee !== assigneeFilter) return false;
      return true;
    });
  }, [tasks, teamFilter, statusFilter, priorityFilter, assigneeFilter]);
  
  const handleZoomIn = () => {
    const newZoomLevel = Math.min(zoomLevel * 1.5, 3);
    setZoomLevel(newZoomLevel);
    
    const centerDate = startDate.add(totalDays / 2, 'day');
    const newRange = Math.floor(totalDays / 1.5);
    setDateRange([
      centerDate.subtract(newRange / 2, 'day'),
      centerDate.add(newRange / 2, 'day')
    ]);
  };
  
  const handleZoomOut = () => {
    const newZoomLevel = Math.max(zoomLevel / 1.5, 0.5);
    setZoomLevel(newZoomLevel);
    
    const centerDate = startDate.add(totalDays / 2, 'day');
    const newRange = Math.floor(totalDays * 1.5);
    setDateRange([
      centerDate.subtract(newRange / 2, 'day'),
      centerDate.add(newRange / 2, 'day')
    ]);
  };
  
  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setDateRange(dates);
    }
  };
  
  const getTaskPosition = (task: Task) => {
    const taskStart = dayjs(task.created_at).isBefore(startDate) ? startDate : dayjs(task.created_at);
    const taskEnd = dayjs(task.due_date || today.add(7, 'day')).isAfter(endDate) ? endDate : dayjs(task.due_date || today.add(7, 'day'));
    
    const left = ((taskStart.diff(startDate, 'day') / totalDays) * 100);
    const width = ((taskEnd.diff(taskStart, 'day') + 1) / totalDays) * 100;
    
    return { left: `${left}%`, width: `${width}%` };
  };
  
  const statusColors: { [key: string]: string } = {
    not_started: '#d9d9d9',
    assigned: '#1890ff',
    in_progress: '#52c41a',
    pending: '#ff4d4f',
    review: '#faad14',
    completed: '#722ed1',
    delivered: '#eb2f96',
  };

  const priorityColors: { [key: string]: string } = {
    urgent: 'error',
    high: 'warning',
    medium: 'processing',
    low: 'default',
  };
  
  const assignees = useMemo(() => {
    const uniqueAssignees = [...new Set(
      tasks.map(task => 
        task.task_assignments.length > 0 
          ? task.task_assignments[0].users?.full_name || 'Unassigned'
          : 'Unassigned'
      )
    )];
    return uniqueAssignees;
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Gantt Chart</h1>
          <p className="text-muted-foreground">Visual timeline of all tasks and their progress</p>
        </div>
        <div className="flex gap-2">
          <RangePicker 
            value={dateRange} 
            onChange={handleDateRangeChange}
            format="DD/MM/YYYY"
          />
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            Refresh
          </Button>
          <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut}>
            Zoom Out
          </Button>
          <Button icon={<ZoomInOutlined />} onClick={handleZoomIn}>
            Zoom In
          </Button>
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <Select 
          placeholder="Filter by Team" 
          value={teamFilter} 
          onChange={setTeamFilter}
          className="w-48"
          allowClear
        >
          <Option value="all">All Teams</Option>
          {teams.map(team => (
            <Option key={team.id} value={team.id}>{team.name}</Option>
          ))}
        </Select>
        
        <Select 
          placeholder="Filter by Status" 
          value={statusFilter} 
          onChange={setStatusFilter}
          className="w-48"
          allowClear
        >
          <Option value="all">All Statuses</Option>
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
          value={priorityFilter} 
          onChange={setPriorityFilter}
          className="w-48"
          allowClear
        >
          <Option value="all">All Priorities</Option>
          <Option value="urgent">Urgent</Option>
          <Option value="high">High</Option>
          <Option value="medium">Medium</Option>
          <Option value="low">Low</Option>
        </Select>
        
        <Select 
          placeholder="Filter by Assignee" 
          value={assigneeFilter} 
          onChange={setAssigneeFilter}
          className="w-48"
          allowClear
        >
          <Option value="all">All Assignees</Option>
          {assignees.map(assignee => (
            <Option key={assignee} value={assignee}>{assignee}</Option>
          ))}
        </Select>
      </div>

      <Card className="border-border overflow-x-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Spin size="large" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <Empty description="No tasks found with the current filters" />
        ) : (
          <div className="min-w-[1000px]">
            {/* Header - Timeline */}
            <div className="flex border-b-2 border-border mb-4">
              <div className="w-64 flex-shrink-0 p-4 font-semibold text-foreground">
                Task / Assignee
              </div>
              <div className="flex-1 flex">
                {dates.map((date, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 text-center p-2 border-l border-border ${
                      date.isSame(today, 'day') ? 'bg-accent/10 font-bold' : ''
                    }`}
                  >
                    <div className="text-xs text-muted-foreground">{date.format('MMM')}</div>
                    <div className="font-medium text-sm">{date.format('DD')}</div>
                    <div className="text-xs text-muted-foreground">{date.format('ddd')}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Task Rows */}
            {filteredTasks.map((task) => {
              const position = getTaskPosition(task);
              const assignee = task.task_assignments.length > 0 
                ? task.task_assignments[0].users?.full_name || 'Unassigned'
                : 'Unassigned';
                
              return (
                <div key={task.id} className="flex border-b border-border hover:bg-muted/30 transition-colors">
                  <div className="w-64 flex-shrink-0 p-4">
                    <div className="font-medium text-sm mb-1">{task.title}</div>
                    <div className="text-xs text-muted-foreground">{assignee}</div>
                    <div className="mt-2">
                      <Tag color={priorityColors[task.priority]} className="text-xs">
                        {task.priority.toUpperCase()}
                      </Tag>
                    </div>
                  </div>
                  <div className="flex-1 relative py-6">
                    {/* Today marker */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-accent z-10"
                      style={{
                        left: `${((today.diff(startDate, 'day') / totalDays) * 100)}%`,
                      }}
                    />
                    
                    {/* Task bar */}
                    <div
                      className="absolute h-8 rounded-lg shadow-md flex items-center px-3 cursor-pointer hover:shadow-lg transition-shadow"
                      style={{
                        ...position,
                        backgroundColor: statusColors[task.status],
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                    >
                      <div className="text-white text-xs font-medium truncate flex-1">
                        {task.id.substring(0, 8)}...
                      </div>
                      <div className="text-white text-xs ml-2">
                        {calculateProgress(task)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: statusColors.in_progress }} />
            <div>
              <div className="text-sm font-medium">In Progress</div>
              <div className="text-xs text-muted-foreground">Active tasks</div>
            </div>
          </div>
        </Card>
        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: statusColors.pending }} />
            <div>
              <div className="text-sm font-medium">Pending</div>
              <div className="text-xs text-muted-foreground">Awaiting data</div>
            </div>
          </div>
        </Card>
        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: statusColors.review }} />
            <div>
              <div className="text-sm font-medium">Review</div>
              <div className="text-xs text-muted-foreground">Under review</div>
            </div>
          </div>
        </Card>
        <Card className="border-border">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: statusColors.completed }} />
            <div>
              <div className="text-sm font-medium">Completed</div>
              <div className="text-xs text-muted-foreground">Done tasks</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}