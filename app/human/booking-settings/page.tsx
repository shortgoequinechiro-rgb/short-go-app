'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

interface PractitionerAvailability {
  id: string;
  practitioner_id: string;
  day_of_week: number;
  available: boolean;
  start_time: string;
  end_time: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function BookingSettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [availability, setAvailability] = useState<PractitionerAvailability[]>([]);
  const [newAppointmentType, setNewAppointmentType] = useState('');
  const [copied, setCopied] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUserId(user.id);

      // Load settings
      const { data: settingsData } = await supabase
        .from('booking_settings')
        .select('*')
        .eq('practitioner_id', user.id)
        .single();

      if (settingsData) {
        setSettings(settingsData);
      }

      // Load availability
      const { data: availData } = await supabase
        .from('practitioner_availability')
        .select('*')
        .eq('practitioner_id', user.id)
        .order('day_of_week');

      if (availData) {
        setAvailability(availData);
      } else {
        // Initialize with default availability (closed)
        const defaultAvail = Array.from({ length: 7 }, (_, i) => ({
          id: '',
          practitioner_id: user.id,
          day_of_week: i,
          available: i >= 1 && i <= 5, // Mon-Fri
          start_time: '09:00',
          end_time: '17:00',
        }));
        setAvailability(defaultAvail);
      }

