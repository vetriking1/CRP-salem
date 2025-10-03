import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, payload }: { userId: string; payload: PushNotificationPayload } = await req.json()

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user's push subscriptions
    const { data: subscriptions, error: subscriptionError } = await supabaseClient
      .from('push_subscriptions')
      .select('subscription, endpoint')
      .eq('user_id', userId)
      .eq('active', true)

    if (subscriptionError) {
      throw subscriptionError
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No active push subscriptions found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      )
    }

    // VAPID keys from environment
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@flowchartpilot.com'

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured')
    }

    // Send push notification to each subscription
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const subscription = sub.subscription as any
          
          // Create the notification payload
          const notificationPayload = JSON.stringify(payload)

          // Generate VAPID headers
          const vapidHeaders = await generateVapidHeaders(
            subscription.endpoint,
            vapidSubject,
            vapidPublicKey,
            vapidPrivateKey
          )

          // Send push notification
          const response = await fetch(subscription.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Encoding': 'aes128gcm',
              'TTL': '86400', // 24 hours
              ...vapidHeaders,
            },
            body: await encryptPayload(notificationPayload, subscription),
          })

          if (!response.ok) {
            throw new Error(`Push service responded with ${response.status}: ${response.statusText}`)
          }

          return { success: true, endpoint: subscription.endpoint }
        } catch (error) {
          console.error('Error sending push notification:', error)
          
          // If subscription is invalid, mark it as inactive
          if (error.message.includes('410') || error.message.includes('invalid')) {
            await supabaseClient
              .from('push_subscriptions')
              .update({ active: false })
              .eq('endpoint', sub.endpoint)
          }
          
          return { success: false, endpoint: sub.endpoint, error: error.message }
        }
      })
    )

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const totalCount = results.length

    return new Response(
      JSON.stringify({ 
        success: successCount > 0, 
        sent: successCount, 
        total: totalCount,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' })
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in send-push-notification function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// Helper function to generate VAPID headers
async function generateVapidHeaders(
  endpoint: string,
  subject: string,
  publicKey: string,
  privateKey: string
): Promise<Record<string, string>> {
  // This is a simplified version. In production, you'd use a proper VAPID library
  // For now, we'll use basic authorization
  return {
    'Authorization': `vapid t=${await generateJWT(subject, publicKey, privateKey)}, k=${publicKey}`,
  }
}

// Helper function to generate JWT for VAPID
async function generateJWT(subject: string, publicKey: string, privateKey: string): Promise<string> {
  // This is a simplified JWT generation. In production, use a proper JWT library
  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const payload = btoa(JSON.stringify({
    aud: 'https://fcm.googleapis.com',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    sub: subject,
  }))
  
  // In a real implementation, you'd sign this with the private key
  // For now, return a basic token
  return `${header}.${payload}.signature`
}

// Helper function to encrypt payload (simplified)
async function encryptPayload(payload: string, subscription: any): Promise<Uint8Array> {
  // This is a simplified encryption. In production, use proper Web Push encryption
  // For now, return the payload as bytes
  return new TextEncoder().encode(payload)
}
