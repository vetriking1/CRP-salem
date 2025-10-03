import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailNotificationParams {
  to: string;
  subject: string;
  html: string;
  templateId?: string;
  templateData?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const params: EmailNotificationParams = await req.json()

    // Get email service configuration from environment
    const emailService = Deno.env.get('EMAIL_SERVICE') || 'resend' // Default to Resend
    
    let result;
    
    switch (emailService) {
      case 'resend':
        result = await sendWithResend(params)
        break
      case 'sendgrid':
        result = await sendWithSendGrid(params)
        break
      case 'smtp':
        result = await sendWithSMTP(params)
        break
      default:
        throw new Error(`Unsupported email service: ${emailService}`)
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in send-email-notification function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// Send email using Resend
async function sendWithResend(params: EmailNotificationParams) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    throw new Error('Resend API key not configured')
  }

  const fromEmail = Deno.env.get('FROM_EMAIL') || 'notifications@flowchartpilot.com'
  
  const emailData = {
    from: fromEmail,
    to: params.to,
    subject: params.subject,
    html: params.html,
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailData),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${error}`)
  }

  return await response.json()
}

// Send email using SendGrid
async function sendWithSendGrid(params: EmailNotificationParams) {
  const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY')
  if (!sendGridApiKey) {
    throw new Error('SendGrid API key not configured')
  }

  const fromEmail = Deno.env.get('FROM_EMAIL') || 'notifications@flowchartpilot.com'
  
  const emailData = {
    personalizations: [{
      to: [{ email: params.to }],
      subject: params.subject,
    }],
    from: { email: fromEmail },
    content: [{
      type: 'text/html',
      value: params.html,
    }],
  }

  // If using template
  if (params.templateId) {
    emailData.template_id = params.templateId
    if (params.templateData) {
      emailData.personalizations[0].dynamic_template_data = params.templateData
    }
    delete emailData.content
    delete emailData.personalizations[0].subject
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sendGridApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailData),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`SendGrid API error: ${error}`)
  }

  return { messageId: response.headers.get('x-message-id') }
}

// Send email using SMTP
async function sendWithSMTP(params: EmailNotificationParams) {
  // This would require an SMTP library for Deno
  // For now, we'll throw an error indicating it's not implemented
  throw new Error('SMTP email sending not implemented yet. Please use Resend or SendGrid.')
}

// Generate HTML template for notifications
function generateNotificationHTML(title: string, message: string, actionUrl?: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1890ff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #1890ff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Flowchart Pilot</h1>
        </div>
        <div class="content">
          <h2>${title}</h2>
          <p>${message}</p>
          ${actionUrl ? `<a href="${actionUrl}" class="button">View Details</a>` : ''}
        </div>
        <div class="footer">
          <p>This is an automated notification from Flowchart Pilot.</p>
          <p>If you no longer wish to receive these emails, you can update your notification preferences in the app.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
