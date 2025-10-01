import { useState, useEffect } from 'react';
import { Badge, Button, Dropdown, List, Typography, Space, Empty } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  task_id: string | null;
  is_read: boolean;
  created_at: string;
}

export const NotificationDropdown = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    subscribeToNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.task_id) {
      navigate(`/tasks/${notification.task_id}`);
    }
    setOpen(false);
  };

  const dropdownContent = (
    <div className="w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg">
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
        <Text strong className="text-lg">Notifications</Text>
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            onClick={markAllAsRead}
            icon={<CheckOutlined />}
          >
            Mark all as read
          </Button>
        )}
      </div>
      
      {notifications.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No notifications"
          className="py-8"
        />
      ) : (
        <List
          dataSource={notifications}
          renderItem={(notification) => (
            <List.Item
              className={`cursor-pointer hover:bg-gray-50 transition-colors px-4 ${
                !notification.is_read ? 'bg-blue-50' : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <Space direction="vertical" size="small" className="w-full">
                <div className="flex items-start justify-between">
                  <Text strong className="text-sm">
                    {notification.title}
                  </Text>
                  {!notification.is_read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 ml-2 mt-1" />
                  )}
                </div>
                <Text className="text-xs text-gray-600">
                  {notification.message}
                </Text>
                <Text type="secondary" className="text-xs">
                  {dayjs(notification.created_at).fromNow()}
                </Text>
              </Space>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={unreadCount} offset={[-5, 5]}>
        <Button
          type="text"
          icon={<BellOutlined className="text-xl" />}
          className="flex items-center justify-center"
        />
      </Badge>
    </Dropdown>
  );
};
