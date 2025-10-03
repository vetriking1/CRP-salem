import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BatchNotificationParams {
  userId: string;
  taskId?: string;
  type: string;
  title: string;
  message?: string;
  channels?: Array<'database' | 'push' | 'email' | 'sms'>;
  userEmail?: string;
  userPhone?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { notifications }: { notifications: BatchNotificationParams[] } = await req.json()

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const results = []

    // Process notifications in batches to avoid overwhelming external services
    const batchSize = 10
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize)
      
      const batchResults = await Promise.allSettled(
        batch.map(async (notification) => {
          try {
            const channels = notification.channels || ['database']
            const result: any = { userId: notification.userId, channels: [] }

            // Create database notification
            if (channels.includes('database')) {
              const { data: dbResult, error: dbError } = await supabaseClient.rpc('create_notification', {
                p_user_id: notification.userId,
                p_task_id: notification.taskId || null,
                p_type: notification.type,
                p_title: notification.title,
                p_message: notification.message || null,
              })

              if (dbError) {
                throw dbError
              }

              result.channels.push({ type: 'database', success: true, id: dbResult })
            }

            // Send push notification
            if (channels.includes('push')) {
              try {
                const pushResponse = await supabaseClient.functions.invoke('send-push-notification', {
                  body: {
                    userId: notification.userId,
                    payload: {
                      title: notification.title,
                      body: notification.message || '',
                      data: {
                        taskId: notification.taskId,
                        type: notification.type,
                      },
                    },
                  },
                })

                result.channels.push({ 
                  type: 'push', 
                  success: !pushResponse.error,
                  error: pushResponse.error?.message 
                })
              } catch (error) {
                result.channels.push({ 
                  type: 'push', 
                  success: false, 
                  error: error.message 
                })
              }
            }

            // Send email notification
            if (channels.includes('email') && notification.userEmail) {
              try {
                const emailResponse = await supabaseClient.functions.invoke('send-email-notification', {
                  body: {
                    to: notification.userEmail,
                    subject: notification.title,
                    html: generateEmailHTML(notification.title, notification.message || '', notification.taskId),
                  },
                })

                result.channels.push({ 
                  type: 'email', 
                  success: !emailResponse.error,
                  error: emailResponse.error?.message 
                })
              } catch (error) {
                result.channels.push({ 
                  type: 'email', 
                  success: false, 
                  error: error.message 
                })
              }
            }

            // Send SMS notification
            if (channels.includes('sms') && notification.userPhone) {
              try {
                const smsMessage = `${notification.title}: ${notification.message || ''}`
                const smsResponse = await supabaseClient.functions.invoke('send-sms-notification', {
                  body: {
                    to: notification.userPhone,
                    message: smsMessage.length > 160 ? smsMessage.substring(0, 157) + '...' : smsMessage,
                  },
                })

                result.channels.push({ 
                  type: 'sms', 
                  success: !smsResponse.error,
                  error: smsResponse.error?.message 
                })
              } catch (error) {
                result.channels.push({ 
                  type: 'sms', 
                  success: false, 
                  error: error.message 
                })
              }
            }

            return result
          } catch (error) {
            return {
              userId: notification.userId,
              success: false,
              error: error.message,
            }
          }
        })
      )

      results.push(...batchResults)

      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    const successCount = results.filter(r => 
      r.status === 'fulfilled' && 
      r.value.channels && 
      r.value.channels.some((c: any) => c.success)
    ).length

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        successful: successCount,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'Promise rejected' })
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in batch-send-notifications function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// Generate HTML email template
function generateEmailHTML(title: string, message: string, taskId?: string): string {
  const actionUrl = taskId ? `${Deno.env.get('APP_URL') || 'https://app.flowchartpilot.com'}/tasks/${taskId}` : undefined

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0; 
          background-color: #f5f5f5; 
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: white; 
          border-radius: 8px; 
          overflow: hidden; 
          box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .header { 
          background: linear-gradient(135deg, #1890ff, #096dd9); 
          color: white; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 24px; 
          font-weight: 600; 
        }
        .content { 
          padding: 30px 20px; 
        }
        .content h2 { 
          color: #1890ff; 
          margin-top: 0; 
          font-size: 20px; 
        }
        .message { 
          background: #f9f9f9; 
          padding: 20px; 
          border-radius: 6px; 
          margin: 20px 0; 
          border-left: 4px solid #1890ff; 
        }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background: #1890ff; 
          color: white; 
          text-decoration: none; 
          border-radius: 6px; 
          margin: 20px 0; 
          font-weight: 500; 
          transition: background-color 0.3s; 
        }
        .button:hover { 
          background: #096dd9; 
        }
        .footer { 
          padding: 20px; 
          text-align: center; 
          color: #666; 
          font-size: 14px; 
          background: #fafafa; 
          border-top: 1px solid #e8e8e8; 
        }
        .footer a { 
          color: #1890ff; 
          text-decoration: none; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 Flowchart Pilot</h1>
        </div>
        <div class="content">
          <h2>${title}</h2>
          <div class="message">
            <p>${message}</p>
          </div>
          ${actionUrl ? `<a href="${actionUrl}" class="button">View Task Details</a>` : ''}
        </div>
        <div class="footer">
          <p>This is an automated notification from Flowchart Pilot.</p>
          <p>
            <a href="${Deno.env.get('APP_URL') || 'https://app.flowchartpilot.com'}/settings/notifications">
              Update notification preferences
            </a> | 
            <a href="${Deno.env.get('APP_URL') || 'https://app.flowchartpilot.com'}">
              Open App
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}
