-- Enhanced Notifications Schema
-- This migration adds support for push notifications, user preferences, and presence tracking

-- Create push_subscriptions table for storing push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_notification_preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,
    task_assignments BOOLEAN DEFAULT true,
    task_due_reminders BOOLEAN DEFAULT true,
    task_completions BOOLEAN DEFAULT true,
    team_updates BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_presence table for tracking online status
CREATE TABLE IF NOT EXISTS user_presence (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away', 'busy')),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create notification_delivery_log table for tracking notification delivery
CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('database', 'push', 'email', 'sms')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    external_id TEXT, -- ID from external service (e.g., Twilio message SID)
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_channel ON notification_delivery_log(channel);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_status ON notification_delivery_log(status);

-- Add updated_at trigger for push_subscriptions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_push_subscriptions_updated_at 
    BEFORE UPDATE ON push_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notification_preferences_updated_at 
    BEFORE UPDATE ON user_notification_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_presence_updated_at 
    BEFORE UPDATE ON user_presence 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_delivery_log_updated_at 
    BEFORE UPDATE ON notification_delivery_log 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enhanced notification function that respects user preferences
CREATE OR REPLACE FUNCTION create_enhanced_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_task_id UUID DEFAULT NULL,
    p_message TEXT DEFAULT NULL,
    p_channels TEXT[] DEFAULT ARRAY['database']
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    notification_id UUID;
    user_prefs RECORD;
    should_send BOOLEAN := false;
BEGIN
    -- Get user notification preferences
    SELECT * INTO user_prefs 
    FROM user_notification_preferences 
    WHERE user_id = p_user_id;
    
    -- If no preferences exist, create default ones
    IF user_prefs IS NULL THEN
        INSERT INTO user_notification_preferences (user_id)
        VALUES (p_user_id)
        RETURNING * INTO user_prefs;
    END IF;
    
    -- Check if user wants this type of notification
    CASE p_type
        WHEN 'task_assigned' THEN
            should_send := user_prefs.task_assignments;
        WHEN 'task_due_soon', 'task_overdue' THEN
            should_send := user_prefs.task_due_reminders;
        WHEN 'task_completed' THEN
            should_send := user_prefs.task_completions;
        WHEN 'task_created', 'task_status_changed' THEN
            should_send := user_prefs.team_updates;
        ELSE
            should_send := true; -- Default to sending for unknown types
    END CASE;
    
    -- Only create notification if user wants it
    IF should_send THEN
        -- Create the notification
        INSERT INTO notifications (user_id, task_id, type, title, message)
        VALUES (p_user_id, p_task_id, p_type, p_title, p_message)
        RETURNING id INTO notification_id;
        
        -- Log delivery attempts for each requested channel
        INSERT INTO notification_delivery_log (notification_id, channel, status)
        SELECT notification_id, unnest(p_channels), 'pending';
        
        RETURN notification_id;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Function to update user presence
CREATE OR REPLACE FUNCTION update_user_presence(
    p_user_id UUID,
    p_status TEXT DEFAULT 'online',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_presence (user_id, status, metadata, last_seen)
    VALUES (p_user_id, p_status, p_metadata, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata,
        last_seen = EXCLUDED.last_seen,
        updated_at = NOW();
END;
$$;

-- Function to get active users (online in last 5 minutes)
CREATE OR REPLACE FUNCTION get_active_users()
RETURNS TABLE (
    user_id UUID,
    status TEXT,
    last_seen TIMESTAMP WITH TIME ZONE,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.user_id,
        up.status,
        up.last_seen,
        up.metadata
    FROM user_presence up
    WHERE up.last_seen > NOW() - INTERVAL '5 minutes'
    ORDER BY up.last_seen DESC;
END;
$$;

-- Function to clean up old presence records
CREATE OR REPLACE FUNCTION cleanup_old_presence()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mark users as offline if they haven't been seen in 10 minutes
    UPDATE user_presence 
    SET status = 'offline', updated_at = NOW()
    WHERE last_seen < NOW() - INTERVAL '10 minutes' 
    AND status != 'offline';
    
    -- Delete very old presence records (older than 30 days)
    DELETE FROM user_presence 
    WHERE updated_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Function to get notification statistics
CREATE OR REPLACE FUNCTION get_notification_stats(p_user_id UUID)
RETURNS TABLE (
    total_notifications BIGINT,
    unread_notifications BIGINT,
    notifications_today BIGINT,
    notifications_this_week BIGINT,
    delivery_success_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM notifications WHERE user_id = p_user_id),
        (SELECT COUNT(*) FROM notifications WHERE user_id = p_user_id AND is_read = false),
        (SELECT COUNT(*) FROM notifications WHERE user_id = p_user_id AND created_at >= CURRENT_DATE),
        (SELECT COUNT(*) FROM notifications WHERE user_id = p_user_id AND created_at >= CURRENT_DATE - INTERVAL '7 days'),
        (
            SELECT CASE 
                WHEN COUNT(*) = 0 THEN 0
                ELSE ROUND(
                    (COUNT(*) FILTER (WHERE ndl.status IN ('sent', 'delivered')) * 100.0) / COUNT(*), 
                    2
                )
            END
            FROM notifications n
            LEFT JOIN notification_delivery_log ndl ON n.id = ndl.notification_id
            WHERE n.user_id = p_user_id
        );
END;
$$;

-- Enable Row Level Security (RLS)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_subscriptions
CREATE POLICY "Users can manage their own push subscriptions" ON push_subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for user_notification_preferences
CREATE POLICY "Users can manage their own notification preferences" ON user_notification_preferences
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for user_presence
CREATE POLICY "Users can view all presence data" ON user_presence
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own presence" ON user_presence
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence" ON user_presence
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for notification_delivery_log
CREATE POLICY "Users can view their own notification delivery logs" ON notification_delivery_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.id = notification_delivery_log.notification_id 
            AND n.user_id = auth.uid()
        )
    );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON push_subscriptions TO authenticated;
GRANT ALL ON user_notification_preferences TO authenticated;
GRANT ALL ON user_presence TO authenticated;
GRANT SELECT ON notification_delivery_log TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_enhanced_notification TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_presence TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_stats TO authenticated;
