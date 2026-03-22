'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

interface TopStat {
  label: string;
  value: number;
  trend: number | null;
  unit?: string;
}

interface PatientRow {
  id: string;
  name: string;
  total_visits: number;
  last_visit: string | null;
}

interface UpcomingAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  patient_name: string;
  status: string;
}

interface ChartData {
  week: number;
  value: number;
}

interface PatientMonth {
  month: string;
  count: number;
}

type Period = 'this_month' | 'last_30_days' | 'last_90_days' | 'this_year';

export default function AnalyticsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('this_month');

  const [activePatients, setActivePatients] = useState<TopStat>({
    label: 'Active Patients',
    value: 0,
    trend: null,
  });
  const [visitsMonth, setVisitsMonth] = useState<TopStat>({
    label: 'Visits This Month',
    value: 0,
    trend: null,
  });
  const [revenueMonth, setRevenueMonth] = useState<TopStat>({
    label: 'Revenue This Month',
    value: 0,
    trend: null,
    unit: '$',
  });
  const [noShowRate, setNoShowRate] = useState<TopStat>({
    label: 'No-Show Rate',
    value: 0,
    trend: null,
    unit: '%',
  });

  const [visitsPerWeek, setVisitsPerWeek] = useState<ChartData[]>([]);
  const [revenuePerWeek, setRevenuePerWeek] = useState<ChartData[]>([]);
  const [appointmentStatus, setAppointmentStatus] = useState<
    Array<{ status: string; count: number; color: string }>
  >([]);
  const [newPatientsPerMonth, setNewPatientsPerMonth] = useState<PatientMonth[]>([]);
  const [topPatients, setTopPatients] = useState<PatientRow[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      loadAnalytics();
    };

    checkAuth();
  }, [period]);

  const getDateRange = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    let startDate: Date, endDate: Date, prevStartDate: Date, prevEndDate: Date;

    switch (period) {
      case 'this_month':
        startDate = new Date(currentYear, currentMonth, 1);
        endDate = new Date();
        prevStartDate = new Date(currentYear, currentMonth - 1, 1);
        prevEndDate = startDate;
        break;
      case 'last_30_days':
        endDate = new Date();
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 30);
        prevEndDate = new Date(startDate);
        prevStartDate = new Date(prevEndDate);
        prevStartDate.setDate(prevEndDate.getDate() - 30);
        break;
      case 'last_90_days':
        endDate = new Date();
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 90);
        prevEndDate = new Date(startDate);
        prevStartDate = new Date(prevEndDate);
        prevStartDate.setDate(prevEndDate.getDate() - 90);
        break;
      case 'this_year':
        startDate = new Date(currentYear, 0, 1);
        endDate = new Date();
        prevStartDate = new Date(currentYear - 1, 0, 1);
        prevEndDate = new Date(currentYear, 0, 1);
        break;
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      prevStartDate: prevStartDate.toISOString().split('T')[0],
      prevEndDate: prevEndDate.toISOString().split('T')[0],
    };
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const dates = getDateRange();

      // Active Patients
      const { data: activeData } = await supabase
        .from('human_patients')
        .select('id')
        .eq('archived', false);

      const activeCount = activeData?.length || 0;

      const { data: prevActiveData } = await supabase
        .from('human_patients')
        .select('id')
        .eq('archived', false);
      const prevActiveCount = prevActiveData?.length || 0;

      // Visits This Month
      const { data: visitsData } = await supabase
        .from('human_visits')
        .select('id')
        .gte('visit_date', dates.startDate)
        .lte('visit_date', dates.endDate);

      const visitsCount = visitsData?.length || 0;

      const { data: prevVisitsData } = await supabase
        .from('human_visits')
        .select('id')
        .gte('visit_date', dates.prevStartDate)
        .lte('visit_date', dates.prevEndDate);

      const prevVisitsCount = prevVisitsData?.length || 0;

      // Revenue This Month
      const { data: revenueData } = await supabase
        .from('superbills')
        .select('total_fee')
        .gte('created_at', dates.startDate)
        .lte('created_at', dates.endDate);

      const revenueAmount = revenueData?.reduce((sum: number, bill: { total_fee: number | null }) => sum + (bill.total_fee || 0), 0) || 0;

      const { data: prevRevenueData } = await supabase
        .from('superbills')
        .select('total_fee')
        .gte('created_at', dates.prevStartDate)
        .lte('created_at', dates.prevEndDate);

      const prevRevenueAmount =
        prevRevenueData?.reduce((sum: number, bill: { total_fee: number | null }) => sum + (bill.total_fee || 0), 0) || 0;

      // No-Show Rate
      const { data: allApptData } = await supabase
        .from('human_appointments')
        .select('status')
        .gte('appointment_date', dates.startDate)
        .lte('appointment_date', dates.endDate);

      const totalAppointments = allApptData?.length || 1;
      const cancelledCount = allApptData?.filter((a: { status: string }) => a.status === 'cancelled').length || 0;
      const noShowPercentage = totalAppointments > 0 ? (cancelledCount / totalAppointments) * 100 : 0;

      const { data: prevAllApptData } = await supabase
        .from('human_appointments')
        .select('status')
        .gte('appointment_date', dates.prevStartDate)
        .lte('appointment_date', dates.prevEndDate);

      const prevTotalAppointments = prevAllApptData?.length || 1;
      const prevCancelledCount = prevAllApptData?.filter((a: { status: string }) => a.status === 'cancelled').length || 0;
      const prevNoShowPercentage =
        prevTotalAppointments > 0 ? (prevCancelledCount / prevTotalAppointments) * 100 : 0;

      setActivePatients({
        label: 'Active Patients',
        value: activeCount,
        trend: activeCount - prevActiveCount,
      });

      setVisitsMonth({
        label: 'Visits This Month',
        value: visitsCount,
        trend: visitsCount - prevVisitsCount,
      });

      setRevenueMonth({
        label: 'Revenue This Month',
        value: Math.round(revenueAmount),
        trend:
          prevRevenueAmount > 0
            ? Math.round(revenueAmount - prevRevenueAmount)
            : revenueAmount > 0
              ? 1
              : null,
        unit: '$',
      });

      setNoShowRate({
        label: 'No-Show Rate',
        value: Math.round(noShowPercentage * 10) / 10,
        trend: Math.round((noShowPercentage - prevNoShowPercentage) * 10) / 10,
        unit: '%',
      });

      // Visits per week (last 12 weeks)
      await loadVisitsPerWeek(dates);
      await loadRevenuePerWeek(dates);
      await loadAppointmentStatus(dates);
      await loadNewPatientsPerMonth();
      await loadTopPatients();
      await loadUpcomingAppointments();
    } catch (err) {
      console.error('Analytics load error:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadVisitsPerWeek = async (dates: ReturnType<typeof getDateRange>) => {
    const { data } = await supabase
      .from('human_visits')
      .select('visit_date')
      .gte('visit_date', dates.startDate)
      .lte('visit_date', dates.endDate)
      .order('visit_date', { ascending: true });

    const weekMap = new Map<number, number>();
    const today = new Date();

    data?.forEach((visit: { visit_date: string }) => {
      const visitDate = new Date(visit.visit_date);
      const dayDiff = Math.floor((today.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
      const week = Math.floor(dayDiff / 7);
      weekMap.set(week, (weekMap.get(week) || 0) + 1);
    });

    const chartData: ChartData[] = [];
    for (let i = 11; i >= 0; i--) {
      chartData.push({ week: i, value: weekMap.get(i) || 0 });
    }

    setVisitsPerWeek(chartData);
  };

  const loadRevenuePerWeek = async (dates: ReturnType<typeof getDateRange>) => {
    const { data } = await supabase
      .from('superbills')
      .select('total_fee, created_at')
      .gte('created_at', dates.startDate)
      .lte('created_at', dates.endDate)
      .order('created_at', { ascending: true });

    const weekMap = new Map<number, number>();
    const today = new Date();

    data?.forEach((bill: { total_fee: number | null; created_at: string }) => {
      const billDate = new Date(bill.created_at);
      const dayDiff = Math.floor((today.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24));
      const week = Math.floor(dayDiff / 7);
      weekMap.set(week, (weekMap.get(week) || 0) + (bill.total_fee || 0));
    });

    const chartData: ChartData[] = [];
    for (let i = 11; i >= 0; i--) {
      chartData.push({ week: i, value: weekMap.get(i) || 0 });
    }

    setRevenuePerWeek(chartData);
  };

  const loadAppointmentStatus = async (dates: ReturnType<typeof getDateRange>) => {
    const { data } = await supabase
      .from('human_appointments')
      .select('status')
      .gte('appointment_date', dates.startDate)
      .lte('appointment_date', dates.endDate);

    const statusMap = new Map<string, number>();
    data?.forEach((appt: { status: string }) => {
      statusMap.set(appt.status || 'unknown', (statusMap.get(appt.status || 'unknown') || 0) + 1);
    });

    const statusColors: Record<string, string> = {
      scheduled: '#c9a227',
      confirmed: '#10b981',
      completed: '#3b82f6',
      cancelled: '#ef4444',
    };

    const statusData = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
      color: statusColors[status] || '#6b7280',
    }));

    setAppointmentStatus(statusData);
  };

  const loadNewPatientsPerMonth = async () => {
    const { data } = await supabase
      .from('human_patients')
      .select('created_at')
      .order('created_at', { ascending: true });

    const monthMap = new Map<string, number>();
    data?.forEach((patient: { created_at: string }) => {
      const date = new Date(patient.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
    });

    const now = new Date();
    const monthData: PatientMonth[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthData.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        count: monthMap.get(monthKey) || 0,
      });
    }

    setNewPatientsPerMonth(monthData);
  };

  const loadTopPatients = async () => {
    const { data: patients } = await supabase
      .from('human_patients')
      .select('id, first_name, last_name')
      .eq('archived', false);

    if (!patients) {
      setTopPatients([]);
      return;
    }

    const patientStats: PatientRow[] = [];

    for (const patient of patients as Array<{ id: string; first_name: string; last_name: string }>) {
      const { data: visits } = await supabase
        .from('human_visits')
        .select('visit_date')
        .eq('patient_id', patient.id)
        .order('visit_date', { ascending: false });

      patientStats.push({
        id: patient.id,
        name: `${patient.first_name} ${patient.last_name}`,
        total_visits: visits?.length || 0,
        last_visit: (visits as Array<{ visit_date: string }> | null)?.[0]?.visit_date || null,
      });
    }

    patientStats.sort((a, b) => b.total_visits - a.total_visits);
    setTopPatients(patientStats.slice(0, 10));
  };

  const loadUpcomingAppointments = async () => {
    const today = new Date();
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

    const { data } = await supabase
      .from('human_appointments')
      .select('id, appointment_date, appointment_time, patient_name, status')
      .gte('appointment_date', today.toISOString().split('T')[0])
      .lte('appointment_date', sevenDaysOut.toISOString().split('T')[0])
      .in('status', ['scheduled', 'confirmed'])
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })
      .limit(7);

    setUpcomingAppointments(data || []);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#081120] p-8">
        <div className="text-[#c9a227]">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#081120]">
      {/* Header */}
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Analytics</h1>
            <p className="mt-2 text-sm text-gray-400">Comprehensive practice insights</p>
          </div>
          <Link href="/human/dashboard" className="text-[#c9a227] hover:text-[#e6c94e]">
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Period Selector */}
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-8 py-4">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="rounded border border-[#1a3358] bg-[#081120] px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#c9a227]"
        >
          <option value="this_month">This Month</option>
          <option value="last_30_days">Last 30 Days</option>
          <option value="last_90_days">Last 90 Days</option>
          <option value="this_year">This Year</option>
        </select>
      </div>

      <div className="p-8">
        {error && <div className="mb-6 rounded bg-red-900/30 p-4 text-red-400">{error}</div>}

        {/* Top Stats */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[activePatients, visitsMonth, revenueMonth, noShowRate].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-[#1a3358] bg-[#0d1b30] p-6">
              <p className="text-sm text-gray-400">{stat.label}</p>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <p className="text-4xl font-bold text-white">
                    {stat.unit}
                    {stat.value.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  {stat.trend !== null && stat.trend !== undefined ? (
                    <div
                      className={`flex items-center gap-1 text-sm font-semibold ${
                        stat.trend > 0
                          ? 'text-emerald-400'
                          : stat.trend < 0
                            ? 'text-red-400'
                            : 'text-gray-400'
                      }`}
                    >
                      {stat.trend > 0 ? '↑' : stat.trend < 0 ? '↓' : '−'}
                      {Math.abs(stat.trend).toFixed(stat.unit === '%' ? 1 : 0)}
                      {stat.unit}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">−</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Visits Per Week */}
          <div className="rounded-lg border border-[#1a3358] bg-[#0d1b30] p-6">
            <h2 className="mb-6 text-lg font-semibold text-white">Visits Per Week</h2>
            <svg viewBox="0 0 600 300" className="w-full">
              {/* Grid lines */}
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <line
                  key={`gridline-${i}`}
                  x1="50"
                  y1={50 + (i * 240) / 5}
                  x2="580"
                  y2={50 + (i * 240) / 5}
                  stroke="#1a3358"
                  strokeWidth="1"
                />
              ))}

              {/* Bars */}
              {visitsPerWeek.map((item, idx) => {
                const maxVal = Math.max(...visitsPerWeek.map((d) => d.value), 1);
                const barHeight = (item.value / maxVal) * 200;
                const x = 60 + idx * 42;
                const y = 250 - barHeight;

                return (
                  <g key={`bar-${idx}`}>
                    <rect x={x} y={y} width="30" height={barHeight} fill="#c9a227" rx="2" />
                    <text
                      x={x + 15}
                      y="280"
                      textAnchor="middle"
                      fontSize="10"
                      fill="#9ca3af"
                    >
                      {item.week}w
                    </text>
                  </g>
                );
              })}

              {/* Y-axis */}
              <line x1="50" y1="50" x2="50" y2="250" stroke="#1a3358" strokeWidth="2" />
              {/* X-axis */}
              <line x1="50" y1="250" x2="580" y2="250" stroke="#1a3358" strokeWidth="2" />
            </svg>
          </div>

          {/* Revenue Per Week */}
          <div className="rounded-lg border border-[#1a3358] bg-[#0d1b30] p-6">
            <h2 className="mb-6 text-lg font-semibold text-white">Revenue Per Week</h2>
            <svg viewBox="0 0 600 300" className="w-full">
              {/* Grid lines */}
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <line
                  key={`gridline-${i}`}
                  x1="50"
                  y1={50 + (i * 240) / 5}
                  x2="580"
                  y2={50 + (i * 240) / 5}
                  stroke="#1a3358"
                  strokeWidth="1"
                />
              ))}

              {/* Line and dots */}
              {revenuePerWeek.length > 0 && (
                <>
                  <polyline
                    points={revenuePerWeek
                      .map((item, idx) => {
                        const maxVal = Math.max(...revenuePerWeek.map((d) => d.value), 1);
                        const y = 250 - (item.value / maxVal) * 200;
                        const x = 60 + idx * 42;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#c9a227"
                    strokeWidth="2"
                  />

                  {revenuePerWeek.map((item, idx) => {
                    const maxVal = Math.max(...revenuePerWeek.map((d) => d.value), 1);
                    const y = 250 - (item.value / maxVal) * 200;
                    const x = 60 + idx * 42;

                    return (
                      <g key={`dot-${idx}`}>
                        <circle cx={x} cy={y} r="4" fill="#c9a227" />
                        <text
                          x={x}
                          y="280"
                          textAnchor="middle"
                          fontSize="10"
                          fill="#9ca3af"
                        >
                          {item.week}w
                        </text>
                      </g>
                    );
                  })}
                </>
              )}

              {/* Axes */}
              <line x1="50" y1="50" x2="50" y2="250" stroke="#1a3358" strokeWidth="2" />
              <line x1="50" y1="250" x2="580" y2="250" stroke="#1a3358" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Appointment Status Donut */}
          <div className="rounded-lg border border-[#1a3358] bg-[#0d1b30] p-6">
            <h2 className="mb-6 text-lg font-semibold text-white">Appointment Status</h2>
            <svg viewBox="0 0 300 300" className="w-full">
              {appointmentStatus.length > 0 && (
                (() => {
                  const total = appointmentStatus.reduce((sum, s) => sum + s.count, 0);
                  let startAngle = -90;

                  return appointmentStatus.map((status, idx) => {
                    const sliceAngle = (status.count / total) * 360;
                    const endAngle = startAngle + sliceAngle;

                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (endAngle * Math.PI) / 180;

                    const x1 = 150 + 80 * Math.cos(startRad);
                    const y1 = 150 + 80 * Math.sin(startRad);
                    const x2 = 150 + 80 * Math.cos(endRad);
                    const y2 = 150 + 80 * Math.sin(endRad);

                    const largeArc = sliceAngle > 180 ? 1 : 0;

                    const path = `M 150 150 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;

                    const midAngle = (startAngle + endAngle) / 2;
                    const midRad = (midAngle * Math.PI) / 180;
                    const labelX = 150 + 50 * Math.cos(midRad);
                    const labelY = 150 + 50 * Math.sin(midRad);

                    startAngle = endAngle;

                    return (
                      <g key={`segment-${idx}`}>
                        <path d={path} fill={status.color} stroke="#081120" strokeWidth="2" />
                        <text
                          x={labelX}
                          y={labelY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="12"
                          fontWeight="bold"
                          fill="white"
                        >
                          {Math.round((status.count / total) * 100)}%
                        </text>
                      </g>
                    );
                  });
                })()
              )}
            </svg>
            <div className="mt-4 space-y-2">
              {appointmentStatus.map((status) => (
                <div key={status.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="capitalize text-gray-300">{status.status}</span>
                  </div>
                  <span className="text-white font-semibold">{status.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* New Patients Per Month */}
          <div className="rounded-lg border border-[#1a3358] bg-[#0d1b30] p-6">
            <h2 className="mb-6 text-lg font-semibold text-white">New Patients</h2>
            <svg viewBox="0 0 600 300" className="w-full">
              {/* Grid lines */}
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <line
                  key={`gridline-${i}`}
                  x1="50"
                  y1={50 + (i * 240) / 5}
                  x2="580"
                  y2={50 + (i * 240) / 5}
                  stroke="#1a3358"
                  strokeWidth="1"
                />
              ))}

              {/* Bars */}
              {newPatientsPerMonth.map((item, idx) => {
                const maxVal = Math.max(...newPatientsPerMonth.map((d) => d.count), 1);
                const barHeight = (item.count / maxVal) * 200;
                const x = 60 + idx * 88;
                const y = 250 - barHeight;

                return (
                  <g key={`bar-${idx}`}>
                    <rect x={x} y={y} width="60" height={barHeight} fill="#c9a227" rx="2" />
                    <text x={x + 30} y="280" textAnchor="middle" fontSize="10" fill="#9ca3af">
                      {item.month}
                    </text>
                  </g>
                );
              })}

              {/* Axes */}
              <line x1="50" y1="50" x2="50" y2="250" stroke="#1a3358" strokeWidth="2" />
              <line x1="50" y1="250" x2="580" y2="250" stroke="#1a3358" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Tables Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Top Patients Table */}
          <div className="rounded-lg border border-[#1a3358] bg-[#0d1b30] p-6">
            <h2 className="mb-6 text-lg font-semibold text-white">Top Patients by Visits</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a3358]">
                    <th className="px-4 py-3 text-left text-gray-400">Name</th>
                    <th className="px-4 py-3 text-center text-gray-400">Total Visits</th>
                    <th className="px-4 py-3 text-right text-gray-400">Last Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {topPatients.map((patient) => (
                    <tr key={patient.id} className="border-b border-[#1a3358] hover:bg-[#0a1015]">
                      <td className="px-4 py-3 text-white">{patient.name}</td>
                      <td className="px-4 py-3 text-center text-[#c9a227]">
                        {patient.total_visits}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {patient.last_visit
                          ? new Date(patient.last_visit).toLocaleDateString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming Appointments Table */}
          <div className="rounded-lg border border-[#1a3358] bg-[#0d1b30] p-6">
            <h2 className="mb-6 text-lg font-semibold text-white">Upcoming Appointments</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a3358]">
                    <th className="px-4 py-3 text-left text-gray-400">Date</th>
                    <th className="px-4 py-3 text-left text-gray-400">Time</th>
                    <th className="px-4 py-3 text-left text-gray-400">Patient</th>
                    <th className="px-4 py-3 text-right text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingAppointments.map((appt) => (
                    <tr key={appt.id} className="border-b border-[#1a3358] hover:bg-[#0a1015]">
                      <td className="px-4 py-3 text-white">
                        {new Date(appt.appointment_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{appt.appointment_time}</td>
                      <td className="px-4 py-3 text-gray-300">{appt.patient_name}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-block rounded px-2 py-1 text-xs font-semibold capitalize ${
                            appt.status === 'confirmed'
                              ? 'bg-emerald-900/50 text-emerald-400'
                              : 'bg-amber-900/50 text-amber-400'
                          }`}
                        >
                          {appt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