      setLoading(false);
    };

    checkAuth();
  }, [supabase, router]);

  const handleSettingsChange = (field: string, value: any) => {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            [field]: value,
          }
        : null
    );
  };

  const handleAvailabilityChange = (
    dayOfWeek: number,
    field: string,
    value: any
  ) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.day_of_week === dayOfWeek ? { ...day, [field]: value } : day
      )
    );
  };

  const addAppointmentType = () => {
    if (newAppointmentType.trim() && settings) {
      const updated = {
        ...settings,
        appointment_types: [...settings.appointment_types, newAppointmentType.trim()],
      };
      setSettings(updated);
      setNewAppointmentType('');
    }
  };

  const removeAppointmentType = (index: number) => {
    if (settings) {
      const updated = {
        ...settings,
        appointment_types: settings.appointment_types.filter((_, i) => i !== index),
      };
      setSettings(updated);
    }
  };

  const handleSave = async () => {
    if (!settings || !userId) {
      setError('Settings not loaded');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Save booking settings
      const { error: settingsError } = await supabase
        .from('booking_settings')
        .upsert({
          id: settings.id,
          practitioner_id: userId,
          slug: settings.slug,
          practice_name: settings.practice_name,
          practice_address: settings.practice_address,
          practice_phone: settings.practice_phone,
          booking_enabled: settings.booking_enabled,
          default_duration_minutes: settings.default_duration_minutes,
          min_notice_hours: settings.min_notice_hours,
          max_advance_days: settings.max_advance_days,
          appointment_types: settings.appointment_types,
        })
        .eq('practitioner_id', userId);

      if (settingsError) {
        setError('Failed to save settings: ' + settingsError.message);
        setSaving(false);
        return;
      }

      // Save availability
      for (const day of availability) {
        const { error: availError } = await supabase
          .from('practitioner_availability')
          .upsert({
            practitioner_id: userId,
            day_of_week: day.day_of_week,
            available: day.available,
            start_time: day.start_time,
            end_time: day.end_time,
          })
          .eq('practitioner_id', userId)
          .eq('day_of_week', day.day_of_week);

        if (availError) {
          setError('Failed to save availability: ' + availError.message);
          setSaving(false);
          return;
        }
      }

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const bookingLink = settings ? `/book/${settings.slug}` : '';

  const copyBookingLink = () => {
    const url = `${window.location.origin}${bookingLink}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#081120] p-4 flex items-center justify-center">
        <div className="text-blue-300">Loading...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-[#081120] p-4 flex items-center justify-center">
        <div className="text-red-400">Failed to load settings</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#081120] p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Booking Settings</h1>

        {error && (
          <div className="bg-red-900/20 border border-red-600/50 text-red-300 p-4 rounded mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900/20 border border-green-600/50 text-green-300 p-4 rounded mb-6">
            {success}
          </div>
        )}

        <div className="bg-[#0d1b30] border border-[#1a3358] rounded-lg p-6 space-y-8">
          {/* Booking Enabled Toggle */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.booking_enabled}
                onChange={(e) => handleSettingsChange('booking_enabled', e.target.checked)}
                className="mr-3 w-4 h-4"
              />
              <span className="text-white font-medium">Enable Online Booking</span>
            </label>
          </div>

          {/* Booking Link */}
          {settings.booking_enabled && (
            <div>
              <label className="block text-white font-medium mb-2">Your Booking Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`${window.location.origin}${bookingLink}`}
                  readOnly
                  className="flex-1 bg-[#081120] border border-[#1a3358] text-blue-300/70 rounded px-4 py-2"
                />
                <button
                  onClick={copyBookingLink}
                  className="bg-[#c9a227] text-[#081120] px-4 py-2 rounded font-semibold hover:bg-[#e0b94e] transition"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Booking Slug */}
          <div>
            <label className="block text-white font-medium mb-2">Booking URL Slug</label>
            <input
              type="text"
              value={settings.slug}
              onChange={(e) => handleSettingsChange('slug', e.target.value)}
              className="w-full bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
              placeholder="e.g., john-smith"
            />
          </div>

          {/* Practice Info */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Practice Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-white font-medium mb-2">Practice Name</label>
                <input
                  type="text"
                  value={settings.practice_name}
                  onChange={(e) => handleSettingsChange('practice_name', e.target.value)}
                  className="w-full bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
                />
              </div>
              <div>
                <label className="block text-white font-medium mb-2">Address</label>
                <input
                  type="text"
                  value={settings.practice_address}
                  onChange={(e) => handleSettingsChange('practice_address', e.target.value)}
                  className="w-full bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
                />
              </div>
              <div>
                <label className="block text-white font-medium mb-2">Phone</label>
                <input
                  type="tel"
                  value={settings.practice_phone}
                  onChange={(e) => handleSettingsChange('practice_phone', e.target.value)}
                  className="w-full bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
                />
              </div>
            </div>
          </div>

          {/* Booking Constraints */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Booking Constraints</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-white font-medium mb-2">Default Duration (minutes)</label>
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={settings.default_duration_minutes}
                  onChange={(e) =>
                    handleSettingsChange('default_duration_minutes', parseInt(e.target.value))
                  }
                  className="w-full bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
                />
              </div>
              <div>
                <label className="block text-white font-medium mb-2">Min Notice (hours)</label>
                <input
                  type="number"
                  min="0"
                  value={settings.min_notice_hours}
                  onChange={(e) =>
                    handleSettingsChange('min_notice_hours', parseInt(e.target.value))
                  }
                  className="w-full bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
                />
              </div>
              <div>
                <label className="block text-white font-medium mb-2">Max Advance (days)</label>
                <input
                  type="number"
                  min="1"
                  value={settings.max_advance_days}
                  onChange={(e) =>
                    handleSettingsChange('max_advance_days', parseInt(e.target.value))
                  }
                  className="w-full bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
                />
              </div>
            </div>
          </div>

          {/* Appointment Types */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Appointment Types</h3>
            <div className="space-y-3">
              {settings.appointment_types.map((type, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={type}
                    onChange={(e) => {
                      const updated = [...settings.appointment_types];
                      updated[index] = e.target.value;
                      handleSettingsChange('appointment_types', updated);
                    }}
                    className="flex-1 bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
                  />
                  <button
                    onClick={() => removeAppointmentType(index)}
                    className="bg-red-900/30 text-red-400 px-3 py-2 rounded hover:bg-red-900/50 transition"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAppointmentType}
                  onChange={(e) => setNewAppointmentType(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAppointmentType();
                    }
                  }}
                  placeholder="New appointment type..."
                  className="flex-1 bg-[#081120] border border-[#1a3358] text-white rounded px-4 py-2 focus:outline-none focus:border-[#c9a227] transition"
                />
                <button
                  onClick={addAppointmentType}
                  className="bg-[#c9a227] text-[#081120] px-4 py-2 rounded font-semibold hover:bg-[#e0b94e] transition"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Availability */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Weekly Availability</h3>
            <div className="space-y-4">
              {availability.map((day) => (
                <div
                  key={day.day_of_week}
                  className="flex items-center gap-4 pb-4 border-b border-[#1a3358] last:border-b-0"
                >
                  <label className="w-24 text-white font-medium">{DAYS[day.day_of_week]}</label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={day.available}
                      onChange={(e) =>
                        handleAvailabilityChange(day.day_of_week, 'available', e.target.checked)
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-blue-300/70 text-sm">Available</span>
                  </label>

                  {day.available && (
                    <div className="flex gap-2 ml-auto">
                      <div>
                        <label className="block text-blue-300/70 text-xs mb-1">Start</label>
                        <input
                          type="time"
                          value={day.start_time}
                          onChange={(e) =>
                            handleAvailabilityChange(
                              day.day_of_week,
                              'start_time',
                              e.target.value
                            )
                          }
                          className="bg-[#081120] border border-[#1a3358] text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-[#c9a227]"
                        />
                      </div>
                      <div>
                        <label className="block text-blue-300/70 text-xs mb-1">End</label>
                        <input
                          type="time"
                          value={day.end_time}
                          onChange={(e) =>
                            handleAvailabilityChange(day.day_of_week, 'end_time', e.target.value)
                          }
                          className="bg-[#081120] border border-[#1a3358] text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-[#c9a227]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-4 pt-4 border-t border-[#1a3358]">
            <button
              onClick={() => window.history.back()}
              className="bg-[#1a3358] text-white px-6 py-2 rounded font-semibold hover:bg-[#254470] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#c9a227] text-[#081120] px-6 py-2 rounded font-semibold hover:bg-[#e0b94e] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
