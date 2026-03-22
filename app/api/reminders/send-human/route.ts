import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import twilio from 'twilio';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendReminderEmail(
  patientEmail: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  practitionerName: string,
  practiceName: string,
  appointmentId: string
) {
  const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
  const formattedDate = appointmentDateTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = appointmentDateTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/appointments/${appointmentId}/confirm`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #c9a227 0%, #a0821d 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 30px;
          }
          .greeting {
            font-size: 16px;
            margin-bottom: 20px;
          }
          .appointment-details {
            background: #f9fafb;
            border-left: 4px solid #c9a227;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin: 12px 0;
            font-size: 14px;
          }
          .detail-label {
            font-weight: 600;
            color: #666;
          }
          .detail-value {
            color: #333;
          }
          .practice-name {
            font-size: 12px;
            color: #999;
            margin-top: 8px;
            border-top: 1px solid #e5e7eb;
            padding-top: 8px;
          }
          .cta-button {
            display: inline-block;
            background: #c9a227;
            color: white;
            padding: 12px 30px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
          }
          .cta-button:hover {
            background: #a0821d;
          }
          .footer {
            background: #f3f4f6;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${practiceName}</h1>
          </div>

          <div class="content">
            <div class="greeting">
              <p>Hi ${patientName},</p>
              <p>This is a reminder of your upcoming appointment with us.</p>
            </div>

            <div class="appointment-details">
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${formattedDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span class="detail-value">${formattedTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Practitioner:</span>
                <span class="detail-value">${practitionerName}</span>
              </div>
              <div class="practice-name">
                ${practiceName}
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${confirmUrl}" class="cta-button">Confirm Your Appointment</a>
            </div>

            <p style="font-size: 14px; color: #666;">
              If you need to reschedule or cancel, please contact us as soon as possible. We look forward to seeing you!
            </p>
          </div>

          <div class="footer">
            <p>© ${new Date().getFullYear()} ${practiceName}. All rights reserved.</p>
            <p>Please don't reply to this email. Contact us directly to make changes to your appointment.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: `Stride <noreply@stride.local>`,
      to: patientEmail,
      subject: `Appointment Reminder - ${formattedDate} at ${formattedTime}`,
      html: htmlContent,
    });
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

async function sendReminderSMS(
  patientPhone: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  practiceName: string
) {
  const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
  const formattedDate = appointmentDateTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = appointmentDateTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const message = `Hi ${patientName}! Reminder: You have an appointment at ${practiceName} on ${formattedDate} at ${formattedTime}. Please confirm or contact us if you need to reschedule.`;

  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: patientPhone,
    });
    return true;
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterStr = dayAfter.toISOString().split('T')[0];

    // Fetch appointments for tomorrow and day after
    const { data: appointments, error: fetchError } = await supabase
      .from('human_appointments')
      .select(
        `
        id,
        appointment_date,
        appointment_time,
        patient_name,
        patient_id,
        reminder_sent,
        status,
        practitioner_id,
        patient_email,
        patient_phone
      `
      )
      .in('appointment_date', [tomorrowStr, dayAfterStr])
      .in('status', ['scheduled', 'confirmed'])
      .eq('reminder_sent', false);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch appointments', details: fetchError.message }),
        { status: 500 }
      );
    }

    const sentReminders: string[] = [];
    const failedReminders: string[] = [];

    for (const appointment of appointments || []) {
      try {
        // Get patient details if not denormalized
        let patientEmail = appointment.patient_email;
        let patientPhone = appointment.patient_phone;
        let patientName = appointment.patient_name;

        if (!patientEmail || !patientPhone) {
          const { data: patient } = await supabase
            .from('human_patients')
            .select('name, email, phone')
            .eq('id', appointment.patient_id)
            .single();

          if (patient) {
            patientEmail = patientEmail || patient.email;
            patientPhone = patientPhone || patient.phone;
            patientName = patientName || patient.name;
          }
        }

        // Get practitioner details
        let practitionerName = 'Our Team';
        let practiceName = 'Stride Chiropractic';

        if (appointment.practitioner_id) {
          const { data: practitioner } = await supabase
            .from('practitioners')
            .select('full_name, practice_name')
            .eq('id', appointment.practitioner_id)
            .single();

          if (practitioner) {
            practitionerName = practitioner.full_name || 'Our Team';
            practiceName = practitioner.practice_name || 'Stride Chiropractic';
          }
        }

        // Send email
        if (patientEmail) {
          const emailSent = await sendReminderEmail(
            patientEmail,
            patientName,
            appointment.appointment_date,
            appointment.appointment_time,
            practitionerName,
            practiceName,
            appointment.id
          );

          if (!emailSent) {
            failedReminders.push(`${appointment.id}-email`);
            continue;
          }
        }

        // Send SMS
        if (patientPhone) {
          const smsSent = await sendReminderSMS(
            patientPhone,
            patientName,
            appointment.appointment_date,
            appointment.appointment_time,
            practiceName
          );

          if (!smsSent) {
            failedReminders.push(`${appointment.id}-sms`);
            continue;
          }
        }

        // Mark as reminder_sent
        const { error: updateError } = await supabase
          .from('human_appointments')
          .update({ reminder_sent: true })
          .eq('id', appointment.id);

        if (updateError) {
          console.error('Update error:', updateError);
          failedReminders.push(`${appointment.id}-update`);
          continue;
        }

        sentReminders.push(appointment.id);
      } catch (error) {
        console.error(`Error processing appointment ${appointment.id}:`, error);
        failedReminders.push(appointment.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: (appointments || []).length,
        sent: sentReminders.length,
        failed: failedReminders.length,
        sentReminders,
        failedReminders,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Reminder send error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
