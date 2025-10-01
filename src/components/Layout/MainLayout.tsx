import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Badge, Avatar, Dropdown, Button, Space } from 'antd';
import {
  DashboardOutlined,
  CheckSquareOutlined,
  BarChartOutlined,
  CalendarOutlined,
  TeamOutlined,
  BellOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SettingOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/cf-logo.jpg';
import { NotificationDropdown } from '@/components/Notifications/NotificationDropdown';

const { Header, Sider, Content } = Layout;

export const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single();
      setUserProfile(data);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: 'Logged out',
      description: 'You have been logged out successfully',
    });
    navigate('/auth');
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">Dashboard</Link>,
    },
    {
      key: '/tasks',
      icon: <CheckSquareOutlined />,
      label: <Link to="/tasks">Tasks</Link>,
    },
    {
      key: '/gantt',
      icon: <CalendarOutlined />,
      label: <Link to="/gantt">Gantt Chart</Link>,
    },
    {
      key: '/kanban',
      icon: <ProjectOutlined />,
      label: <Link to="/kanban">Kanban Board</Link>,
    },
    {
      key: '/analytics',
      icon: <BarChartOutlined />,
      label: <Link to="/analytics">Analytics</Link>,
    },
    {
      key: '/team',
      icon: <TeamOutlined />,
      label: <Link to="/team">Team</Link>,
    },
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: userProfile?.full_name || 'User',
      disabled: true,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="bg-primary shadow-lg"
        theme="dark"
      >
        <div className="flex items-center justify-center h-16 border-b border-primary-hover">
          {!collapsed ? (
            <img src={logo} alt="Compliance First" className="h-10 object-contain" />
          ) : (
            <div className="text-accent text-2xl font-bold">CF</div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          className="bg-primary border-r-0"
        />
      </Sider>
      <Layout>
        <Header className="bg-white shadow-sm px-6 flex items-center justify-between">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="text-lg"
          />
          <Space size="large">
            <NotificationDropdown />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <Avatar src={userProfile?.avatar_url} icon={<UserOutlined />} className="bg-accent" />
                <div className="hidden md:block">
                  <div className="text-sm font-medium text-foreground">{userProfile?.full_name || 'User'}</div>
                  <div className="text-xs text-muted-foreground">{userProfile?.role || 'Role'}</div>
                </div>
              </div>
            </Dropdown>
          </Space>
        </Header>
        <Content className="m-6 p-6 bg-background rounded-lg">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
