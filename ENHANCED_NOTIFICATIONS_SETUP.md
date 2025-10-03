# Enhanced Notifications Setup Guide

This guide will help you set up the enhanced notification system with Supabase real-time notifications, push notifications, email, and SMS support.

## Overview

The enhanced notification system provides:
- ✅ **Real-time notifications** via Supabase channels (already working)
- ✅ **Database-stored notifications** (already working)
- ✅ **Browser notifications** (already working)
- 🆕 **Push notifications** via service worker
- 🆕 **Email notifications** via Resend/SendGrid
- 🆕 **SMS notifications** via Twilio/AWS SNS
- 🆕 **User presence tracking**
- 🆕 **Notification preferences**

## Database Setup

1. **Run the migration**:
   ```bash
   supabase db push
   ```

2. **Verify tables were created**:
   - `push_subscriptions`
   - `user_notification_preferences`
   - `user_presence`
   - `notification_delivery_log`

## Environment Variables

Add these environment variables to your `.env` file:

### Frontend (.env)
```env
# VAPID Keys for Push Notifications
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key_here

# App URL for email links
VITE_APP_URL=http://localhost:5173
```

### Supabase Edge Functions
Set these in your Supabase dashboard under Settings > Edge Functions:

```env
# VAPID Keys (generate at https://vapidkeys.com/)
VAPID_PUBLIC_KEY=your_vapid_public_key_here
VAPID_PRIVATE_KEY=your_vapid_private_key_here
VAPID_SUBJECT=mailto:admin@yourdomain.com

# Email Service (choose one)
EMAIL_SERVICE=resend  # or 'sendgrid' or 'smtp'
FROM_EMAIL=notifications@yourdomain.com

# Resend (recommended)
RESEND_API_KEY=your_resend_api_key_here

# SendGrid (alternative)
SENDGRID_API_KEY=your_sendgrid_api_key_here

# SMS Service (choose one)
SMS_SERVICE=twilio  # or 'aws-sns'

# Twilio (recommended)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+1234567890

# AWS SNS (alternative)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1

# App URL for email links
APP_URL=https://yourdomain.com
```

## Service Setup

### 1. Push Notifications

#### Generate VAPID Keys
Visit https://vapidkeys.com/ to generate your VAPID key pair.

#### Service Worker
The service worker (`public/sw.js`) is already created and handles:
- Push notification display
- Notification click handling
- Background sync
- Basic caching

### 2. Email Notifications

#### Option A: Resend (Recommended)
1. Sign up at https://resend.com/
2. Get your API key
3. Verify your domain
4. Set `EMAIL_SERVICE=resend` and `RESEND_API_KEY`

#### Option B: SendGrid
1. Sign up at https://sendgrid.com/
2. Get your API key
3. Verify your sender identity
4. Set `EMAIL_SERVICE=sendgrid` and `SENDGRID_API_KEY`

### 3. SMS Notifications

#### Option A: Twilio (Recommended)
1. Sign up at https://twilio.com/
2. Get your Account SID and Auth Token
3. Purchase a phone number
4. Set `SMS_SERVICE=twilio` and Twilio credentials

#### Option B: AWS SNS
1. Set up AWS account with SNS access
2. Create IAM user with SNS permissions
3. Set `SMS_SERVICE=aws-sns` and AWS credentials

## Deployment

### 1. Deploy Edge Functions
```bash
supabase functions deploy send-push-notification
supabase functions deploy send-email-notification
supabase functions deploy send-sms-notification
supabase functions deploy batch-send-notifications
```

### 2. Set Environment Variables
In Supabase Dashboard > Settings > Edge Functions, add all the environment variables listed above.

### 3. Test Functions
```bash
# Test push notification
supabase functions invoke send-push-notification --data '{"userId":"user-id","payload":{"title":"Test","body":"Hello"}}'

# Test email
supabase functions invoke send-email-notification --data '{"to":"test@example.com","subject":"Test","html":"<p>Hello</p>"}'

# Test SMS
supabase functions invoke send-sms-notification --data '{"to":"+1234567890","message":"Test message"}'
```

## Usage Examples

