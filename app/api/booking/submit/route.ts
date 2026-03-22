import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      practitionerId,
      date,
      time,
      duration,
      appointmentType,
      patientName,
      patientPhone,
      patientEmail,
      reason,
      patientId,
    } = body;

    // Validation
    if (!practitionerId || !date || !time || !duration || !appointmentType || !patientName || !patientEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Initialize Supabase service role client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: 'date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Validate time format
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(time)) {
      return NextResponse.json(
        { error: 'time must be in HH:MM format' },
        { status: 400 }
      );
    }

    // Check if slot is still available
    const [timeHour, timeMin] = time.split(':').map(Number);
    const slotStartMinutes = timeHour * 60 + timeMin;
    const slotEndMinutes = slotStartMinutes + duration;

    const { data: existingAppts } = await supabase
      .from('human_appointments')
      .select('start_time, duration_minutes')
      .eq('practitioner_id', practitionerId)
      .eq('appointment_date', date);

    const hasConflict = (existingAppts || []).some((apt) => {
      const [aptHour, aptMin] = apt.start_time.split(':').map(Number);
      const aptStartMinutes = aptHour * 60 + aptMin;
      const aptEndMinutes = aptStartMinutes + apt.duration_minutes;

      return (
        (slotStartMinutes >= aptStartMinutes && slotStartMinutes < aptEndMinutes) ||
        (slotEndMinutes > aptStartMinutes && slotEndMinutes <= aptEndMinutes) ||
        (slotStartMinutes <= aptStartMinutes && slotEndMinutes >= aptEndMinutes)
      );
    });

    if (hasConflict) {
      return NextResponse.json(
        { error: 'Time slot is no longer available' },
        { status: 409 }
      );
    }

    // Create appointment
    const { data: newAppointment, error: insertError } = await supabase
      .from('human_appointments')
      .insert({
        practitioner_id: practitionerId,
        appointment_date: date,
        start_time: time,
        duration_minutes: duration,
        appointment_type: appointmentType,
        patient_name: patientName,
        patient_phone: patientPhone || null,
        patient_email: patientEmail,
        notes: reason || null,
        patient_id: patientId || null,
        status: 'confirmed',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create appointment' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        appointmentId: newAppointment.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Submit booking error:', error);
    return NextResponse.json(
      { error: 'Failed to process booking' },
      { status: 500 }
    );
  }
}
