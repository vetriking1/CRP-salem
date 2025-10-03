import { useState } from 'react';
import { Badge, Button, Dropdown, List, Typography, Space, Empty, Tag, Tooltip } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationService } from '@/services/notificationService';

dayjs.extend(relativeTime);

const { Text } = Typography;

export const NotificationDropdown = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  } = useNotifications(20);

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.task_id) {
      navigate(`/tasks/${notification.task_id}`);
    }
    setOpen(false);
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const dropdownContent = (
    <div className="w-96 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg">
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
        <Text strong className="text-lg">Notifications</Text>
        <Space>
          <Tooltip title="Refresh">
            <Button
              type="text"
              size="small"
              onClick={refreshNotifications}
              icon={<ReloadOutlined />}
              loading={loading}
            />
          </Tooltip>
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
        </Space>
      </div>
      
      {notifications.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={loading ? "Loading notifications..." : "No notifications"}
          className="py-8"
        />
      ) : (
        <List
          loading={loading}
          dataSource={notifications}
          renderItem={(notification) => (
            <List.Item
              className={`cursor-pointer hover:bg-gray-50 transition-colors px-4 ${
                !notification.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
              actions={[
                <Tooltip title="Delete" key="delete">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => handleDeleteNotification(e, notification.id)}
                  />
                </Tooltip>
              ]}
            >
              <Space direction="vertical" size="small" className="w-full">
                <div className="flex items-start justify-between">
                  <Space>
                    <span className="text-lg">
                      {NotificationService.getNotificationIcon(notification.type)}
                    </span>
                    <Text strong className="text-sm">
                      {notification.title}
                    </Text>
                  </Space>
                  <Space>
                    <Tag 
                      color={NotificationService.getNotificationColor(notification.type)}
                      size="small"
                    >
                      {notification.type.replace('_', ' ').toUpperCase()}
                    </Tag>
                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </Space>
                </div>
                {notification.message && (
                  <Text className="text-xs text-gray-600">
                    {notification.message}
                  </Text>
                )}
                <div className="flex items-center justify-between">
                  <Text type="secondary" className="text-xs">
                    {dayjs(notification.created_at).fromNow()}
                  </Text>
                  {notification.task && (
                    <Tag size="small" color="geekblue">
                      Task: {notification.task.title?.slice(0, 20)}{notification.task.title?.length > 20 ? '...' : ''}
                    </Tag>
                  )}
                </div>
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
      <Badge count={unreadCount} offset={[-5, 5]} overflowCount={99}>
        <Button
          type="text"
          icon={<BellOutlined className={`text-xl ${unreadCount > 0 ? 'text-blue-500' : ''}`} />}
          className="flex items-center justify-center"
        />
      </Badge>
    </Dropdown>
  );
};
