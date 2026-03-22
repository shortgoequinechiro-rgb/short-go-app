'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface BookingSettings {
  id: string;
  practitioner_id: string;
  slug: string;
  practice_name: string;
  practice_address: string;
  practice_phone: string;
  booking_enabled: boolean;
  default_duration_minutes: number;
  min_notice_hours: number;
  max_advance_days: number;
  appointment_types: string[];
}

interface Practitioner {
  id: string;
  full_name: string;
}

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'booking' | 'confirmation'>('booking');

  // Form state
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentType, setAppointmentType] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [reason, setReason] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  // Load booking settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('booking_settings')
          .select(
            `
            id,
            practitioner_id,
            slug,
            practice_name,
            practice_address,
            practice_phone,
            booking_enabled,
            default_duration_minutes,
            min_notice_hours,
            max_advance_days,
            appointment_types
          `
          )
          .eq('slug', slug)
          .eq('booking_enabled', true)
          .single();

        if (error || !data) {
          setError('Booking not found or disabled');
          setLoading(false);
          return;
        }

        setSettings(data);

        // Load practitioner info
        const { data: practData } = await supabase
          .from('practitioners')
          .select('id, full_name')
          .eq('id', data.practitioner_id)
          .single();

        if (practData) {
          setPractitioner(practData);
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Load settings error:', err);
        setError('Failed to load booking page');
        setLoading(false);
      }
    };

    if (slug) {
      loadSettings();
    }
  }, [slug, supabase]);

  // Load available slots when date changes
  useEffect(() => {
    if (!selectedDate || !settings) return;

    const loadSlots = async () => {
      setSlotsLoading(true);
      try {
        const response = await fetch(
          `/api/booking/availability?practitionerId=${settings.practitioner_id}&date=${selectedDate}`
        );
        const data = await response.json();
        setAvailableSlots(data.slots || []);
        setSelectedTime('');
      } catch (err) {
        console.error('Load slots error:', err);
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };

    loadSlots();
  }, [selectedDate, settings]);

  // Get min and max dates
  const today = new Date();
  const minDate = new Date(today.getTime() + (settings?.min_notice_hours || 2) * 60 * 60 * 1000);
  const maxDate = new Date(today.getTime() + (settings?.max_advance_days || 30) * 24 * 60 * 60 * 1000);

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const minDateStr = formatDateForInput(minDate);
  const maxDateStr = formatDateForInput(maxDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate || !selectedTime || !appointmentType || !patientName || !patientEmail) {
      setError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/booking/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practitionerId: settings!.practitioner_id,
          date: selectedDate,
          time: selectedTime,
          duration: settings!.default_duration_minutes,
          appointmentType,
          patientName,
          patientPhone,
          patientEmail,
          reason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to book appointment');
        setSubmitting(false);
        return;
      }

      setConfirmationData({
        appointmentId: result.appointmentId,
        date: selectedDate,
        time: selectedTime,
        practitioner: practitioner?.full_name || 'Practitioner',
        type: appointmentType,
      });

      setStep('confirmation');
      setSubmitting(false);
    } catch (err: any) {
      console.error('Submit error:', err);
      setError('An error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#081120] flex items-center justify-center">
        <div className="text-blue-300">Loading...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-[#081120] flex items-center justify-center">
        <div className="text-red-400">{error || 'Booking not found'}</div>
      </div>
    );
  }

  if (step === 'confirmation') {
    return (
      <div className="min-h-screen bg-[#081120] p-4">
        <div className="max-w-md mx-auto pt-8">
          <div className="bg-[#0d1b30] border border-[#1a3358] rounded-lg p-8 text-center">
            <div className="text-4xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-white mb-2">Appointment Confirmed</h1>
            <p className="text-blue-300/70 mb-6">Your appointment has been successfully booked.</p>

            <div className="bg-[#081120] rounded p-4 mb-6 text-left text-sm">
              <div className="mb-3">
                <span className="text-blue-300/70">Practitioner:</span>
                <p className="text-white font-medium">{confirmationData.practitioner}</p>
              </div>
              <div className="mb-3">
                <span className="text-blue-300/70">Type:</span>
                <p className="text-white font-medium">{confirmationData.type}</p>
              </div>
              <div className="mb-3">
                <span className="text-blue-300/70">Date & Time:</span>
                <p className="text-white font-medium">
                  {new Date(confirmationData.date).toLocaleDateString()} at {confirmationData.time}
                </p>
              </div>
              <div>
                <span className="text-blue-300/70">Confirmation #:</span>
                <p className="text-white font-medium text-xs break-all">{confirmationData.appointmentId}</p>
              </div>
            </div>

            <p className="text-blue-300/70 text-sm mb-6">
              A confirmation email has been sent to {patientEmail}
            </p>

            <button
              onClick={() => window.location.href = '/'}
              className="bg-[#c9a227] text-[#081120] px-6 py-2 rounded font-semibold hover:bg-[#e0b94e] transition"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#081120] p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{settings.practice_name}</h1>
          <p className="text-blue-300/70">{settings.practice_address}</p>
          {settings.practice_phone && (
            <p className="text-blue-300/70">{settings.practice_phone}</p>
          )}
        </div>

        {/* Form */}
        <div className="bg-[#0d1b30] border border-[#1a3358] rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Book an Appointment</h2>

          {error && (
            <div className="bg-red-900/20 border border-red-600/50 text-red-300 p-4 rounded mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Appointment Type */}
            <div>
              <label className="block text-white font-medium mb-2">
                Appointment Type <span className="text-red-400">*</span>
              </label>
              <select
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value)}
                className="w-full bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
                required
              >
                <option value="">Select appointment type</option>
                {settings.appointment_types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-white font-medium mb-2">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={minDateStr}
                max={maxDateStr}
                className="w-full bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
                required
              />
            </div>

            {/* Time Slots */}
            {selectedDate && (
              <div>
                <label className="block text-white font-medium mb-2">
                  Time <span className="text-red-400">*</span>
                </label>
                {slotsLoading ? (
                  <div className="text-blue-300/70">Loading available times...</div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-blue-300/70">No available times on this date</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTime(slot)}
                        className={`p-2 rounded border text-sm font-medium transition ${
                          selectedTime === slot
                            ? 'bg-[#c9a227] text-[#081120] border-[#c9a227]'
                            : 'bg-[#081120] border-[#1a3358] text-white hover:border-[#c9a227]'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Patient Name */}
            <div>
              <label className="block text-white font-medium mb-2">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-white font-medium mb-2">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                className="w-full bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
                required
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-white font-medium mb-2">Phone</label>
              <input
                type="tel"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                className="w-full bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-white font-medium mb-2">Reason for Visit</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#c9a227] text-[#081120] py-2 rounded font-semibold hover:bg-[#e0b94e] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Booking...' : 'Book Appointment'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
