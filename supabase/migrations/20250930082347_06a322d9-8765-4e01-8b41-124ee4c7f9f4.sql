-- Create function to generate auth users
-- Note: This is for development only. In production, users should sign up through the app

-- First, we need to insert users with specific UUIDs that match the auth users
-- We'll update the existing dummy users with the correct user IDs that we'll create via the auth system

-- Update user IDs to match what we'll create
UPDATE users SET id = 'a1111111-1111-1111-1111-111111111111', email = 'admin@company.com' WHERE email = 'admin@company.com';
UPDATE users SET id = 'b2222222-2222-2222-2222-222222222222', email = 'collector@company.com' WHERE email = 'mike.datacollector@company.com';
UPDATE users SET id = 'c3333333-3333-3333-3333-333333333333', email = 'employee@company.com' WHERE email = 'david.employee@company.com';
UPDATE users SET id = 'd4444444-4444-4444-4444-444444444444', email = 'manager@company.com' WHERE email = 'sarah.manager@company.com';
UPDATE users SET id = 'e5555555-5555-5555-5555-555555555555', email = 'senior@company.com' WHERE email = 'lisa.senior@company.com';

-- Create a function to setup demo users (to be called manually or via edge function)
CREATE OR REPLACE FUNCTION setup_demo_auth_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Note: Actual user creation should be done via Supabase Dashboard or API
  -- This function is just a placeholder for documentation
  RAISE NOTICE 'Demo users should be created via Supabase Dashboard with these credentials:';
  RAISE NOTICE 'admin@company.com / admin123';
  RAISE NOTICE 'collector@company.com / collector123';
  RAISE NOTICE 'employee@company.com / employee123';
  RAISE NOTICE 'manager@company.com / manager123';
  RAISE NOTICE 'senior@company.com / senior123';
END;
$$;