### 1. Basic Usage (Existing)
```typescript
import { NotificationService } from '@/services/notificationService';

// Create database notification (existing functionality)
await NotificationService.createNotification({
  userId: 'user-id',
  taskId: 'task-id',
  type: 'task_assigned',
  title: 'Task Assigned',
  message: 'You have been assigned to a new task',
});
```

### 2. Enhanced Multi-Channel Notifications
```typescript
import { SupabaseNotificationService } from '@/services/supabaseNotificationService';

// Send notification via multiple channels
await SupabaseNotificationService.createEnhancedNotification({
  userId: 'user-id',
  taskId: 'task-id',
  type: 'task_assigned',
  title: 'Task Assigned',
  message: 'You have been assigned to a new task',
  channels: ['database', 'push', 'email'],
  pushPayload: {
    title: 'New Task Assignment',
    body: 'You have been assigned to: Task Title',
    icon: '/icon.jpg',
    data: { taskId: 'task-id' },
  },
  emailParams: {
    subject: 'New Task Assignment',
    html: '<p>You have been assigned to a new task</p>',
  },
  userEmail: 'user@example.com',
});
```

### 3. Using Enhanced Hook
```typescript
import { useEnhancedNotifications } from '@/hooks/useEnhancedNotifications';

function MyComponent() {
  const {
    notifications,
    preferences,
    updatePreferences,
    subscribeToPush,
    isPushSupported,
    isPushSubscribed,
    isOnline,
    userPresence,
  } = useEnhancedNotifications();

  // Enable push notifications
  const handleEnablePush = async () => {
    if (isPushSupported && !isPushSubscribed) {
      await subscribeToPush();
    }
  };

  // Update preferences
  const handleToggleEmail = async () => {
    await updatePreferences({
      email_notifications: !preferences?.email_notifications
    });
  };

  return (
    <div>
      <p>Online: {isOnline ? 'Yes' : 'No'}</p>
      <p>Active Users: {userPresence.length}</p>
      <button onClick={handleEnablePush}>
        Enable Push Notifications
      </button>
    </div>
  );
}
```

### 4. Notification Settings Component
```typescript
import { NotificationSettings } from '@/components/Notifications/NotificationSettings';

function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <NotificationSettings />
    </div>
  );
}
```

## Testing

### 1. Test Browser Notifications
```javascript
// In browser console
if (Notification.permission === 'granted') {
  new Notification('Test', { body: 'This is a test' });
}
```

### 2. Test Push Notifications
1. Enable push notifications in your app
2. Use the test button in notification settings
3. Check browser developer tools for service worker logs

### 3. Test Real-time Features
1. Open app in multiple tabs/browsers
2. Create notifications in one tab
3. Verify they appear in real-time in other tabs

## Troubleshooting

### Push Notifications Not Working
1. Check VAPID keys are correctly set
2. Verify service worker is registered
3. Check browser console for errors
4. Ensure HTTPS (required for push notifications)

### Email Not Sending
1. Verify API keys
2. Check sender domain verification
3. Look at Edge Function logs in Supabase

### SMS Not Sending
1. Verify phone number format (+1234567890)
2. Check Twilio/AWS credentials
3. Ensure sufficient account balance

### Real-time Not Working
1. Check Supabase connection
2. Verify RLS policies
3. Check browser network tab for WebSocket connections

## Security Notes

1. **VAPID Keys**: Keep private key secure, only public key in frontend
2. **API Keys**: Never expose in frontend code
3. **Phone Numbers**: Validate format and user consent
4. **Email Addresses**: Verify ownership before sending
5. **Rate Limiting**: Implement to prevent spam

## Performance Considerations

1. **Batch Notifications**: Use batch function for multiple recipients
2. **Caching**: Service worker caches static assets
3. **Offline Support**: Notifications queue when offline
4. **Database Cleanup**: Regularly clean old notifications and presence data

## Migration from Existing System

Your existing notification system will continue to work. To migrate:

1. **Gradual Migration**: Start with new features using enhanced service
2. **Backward Compatibility**: Old `NotificationService` methods still work
3. **User Preferences**: Users can opt-in to new notification channels
4. **Testing**: Test thoroughly before full rollout

## Support

For issues:
1. Check Supabase Edge Function logs
2. Review browser console errors
3. Verify environment variables
4. Test with simple examples first
