import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const practitionerId = searchParams.get('practitionerId');
  const date = searchParams.get('date');

  // Validation
  if (!practitionerId || !date) {
    return NextResponse.json(
      { error: 'practitionerId and date are required' },
      { status: 400 }
    );
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return NextResponse.json(
      { error: 'date must be in YYYY-MM-DD format' },
      { status: 400 }
    );
  }

  // Initialize Supabase service role client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  try {
    // Parse the date
    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 6 = Saturday

    // Fetch practitioner availability for this day of week
    const { data: availabilityData, error: availabilityError } = await supabase
      .from('practitioner_availability')
      .select('start_time, end_time')
      .eq('practitioner_id', practitionerId)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (availabilityError || !availabilityData) {
      return NextResponse.json({ slots: [] });
    }

    // Fetch booking settings to get duration and constraints
    const { data: settingsData } = await supabase
      .from('booking_settings')
      .select('default_duration_minutes, min_notice_hours, max_advance_days')
      .eq('practitioner_id', practitionerId)
      .single();

    const defaultDuration = settingsData?.default_duration_minutes || 30;
    const minNoticeHours = settingsData?.min_notice_hours || 2;
    const maxAdvanceDays = settingsData?.max_advance_days || 30;

    // Check if date is within advance booking window
    const now = new Date();
    const minBookingTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
    const maxBookingDate = new Date(now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000);

    const selectedDateTime = new Date(date);
    if (selectedDateTime < minBookingTime || selectedDateTime > maxBookingDate) {
      return NextResponse.json({ slots: [] });
    }

    // Fetch existing appointments for this date
    const { data: appointmentsData } = await supabase
      .from('human_appointments')
      .select('start_time, duration_minutes')
      .eq('practitioner_id', practitionerId)
      .eq('appointment_date', date);

    // Parse availability times
    const [startHour, startMin] = availabilityData.start_time.split(':').map(Number);
    const [endHour, endMin] = availabilityData.end_time.split(':').map(Number);

    const startMinutesFromMidnight = startHour * 60 + startMin;
    const endMinutesFromMidnight = endHour * 60 + endMin;

    // Generate all possible slots
    const slots: string[] = [];
    for (let minutes = startMinutesFromMidnight; minutes + defaultDuration <= endMinutesFromMidnight; minutes += 30) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }

    // Filter out booked slots
    const bookedSlots = (appointmentsData || []).map((apt) => {
      const [aptHour, aptMin] = apt.start_time.split(':').map(Number);
      return {
        startMinutes: aptHour * 60 + aptMin,
        endMinutes: aptHour * 60 + aptMin + apt.duration_minutes,
      };
    });

    const availableSlots = slots.filter((slotStr) => {
      const [slotHour, slotMin] = slotStr.split(':').map(Number);
      const slotStartMinutes = slotHour * 60 + slotMin;
      const slotEndMinutes = slotStartMinutes + defaultDuration;

      return !bookedSlots.some(
        (booked) =>
          (slotStartMinutes >= booked.startMinutes && slotStartMinutes < booked.endMinutes) ||
          (slotEndMinutes > booked.startMinutes && slotEndMinutes <= booked.endMinutes) ||
          (slotStartMinutes <= booked.startMinutes && slotEndMinutes >= booked.endMinutes)
      );
    });

    return NextResponse.json({ slots: availableSlots });
  } catch (error) {
    console.error('Availability error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}
