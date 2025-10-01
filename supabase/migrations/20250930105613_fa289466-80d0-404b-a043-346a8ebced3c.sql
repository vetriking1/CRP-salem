-- Enable realtime for notifications table
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- The notifications table will now broadcast changes to subscribed clients