import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message, userName, userEmail, image } = req.body

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' })
  }

  const attachments = []
  if (image) {
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/)
    if (match) {
      const ext = match[1].split('/')[1]
      attachments.push({
        filename: `feedback-screenshot.${ext}`,
        content: match[2],
      })
    }
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #FFF8E7; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
        <h2 style="color: #3D2E1E; margin: 0 0 4px;">New Feedback from GroceryApp</h2>
        <p style="color: #8A7A6A; margin: 0; font-size: 14px;">From ${userName || 'Unknown'} (${userEmail || 'no email'})</p>
      </div>
      <div style="background: #FFFFFF; border: 1px solid #D4C48A; border-radius: 12px; padding: 20px;">
        <p style="color: #3D2E1E; white-space: pre-wrap; line-height: 1.6; margin: 0;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </div>
      ${image ? '<p style="color: #8A7A6A; font-size: 13px; margin-top: 12px;">📎 Screenshot attached</p>' : ''}
    </div>
  `

  try {
    await resend.emails.send({
      from: 'GroceryApp Feedback <onboarding@resend.dev>',
      to: 'sharif.shayma@gmail.com',
      subject: `💬 Feedback from ${userName || 'a user'}`,
      html,
      attachments,
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Resend error:', error)
    return res.status(500).json({ error: 'Failed to send feedback' })
  }
}
