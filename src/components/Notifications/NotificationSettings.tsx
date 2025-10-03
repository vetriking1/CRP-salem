import React from 'react';
import { Card, Switch, Button, Space, Typography, Divider, Alert, Badge } from 'antd';
import { 
  BellOutlined, 
  MailOutlined, 
  MobileOutlined, 
  MessageOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  UserOutlined,
  WifiOutlined,
  DisconnectOutlined
} from '@ant-design/icons';
import { useEnhancedNotifications } from '@/hooks/useEnhancedNotifications';

const { Title, Text } = Typography;

export const NotificationSettings: React.FC = () => {
  const {
    preferences,
    updatePreferences,
    isPushSupported,
    isPushSubscribed,
    subscribeToPush,
    unsubscribeFromPush,
    isOnline,
    userPresence,
  } = useEnhancedNotifications();

  const handlePreferenceChange = async (key: string, value: boolean) => {
    await updatePreferences({ [key]: value });
  };

  const handlePushToggle = async () => {
    if (isPushSubscribed) {
      await unsubscribeFromPush();
    } else {
      await subscribeToPush();
    }
  };

  if (!preferences) {
    return <div>Loading notification settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isOnline ? (
              <WifiOutlined className="text-green-500 text-xl" />
            ) : (
              <DisconnectOutlined className="text-red-500 text-xl" />
            )}
            <div>
              <Title level={5} className="mb-0">Connection Status</Title>
              <Text type="secondary">
                {isOnline ? 'Online - Real-time notifications active' : 'Offline - Notifications will sync when reconnected'}
              </Text>
            </div>
          </div>
          <Badge 
            status={isOnline ? 'success' : 'error'} 
            text={isOnline ? 'Connected' : 'Disconnected'} 
          />
        </div>
      </Card>

      {/* User Presence */}
      {userPresence.length > 0 && (
        <Card>
          <Title level={5}>
            <UserOutlined className="mr-2" />
            Active Users ({userPresence.length})
          </Title>
          <div className="flex flex-wrap gap-2">
            {userPresence.map((user, index) => (
              <Badge key={index} status="success" text={`User ${user.user_id}`} />
            ))}
          </div>
        </Card>
      )}

      {/* Notification Channels */}
      <Card>
        <Title level={4}>
          <BellOutlined className="mr-2" />
          Notification Channels
        </Title>
        
        <Space direction="vertical" className="w-full" size="large">
          {/* Push Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MobileOutlined className="text-blue-500 text-xl" />
              <div>
                <Title level={5} className="mb-0">Push Notifications</Title>
                <Text type="secondary">
                  {isPushSupported 
                    ? 'Receive instant notifications even when the app is closed'
                    : 'Push notifications are not supported in this browser'
                  }
                </Text>
              </div>
            </div>
            <Switch
              checked={isPushSubscribed}
              onChange={handlePushToggle}
              disabled={!isPushSupported}
            />
          </div>

          {!isPushSupported && (
            <Alert
              message="Push notifications not supported"
              description="Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, or Safari."
              type="warning"
              showIcon
            />
          )}

          <Divider />

          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MailOutlined className="text-green-500 text-xl" />
              <div>
                <Title level={5} className="mb-0">Email Notifications</Title>
                <Text type="secondary">Receive notifications via email</Text>
              </div>
            </div>
            <Switch
              checked={preferences.email_notifications}
              onChange={(checked) => handlePreferenceChange('email_notifications', checked)}
            />
          </div>

          <Divider />

          {/* SMS Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MessageOutlined className="text-orange-500 text-xl" />
              <div>
                <Title level={5} className="mb-0">SMS Notifications</Title>
                <Text type="secondary">Receive urgent notifications via SMS</Text>
              </div>
            </div>
            <Switch
              checked={preferences.sms_notifications}
              onChange={(checked) => handlePreferenceChange('sms_notifications', checked)}
            />
          </div>
        </Space>
      </Card>

      {/* Notification Types */}
      <Card>
        <Title level={4}>Notification Types</Title>
        
        <Space direction="vertical" className="w-full" size="large">
          {/* Task Assignments */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <UserOutlined className="text-blue-500 text-xl" />
              <div>
                <Title level={5} className="mb-0">Task Assignments</Title>
                <Text type="secondary">When you're assigned to a new task</Text>
              </div>
            </div>
            <Switch
              checked={preferences.task_assignments}
              onChange={(checked) => handlePreferenceChange('task_assignments', checked)}
            />
          </div>

          <Divider />

          {/* Due Date Reminders */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ClockCircleOutlined className="text-orange-500 text-xl" />
              <div>
                <Title level={5} className="mb-0">Due Date Reminders</Title>
                <Text type="secondary">Reminders for upcoming task deadlines</Text>
              </div>
            </div>
            <Switch
              checked={preferences.task_due_reminders}
              onChange={(checked) => handlePreferenceChange('task_due_reminders', checked)}
            />
          </div>

          <Divider />

          {/* Task Completions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircleOutlined className="text-green-500 text-xl" />
              <div>
                <Title level={5} className="mb-0">Task Completions</Title>
                <Text type="secondary">When tasks you're involved in are completed</Text>
              </div>
            </div>
            <Switch
              checked={preferences.task_completions}
              onChange={(checked) => handlePreferenceChange('task_completions', checked)}
            />
          </div>

          <Divider />

          {/* Team Updates */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <TeamOutlined className="text-purple-500 text-xl" />
              <div>
                <Title level={5} className="mb-0">Team Updates</Title>
                <Text type="secondary">Updates about your team and projects</Text>
              </div>
            </div>
            <Switch
              checked={preferences.team_updates}
              onChange={(checked) => handlePreferenceChange('team_updates', checked)}
            />
          </div>
        </Space>
      </Card>

      {/* Test Notifications */}
      <Card>
        <Title level={4}>Test Notifications</Title>
        <Text type="secondary" className="block mb-4">
          Test your notification settings to make sure they're working correctly.
        </Text>
        
        <Space>
          <Button 
            type="primary" 
            icon={<BellOutlined />}
            onClick={() => {
              if (Notification.permission === 'granted') {
                new Notification('Test Notification', {
                  body: 'This is a test notification from Flowchart Pilot',
                  icon: '/icon.jpg',
                });
              }
            }}
          >
            Test Browser Notification
          </Button>
          
          <Button 
            icon={<MobileOutlined />}
            disabled={!isPushSubscribed}
            onClick={async () => {
              // This would trigger a test push notification via your backend
              console.log('Test push notification requested');
            }}
          >
            Test Push Notification
          </Button>
        </Space>
      </Card>
    </div>
  );
};
