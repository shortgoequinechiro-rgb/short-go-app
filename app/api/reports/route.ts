import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../lib/auth'

interface ReportData {
  totalRevenue: number
  revenueThisMonth: number
  totalVisits: number
  visitsThisMonth: number
  activePatients: number
  outstandingBalance: number
  monthlyRevenue: Array<{
    month: string
    amount: number
  }>
  topServices: Array<{
    serviceId: string
    serviceName: string
    timesUsed: number
    totalRevenue: number
  }>
  recentActivity: Array<{
    id: string
    date: string
    type: 'invoice' | 'payment' | 'visit'
    description: string
  }>
  busiestDays: Array<{
    dayOfWeek: string
    visitCount: number
  }>
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error

    const practitionerId = user!.id
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    // Optional date range filtering via query params
    const url = new URL(request.url)
    const fromParam = url.searchParams.get('from')
    const toParam = url.searchParams.get('to')
    const monthsBack = parseInt(url.searchParams.get('months') || '6', 10)

    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - monthsBack)
    const ninetyDaysAgo = new Date(now)
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    // If explicit from/to provided, use those for filtering
    const dateFrom = fromParam ? new Date(fromParam) : null
    const dateTo = toParam ? new Date(toParam) : null

    // 1. Get all paid invoices for total revenue (with optional date range)
    let paidInvoicesQuery = supabaseAdmin
      .from('invoices')
      .select('id, total_cents, invoice_date, paid_at')
      .eq('practitioner_id', practitionerId)
      .eq('status', 'paid')
    if (dateFrom) paidInvoicesQuery = paidInvoicesQuery.gte('invoice_date', dateFrom.toISOString().split('T')[0])
    if (dateTo) paidInvoicesQuery = paidInvoicesQuery.lte('invoice_date', dateTo.toISOString().split('T')[0])

    const { data: paidInvoices } = await paidInvoicesQuery

    const totalRevenue = (paidInvoices || []).reduce((sum, inv) => sum + (inv.total_cents || 0), 0)

    // 2. Get paid invoices from this month
    const thisMonthPaid = (paidInvoices || []).filter((inv) => {
      if (!inv.paid_at) return false
      const paidDate = new Date(inv.paid_at)
      return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear
    })
    const revenueThisMonth = thisMonthPaid.reduce((sum, inv) => sum + (inv.total_cents || 0), 0)

    // 3. Get total visits (with optional date range)
    let allVisitsQuery = supabaseAdmin
      .from('visits')
      .select('id, visit_date')
      .eq('practitioner_id', practitionerId)
    if (dateFrom) allVisitsQuery = allVisitsQuery.gte('visit_date', dateFrom.toISOString().split('T')[0])
    if (dateTo) allVisitsQuery = allVisitsQuery.lte('visit_date', dateTo.toISOString().split('T')[0])

    const { data: allVisits } = await allVisitsQuery

    const totalVisits = allVisits?.length || 0

    // 4. Get visits this month
    const visitsThisMonth = (allVisits || []).filter((visit) => {
      const visitDate = new Date(visit.visit_date)
      return visitDate.getMonth() === currentMonth && visitDate.getFullYear() === currentYear
    }).length

    // 5. Get active patients (unique horses with visits in last 90 days)
    const { data: recentVisits } = await supabaseAdmin
      .from('visits')
      .select('horse_id')
      .eq('practitioner_id', practitionerId)
      .gte('visit_date', ninetyDaysAgo.toISOString())

    const activePatients = new Set(recentVisits?.map((v) => v.horse_id) || []).size

    // 6. Get outstanding balance (unpaid invoices)
    const { data: unpaidInvoices } = await supabaseAdmin
      .from('invoices')
      .select('total_cents')
      .eq('practitioner_id', practitionerId)
      .neq('status', 'paid')
      .neq('status', 'cancelled')

    const outstandingBalance = (unpaidInvoices || []).reduce((sum, inv) => sum + (inv.total_cents || 0), 0)

    // 7. Get monthly revenue for last 6 months
    const monthlyRevenue: Array<{ month: string; amount: number }> = []
    const monthMap: Record<string, number> = {}

    ;(paidInvoices || []).forEach((inv) => {
      if (inv.paid_at) {
        const paidDate = new Date(inv.paid_at)
        if (paidDate >= sixMonthsAgo) {
          const monthKey = paidDate.toLocaleString('en-US', { year: 'numeric', month: '2-digit' })
          monthMap[monthKey] = (monthMap[monthKey] || 0) + (inv.total_cents || 0)
        }
      }
    })

    // Generate months and fill in data
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - i)
      const monthKey = d.toLocaleString('en-US', { year: 'numeric', month: '2-digit' })
      const monthName = d.toLocaleString('en-US', { month: 'short' })
      monthlyRevenue.push({
        month: monthName,
        amount: monthMap[monthKey] || 0,
      })
    }

    // 8. Get top services
    const { data: lineItems } = await supabaseAdmin
      .from('invoice_line_items')
      .select('service_id, description, quantity, unit_price_cents, invoice_id')
      .in('invoice_id', (paidInvoices || []).map((inv) => inv.id))

    const serviceMap: Record<string, { name: string; quantity: number; revenue: number }> = {}

    ;(lineItems || []).forEach((item) => {
      const serviceId = item.service_id || `unknown-${item.description}`
      const revenue = (item.quantity || 1) * (item.unit_price_cents || 0)
      if (!serviceMap[serviceId]) {
        serviceMap[serviceId] = {
          name: item.description || 'Unknown Service',
          quantity: 0,
          revenue: 0,
        }
      }
      serviceMap[serviceId].quantity += item.quantity || 1
      serviceMap[serviceId].revenue += revenue
    })

    const topServices = Object.entries(serviceMap)
      .map(([serviceId, data]) => ({
        serviceId,
        serviceName: data.name,
        timesUsed: data.quantity,
        totalRevenue: data.revenue,
      }))
      .sort((a, b) => b.timesUsed - a.timesUsed)
      .slice(0, 10)

    // 9. Get recent activity (last 10)
    const activities: Array<{
      id: string
      date: string
      type: 'invoice' | 'payment' | 'visit'
      description: string
    }> = []

    // Get recent invoices
    const { data: recentInvoices } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, invoice_date, status, paid_at, total_cents, owner:owners(full_name), horse:horses(name)')
      .eq('practitioner_id', practitionerId)
      .order('created_at', { ascending: false })
      .limit(20)

    ;(recentInvoices || []).forEach((inv) => {
      const ownerName = (inv.owner as unknown as Record<string, string> | null)?.full_name || 'Unknown Owner'
      const horseName = (inv.horse as unknown as Record<string, string> | null)?.name || 'Unknown Horse'

      activities.push({
        id: `invoice-${inv.id}`,
        date: inv.invoice_date,
        type: 'invoice',
        description: `Invoice ${inv.invoice_number} for ${ownerName} (${horseName})`,
      })

      if (inv.status === 'paid' && inv.paid_at) {
        activities.push({
          id: `payment-${inv.id}`,
          date: inv.paid_at,
          type: 'payment',
          description: `Payment received: $${((inv.total_cents || 0) / 100).toFixed(2)} from ${ownerName}`,
        })
      }
    })

    // Get recent visits
    const { data: recentVisitsList } = await supabaseAdmin
      .from('visits')
      .select('id, visit_date, horse:horses(name), owner:horses(owners(full_name))')
      .eq('practitioner_id', practitionerId)
      .order('visit_date', { ascending: false })
      .limit(20)

    ;(recentVisitsList || []).forEach((visit) => {
      const horseName = (visit.horse as unknown as Record<string, string> | null)?.name || 'Unknown Horse'
      activities.push({
        id: `visit-${visit.id}`,
        date: visit.visit_date,
        type: 'visit',
        description: `Visit recorded for ${horseName}`,
      })
    })

    // Sort by date and take top 10
    const recentActivity = activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)

    // 10. Get busiest days (visit count by day of week)
    const dayMap = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' }
    const dayVisits: Record<string, number> = {
      Sunday: 0,
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
    }

    ;(allVisits || []).forEach((visit) => {
      const dayOfWeek = new Date(visit.visit_date).getDay()
      const dayName = dayMap[dayOfWeek as keyof typeof dayMap]
      dayVisits[dayName]++
    })

    const busiestDays = Object.entries(dayVisits).map(([day, count]) => ({
      dayOfWeek: day,
      visitCount: count,
    }))

    const reportData: ReportData = {
      totalRevenue,
      revenueThisMonth,
      totalVisits,
      visitsThisMonth,
      activePatients,
      outstandingBalance,
      monthlyRevenue,
      topServices,
      recentActivity,
      busiestDays,
    }

    return NextResponse.json(reportData)
  } catch (error) {
    console.error('Reports error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
