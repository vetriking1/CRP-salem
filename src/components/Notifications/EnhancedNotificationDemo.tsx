import React, { useState } from 'react';
import { Card, Button, Space, Typography, Alert, Switch, Divider } from 'antd';
import { 
  BellOutlined, 
  MailOutlined, 
  MobileOutlined, 
  MessageOutlined,
  SendOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useEnhancedNotifications } from '@/hooks/useEnhancedNotifications';
import { SupabaseNotificationService } from '@/services/supabaseNotificationService';
import { useAuth } from '@/hooks/useAuth';

const { Title, Text } = Typography;

export const EnhancedNotificationDemo: React.FC = () => {
  const { userProfile } = useAuth();
  const {
    preferences,
    updatePreferences,
    isPushSupported,
    isPushSubscribed,
    subscribeToPush,
    unsubscribeFromPush,
    isOnline,
  } = useEnhancedNotifications();

  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testBrowserNotification = () => {
    if (Notification.permission === 'granted') {
      new Notification('Test Browser Notification', {
        body: 'This is a test browser notification from Flowchart Pilot',
        icon: '/icon.jpg',
        tag: 'test-notification',
      });
      addTestResult('✅ Browser notification sent');
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          testBrowserNotification();
        } else {
          addTestResult('❌ Browser notification permission denied');
        }
      });
    } else {
      addTestResult('❌ Browser notifications are blocked');
    }
  };

  const testPushNotification = async () => {
    if (!userProfile?.id) {
      addTestResult('❌ User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const success = await SupabaseNotificationService.sendPushNotification(
        userProfile.id,
        {
          title: 'Test Push Notification',
          body: 'This is a test push notification from Flowchart Pilot',
          icon: '/icon.jpg',
          data: { test: true },
          actions: [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        }
      );

      if (success) {
        addTestResult('✅ Push notification sent successfully');
      } else {
        addTestResult('❌ Push notification failed to send');
      }
    } catch (error) {
      addTestResult(`❌ Push notification error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testEmailNotification = async () => {
    if (!userProfile?.email) {
      addTestResult('❌ User email not available');
      return;
    }

    setLoading(true);
    try {
      const success = await SupabaseNotificationService.sendEmailNotification({
        to: userProfile.email,
        subject: 'Test Email Notification - Flowchart Pilot',
        html: `
          <h2>Test Email Notification</h2>
          <p>Hello ${userProfile.full_name || 'User'},</p>
          <p>This is a test email notification from Flowchart Pilot.</p>
          <p>If you received this email, your email notifications are working correctly!</p>
          <p>Best regards,<br>Flowchart Pilot Team</p>
        `,
      });

      if (success) {
        addTestResult('✅ Email notification sent successfully');
      } else {
        addTestResult('❌ Email notification failed to send');
      }
    } catch (error) {
      addTestResult(`❌ Email notification error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testEnhancedNotification = async () => {
    if (!userProfile?.id) {
      addTestResult('❌ User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const notificationId = await SupabaseNotificationService.createEnhancedNotification({
        userId: userProfile.id,
        type: 'task_created',
        title: 'Test Enhanced Notification',
        message: 'This is a test of the enhanced notification system with multiple channels',
        channels: ['database', 'push', 'email'],
        pushPayload: {
          title: 'Enhanced Test Notification',
          body: 'Testing multi-channel notifications',
          icon: '/icon.jpg',
          data: { test: true, type: 'enhanced' },
        },
        emailParams: {
          subject: 'Enhanced Notification Test - Flowchart Pilot',
          html: '<p>This is a test of the enhanced notification system.</p>',
        },
        userEmail: userProfile.email,
      });

      if (notificationId) {
        addTestResult('✅ Enhanced notification created successfully');
      } else {
        addTestResult('❌ Enhanced notification failed to create');
      }
    } catch (error) {
      addTestResult(`❌ Enhanced notification error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePushToggle = async () => {
    setLoading(true);
    try {
      if (isPushSubscribed) {
        await unsubscribeFromPush();
        addTestResult('🔕 Unsubscribed from push notifications');
      } else {
        const success = await subscribeToPush();
        if (success) {
          addTestResult('🔔 Subscribed to push notifications');
        } else {
          addTestResult('❌ Failed to subscribe to push notifications');
        }
      }
    } catch (error) {
      addTestResult(`❌ Push subscription error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <Title level={3}>
          <BellOutlined className="mr-2" />
          Enhanced Notification System Demo
        </Title>
        
        <Alert
          message="Notification System Status"
          description={
            <div>
              <p><strong>Connection:</strong> {isOnline ? '🟢 Online' : '🔴 Offline'}</p>
              <p><strong>Push Support:</strong> {isPushSupported ? '✅ Supported' : '❌ Not Supported'}</p>
              <p><strong>Push Subscription:</strong> {isPushSubscribed ? '✅ Subscribed' : '❌ Not Subscribed'}</p>
              <p><strong>Browser Notifications:</strong> {Notification.permission === 'granted' ? '✅ Allowed' : '❌ Not Allowed'}</p>
            </div>
          }
          type="info"
          className="mb-4"
        />

        <Divider>Quick Setup</Divider>
        
        <Space direction="vertical" className="w-full" size="middle">
          <div className="flex items-center justify-between">
            <div>
              <Text strong>Push Notifications</Text>
              <br />
              <Text type="secondary">Enable push notifications for real-time alerts</Text>
            </div>
            <Switch
              checked={isPushSubscribed}
              onChange={handlePushToggle}
              disabled={!isPushSupported || loading}
              loading={loading}
            />
          </div>

          {preferences && (
            <div className="flex items-center justify-between">
              <div>
                <Text strong>Email Notifications</Text>
                <br />
                <Text type="secondary">Receive notifications via email</Text>
              </div>
              <Switch
                checked={preferences.email_notifications}
                onChange={(checked) => updatePreferences({ email_notifications: checked })}
              />
            </div>
          )}
        </Space>

        <Divider>Test Notifications</Divider>

        <Space wrap>
          <Button
            icon={<BellOutlined />}
            onClick={testBrowserNotification}
            disabled={loading}
          >
            Test Browser Notification
          </Button>

          <Button
            icon={<MobileOutlined />}
            onClick={testPushNotification}
            disabled={!isPushSubscribed || loading}
            loading={loading}
          >
            Test Push Notification
          </Button>

          <Button
            icon={<MailOutlined />}
            onClick={testEmailNotification}
            disabled={loading}
            loading={loading}
          >
            Test Email Notification
          </Button>

          <Button
            icon={<SendOutlined />}
            onClick={testEnhancedNotification}
            disabled={loading}
            loading={loading}
            type="primary"
          >
            Test Enhanced Notification
          </Button>
        </Space>

        {testResults.length > 0 && (
          <>
            <Divider>Test Results</Divider>
            <Card size="small" className="bg-gray-50">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {testResults.map((result, index) => (
                  <div key={index} className="text-sm font-mono">
                    {result}
                  </div>
                ))}
              </div>
              <Button 
                size="small" 
                onClick={() => setTestResults([])}
                className="mt-2"
              >
                Clear Results
              </Button>
            </Card>
          </>
        )}
      </Card>

      <Card>
        <Title level={4}>Integration Examples</Title>
        <div className="space-y-4">
          <div>
            <Text strong>Task Assignment with Enhanced Notifications:</Text>
            <pre className="bg-gray-100 p-3 rounded mt-2 text-sm overflow-x-auto">
{`await SupabaseNotificationService.createEnhancedNotification({
  userId: assigneeId,
  taskId: task.id,
  type: 'task_assigned',
  title: 'Task Assigned to You',
  message: \`You've been assigned to: \${task.title}\`,
  channels: ['database', 'push', 'email'],
  pushPayload: {
    title: 'New Task Assignment',
    body: \`Task: \${task.title}\`,
    data: { taskId: task.id }
  },
  emailParams: {
    subject: 'New Task Assignment',
    html: \`<p>Task: <strong>\${task.title}</strong></p>\`
  },
  userEmail: user.email
});`}
            </pre>
          </div>

          <div>
            <Text strong>Using the Enhanced Hook:</Text>
            <pre className="bg-gray-100 p-3 rounded mt-2 text-sm overflow-x-auto">
{`const {
  notifications,
  preferences,
  updatePreferences,
  subscribeToPush,
  isOnline
} = useEnhancedNotifications();`}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
};
