import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SMSNotificationParams {
  to: string;
  message: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const params: SMSNotificationParams = await req.json()

    // Get SMS service configuration from environment
    const smsService = Deno.env.get('SMS_SERVICE') || 'twilio' // Default to Twilio
    
    let result;
    
    switch (smsService) {
      case 'twilio':
        result = await sendWithTwilio(params)
        break
      case 'aws-sns':
        result = await sendWithAWSSNS(params)
        break
      default:
        throw new Error(`Unsupported SMS service: ${smsService}`)
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in send-sms-notification function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// Send SMS using Twilio
async function sendWithTwilio(params: SMSNotificationParams) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials not configured')
  }

  // Validate phone number format
  const phoneRegex = /^\+[1-9]\d{1,14}$/
  if (!phoneRegex.test(params.to)) {
    throw new Error('Invalid phone number format. Use E.164 format (e.g., +1234567890)')
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  
  const formData = new URLSearchParams()
  formData.append('To', params.to)
  formData.append('From', fromNumber)
  formData.append('Body', params.message)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Twilio API error: ${error}`)
  }

  return await response.json()
}

// Send SMS using AWS SNS
async function sendWithAWSSNS(params: SMSNotificationParams) {
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')
  const region = Deno.env.get('AWS_REGION') || 'us-east-1'

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured')
  }

  // This is a simplified AWS SNS implementation
  // In production, you'd use the AWS SDK for proper signing and authentication
  
  const snsEndpoint = `https://sns.${region}.amazonaws.com/`
  
  const params_aws = {
    Action: 'Publish',
    Message: params.message,
    PhoneNumber: params.to,
    Version: '2010-03-31',
  }

  // Create query string
  const queryString = Object.entries(params_aws)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')

  // Note: This is a simplified version. In production, you need proper AWS signature v4
  const response = await fetch(snsEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/...`, // Simplified
    },
    body: queryString,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AWS SNS error: ${error}`)
  }

  const result = await response.text()
  return { result }
}

// Helper function to format SMS message for different notification types
function formatSMSMessage(type: string, title: string, message: string): string {
  const maxLength = 160 // Standard SMS length
  
  let formattedMessage = `${title}: ${message}`
  
  // Truncate if too long
  if (formattedMessage.length > maxLength) {
    formattedMessage = formattedMessage.substring(0, maxLength - 3) + '...'
  }
  
  return formattedMessage
}
