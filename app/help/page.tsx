'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronRight,
  UserPlus,
  PawPrint,
  FileText,
  Pencil,
  DollarSign,
  Calendar,
  Send,
  BarChart3,
  Settings,
  Search,
  CheckCircle,
  HelpCircle,
  Bone,
  Camera,
  ClipboardCheck,
  FileDown,
  CalendarCheck,
  MessageSquare,
  CreditCard,
  Rocket,
} from 'lucide-react'

interface Step {
  title: string
  description: string
  tip?: string
}

interface Guide {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
  steps: Step[]
}

const guides: Guide[] = [
  {
    id: 'add-owner',
    title: 'Add a New Client (Owner)',
    description: 'Register a new pet owner in your system so you can manage their patients and invoices.',
    icon: <UserPlus size={24} />,
    color: 'bg-blue-500',
    steps: [
      {
        title: 'Go to your Dashboard',
        description: 'From the top navigation bar, click "STRIDE" or "Dashboard" to go to your main dashboard.',
      },
      {
        title: 'Click "New Owner"',
        description: 'On the dashboard, look for the "New Owner" button near the top of the page. Click it to open the owner registration form.',
      },
      {
        title: 'Fill in owner details',
        description: 'Enter the client\'s full name, phone number, email address, and physical address. The full name is required — everything else is optional but recommended.',
        tip: 'Adding an email and phone number allows you to send invoices and communications later.',
      },
      {
        title: 'Save the owner',
        description: 'Click "Save" or "Add Owner" to create the new client record. You\'ll be returned to the dashboard where the new owner will appear in your client list.',
      },
    ],
  },
  {
    id: 'add-patient',
    title: 'Add a New Patient',
    description: 'Add a horse, dog, or other animal patient to an existing owner\'s record.',
    icon: <PawPrint size={24} />,
    color: 'bg-green-500',
    steps: [
      {
        title: 'Find the owner on your Dashboard',
        description: 'Scroll through your client list on the dashboard, or use the search bar to find the owner by name.',
      },
      {
        title: 'Open the owner\'s profile',
        description: 'Click on the owner\'s name or card to open their detailed profile page.',
      },
      {
        title: 'Click "Add Patient" or "Add Horse"',
        description: 'On the owner\'s profile, look for the button to add a new patient. Click it to open the patient form.',
      },
      {
        title: 'Enter patient information',
        description: 'Fill in the patient\'s name, species (horse, dog, cat, etc.), breed, age, sex, and any other relevant details like barn location or discipline.',
        tip: 'Selecting the correct species helps the anatomy viewer show the right model for that animal.',
      },
      {
        title: 'Save the patient',
        description: 'Click "Save" to add the patient to the owner\'s record. The new patient will now appear under that owner\'s profile.',
      },
    ],
  },
  {
    id: 'create-invoice',
    title: 'Create an Invoice',
    description: 'Generate a new invoice for services rendered to a client.',
    icon: <FileText size={24} />,
    color: 'bg-purple-500',
    steps: [
      {
        title: 'Go to Invoices',
        description: 'Click "Invoices" in the top navigation bar to open the invoices page.',
      },
      {
        title: 'Click "Create Invoice"',
        description: 'On the invoices page, click the "Create Invoice" button to start the invoice creation wizard.',
      },
      {
        title: 'Step 1 — Select an Owner',
        description: 'Choose the client (owner) this invoice is for from the dropdown list. You can search by name to find them quickly.',
      },
      {
        title: 'Step 2 — Select a Patient',
        description: 'Choose which patient the services were for. The dropdown shows only patients belonging to the selected owner.',
      },
      {
        title: 'Step 3 — Add Line Items',
        description: 'Click on service buttons to add them as line items. Each item shows the description, price, and quantity. You can adjust the price, description, and quantity for each line item directly.',
        tip: 'Prices default to your rates from the Services page, but you can override them on any individual invoice.',
      },
      {
        title: 'Step 4 — Review & Create',
        description: 'Review the invoice summary showing the owner, patient, all line items, and the total. Add optional notes, set a due date, then click "Create Invoice" to finalize it.',
      },
    ],
  },
  {
    id: 'edit-invoice',
    title: 'Edit or Delete an Invoice',
    description: 'Modify invoice details like status, line items, or notes — or delete an invoice entirely.',
    icon: <Pencil size={24} />,
    color: 'bg-amber-500',
    steps: [
      {
        title: 'Go to Invoices',
        description: 'Click "Invoices" in the navigation bar to see your full list of invoices.',
      },
      {
        title: 'Open the invoice',
        description: 'Click the "View" button on the invoice you want to modify. This opens the invoice detail page.',
      },
      {
        title: 'Click "Edit"',
        description: 'On the invoice detail page, click the "Edit" button to enter edit mode. You\'ll see editable fields for status, due date, notes, and all line items.',
      },
      {
        title: 'Make your changes',
        description: 'Update the status (draft, sent, paid, overdue, cancelled), change the due date, modify notes, adjust line item prices/quantities, add new line items, or remove existing ones.',
        tip: 'You can edit invoices in any status, including paid invoices.',
      },
      {
        title: 'Save or cancel',
        description: 'Click "Save" to apply your changes, or "Cancel" to discard them and return to the original invoice.',
      },
      {
        title: 'To delete an invoice',
        description: 'On the invoice detail page, click the "Delete" button. A confirmation modal will appear. For paid invoices, you\'ll see an additional warning. Confirm to permanently delete the invoice.',
      },
    ],
  },
  {
    id: 'manage-services',
    title: 'Manage Services & Rates',
    description: 'Add, edit, or adjust your service offerings and pricing from the Service Menu.',
    icon: <DollarSign size={24} />,
    color: 'bg-emerald-500',
    steps: [
      {
        title: 'Go to Services',
        description: 'Click "Services" in the navigation bar to open the Service Menu page.',
      },
      {
        title: 'Add a new service',
        description: 'Click the "Add Service" button at the top. Fill in the service name, optional description, and price. Click "Add Service" to save.',
        tip: 'Example services: "Chiropractic Adjustment — $150.00", "Follow-up Visit — $75.00"',
      },
      {
        title: 'Edit an existing service',
        description: 'Click the pencil icon on any service card to enter edit mode. Update the name, description, or price, then click "Save".',
      },
      {
        title: 'Toggle active/inactive',
        description: 'Use the checkbox next to each service to toggle it active or inactive. Inactive services won\'t appear when creating invoices.',
      },
      {
        title: 'Reorder services',
        description: 'Use the up/down arrow buttons on the left side of each service card to change the display order.',
      },
      {
        title: 'Delete a service',
        description: 'Click the trash icon on a service, then click "Confirm" to remove it. This soft-deletes the service (marks it inactive).',
      },
    ],
  },
  {
    id: 'schedule-appointment',
    title: 'Schedule an Appointment',
    description: 'Use the Scheduler to book appointments for your clients and patients.',
    icon: <Calendar size={24} />,
    color: 'bg-sky-500',
    steps: [
      {
        title: 'Go to Scheduler',
        description: 'Click "Scheduler" in the navigation bar to open the calendar view.',
      },
      {
        title: 'Choose a date and time',
        description: 'Navigate to the desired date on the calendar. Click on a time slot or use the "New Appointment" button to start creating an appointment.',
      },
      {
        title: 'Select the owner and patient',
        description: 'Choose the client and their patient from the dropdown lists.',
      },
      {
        title: 'Add appointment details',
        description: 'Fill in any notes about the appointment, select the service type, and confirm the date and time.',
      },
      {
        title: 'Save the appointment',
        description: 'Click "Save" or "Create" to add the appointment to your calendar. It will now appear on the scheduler for that date.',
      },
    ],
  },
  {
    id: 'send-communications',
    title: 'Send Messages to Clients',
    description: 'Email or text invoice reminders and other communications to your clients.',
    icon: <Send size={24} />,
    color: 'bg-indigo-500',
    steps: [
      {
        title: 'From the Invoices page',
        description: 'On the invoices list, you\'ll see "Email" and "Text" buttons next to each invoice. Click either to send that invoice to the client.',
      },
      {
        title: 'Email an invoice',
        description: 'Click the "Email" button on an invoice. The system will send a formatted invoice email to the owner\'s email address on file.',
        tip: 'Make sure the owner has an email address saved in their profile before sending.',
      },
      {
        title: 'Text an invoice',
        description: 'Click the "Text" button to send an SMS with the invoice details to the owner\'s phone number.',
        tip: 'The owner must have a phone number saved for texting to work.',
      },
      {
        title: 'View communication history',
        description: 'Click "Messages" in the navigation bar to see all sent communications. You can filter by channel (email, SMS) to find specific messages.',
      },
    ],
  },
  {
    id: 'view-reports',
    title: 'View Reports & Analytics',
    description: 'Track your revenue, appointments, and business performance.',
    icon: <BarChart3 size={24} />,
    color: 'bg-rose-500',
    steps: [
      {
        title: 'Go to Reports',
        description: 'Click "Reports" in the navigation bar to open the reports and analytics page.',
      },
      {
        title: 'View summary cards',
        description: 'At the top of the reports page, you\'ll see summary cards showing key metrics like total revenue, number of invoices, and outstanding balances.',
      },
      {
        title: 'Explore revenue data',
        description: 'Scroll down to see detailed breakdowns of your revenue over time, including charts and graphs showing trends.',
      },
      {
        title: 'Filter by date range',
        description: 'Use the date filters to narrow your reports to specific time periods — this month, last month, quarter, or custom range.',
      },
    ],
  },
  {
    id: 'account-settings',
    title: 'Manage Your Account',
    description: 'Update your profile, billing, and practice information.',
    icon: <Settings size={24} />,
    color: 'bg-slate-500',
    steps: [
      {
        title: 'Go to Account',
        description: 'Click "Account" in the navigation bar to open your account settings.',
      },
      {
        title: 'Update your profile',
        description: 'Edit your practice name, contact information, and other profile details.',
      },
      {
        title: 'Manage billing',
        description: 'View your subscription status, update payment methods, or change your plan from the billing section.',
      },
    ],
  },
  {
    id: 'anatomy-viewer',
    title: 'Use the Anatomy Viewer',
    description: 'Explore interactive 3D anatomy models, annotate findings, and save notes to specific body regions.',
    icon: <Bone size={24} />,
    color: 'bg-violet-500',
    steps: [
      {
        title: 'Open a patient record',
        description: 'From the dashboard, click on a patient to open their profile. Then click the "Anatomy" or "3D Viewer" button to launch the anatomy viewer.',
      },
      {
        title: 'Choose the anatomy model',
        description: 'The viewer automatically loads the correct model based on the patient\'s species (equine or canine).',
      },
      {
        title: 'Toggle anatomy layers',
        description: 'Use the layer controls to show or hide different systems — skeleton, muscles, organs, and more. This helps you focus on the area you\'re examining.',
      },
      {
        title: 'Rotate and zoom',
        description: 'Click and drag to rotate the model. Use preset viewing angles (front, rear, left, right, top) for quick repositioning, or zoom in on specific areas.',
      },
      {
        title: 'Draw and annotate',
        description: 'Use the drawing tools to mark findings directly on the anatomy overlay. Choose pen, circles, arrows, or text. Select your color and brush size.',
        tip: 'Annotations are great for documenting subluxations, areas of tension, or treatment plans visually.',
      },
      {
        title: 'Save region notes',
        description: 'Click on a specific spine segment or joint to open a note panel. Type your findings and save — these notes are tied to that exact body region and visit.',
      },
      {
        title: 'Capture a photo',
        description: 'Use the photo capture button to save an annotated screenshot of the current view. This gets stored in the patient\'s photo gallery.',
      },
    ],
  },
  {
    id: 'patient-records',
    title: 'Manage Patient Records & Photos',
    description: 'Upload documents, take visit photos, track spine assessments, and view treatment history.',
    icon: <Camera size={24} />,
    color: 'bg-teal-500',
    steps: [
      {
        title: 'Open a patient profile',
        description: 'From the dashboard, click on an owner, then click on the patient you want to manage.',
      },
      {
        title: 'View patient tabs',
        description: 'The patient profile has multiple tabs: Info, Visits, Photos, and Records. Click each tab to switch between sections.',
      },
      {
        title: 'Edit patient info',
        description: 'On the Info tab, click "Edit" to update the patient\'s name, breed, age, sex, species, barn location, or any other details.',
      },
      {
        title: 'Upload documents',
        description: 'On the Records tab, click "Upload" to add files like PDFs, X-rays, lab results, or other documents. Add a note to describe what each file is.',
        tip: 'Accepted file types include PDFs, images (JPG, PNG), and common document formats.',
      },
      {
        title: 'View visit history',
        description: 'On the Visits tab, see a timeline of all visits for this patient including dates, findings, and any spine assessments recorded.',
      },
      {
        title: 'Browse photos',
        description: 'On the Photos tab, view all photos taken during visits. These include anatomy viewer captures and any manually uploaded images.',
      },
      {
        title: 'Track spine assessments',
        description: 'If spine assessments have been recorded, you can see the history of findings per segment over time — showing left and right side results for each visit.',
      },
    ],
  },
  {
    id: 'consent-intake',
    title: 'Send Consent & Intake Forms',
    description: 'Collect digital signatures and patient intake information from owners before their first visit.',
    icon: <ClipboardCheck size={24} />,
    color: 'bg-orange-500',
    steps: [
      {
        title: 'Navigate to the owner profile',
        description: 'From the dashboard, find and click on the owner you need forms from.',
      },
      {
        title: 'Send a consent form',
        description: 'Look for the "Consent Form" or "Send Consent" option on the owner\'s profile. This generates a unique link the owner can use to review and sign.',
      },
      {
        title: 'What the owner sees',
        description: 'The owner receives a branded form with your practice logo and name. They review agreements covering scope of care, risk acknowledgment, health records authorization, photography consent, payment responsibility, and SMS opt-in.',
        tip: 'The form is mobile-friendly — owners can sign right from their phone.',
      },
      {
        title: 'Owner signs digitally',
        description: 'The owner draws their signature on screen and submits the form. The date and time are recorded automatically.',
      },
      {
        title: 'Send an intake form',
        description: 'Similarly, send an intake form link to the owner. This collects detailed information about each animal — species, breed, age, health history, medications, reason for care, and more.',
      },
      {
        title: 'Review submitted forms',
        description: 'Once submitted, the intake information populates the patient\'s records. You can review all submitted forms from the owner\'s profile.',
      },
    ],
  },
  {
    id: 'record-visit',
    title: 'Record a Visit',
    description: 'Document a patient visit with findings, spine assessments, photos, and treatment notes.',
    icon: <PawPrint size={24} />,
    color: 'bg-cyan-500',
    steps: [
      {
        title: 'Open the patient profile',
        description: 'Navigate to the patient you\'re treating by clicking on them from the dashboard or the owner\'s profile.',
      },
      {
        title: 'Start a new visit',
        description: 'Click "New Visit" or "Add Visit" to begin documenting. This creates a new visit record tied to today\'s date.',
      },
      {
        title: 'Record your findings',
        description: 'Enter your clinical observations, findings, and notes for this visit. Be as detailed as needed.',
      },
      {
        title: 'Perform a spine assessment',
        description: 'If applicable, use the spine assessment tool to mark findings on individual vertebrae segments. Record left and right side findings for each segment.',
        tip: 'Spine assessments build a history over time, making it easy to track progress across visits.',
      },
      {
        title: 'Take photos',
        description: 'Capture photos during the visit using the camera tool or anatomy viewer. These are automatically linked to this visit.',
      },
      {
        title: 'Save the visit',
        description: 'Click "Save" to finalize the visit record. It will appear in the patient\'s visit history timeline.',
      },
    ],
  },
  {
    id: 'invoice-pdf',
    title: 'Download an Invoice as PDF',
    description: 'Generate and download a PDF copy of any invoice to share or print.',
    icon: <FileDown size={24} />,
    color: 'bg-pink-500',
    steps: [
      {
        title: 'Go to Invoices',
        description: 'Click "Invoices" in the navigation bar to see your invoice list.',
      },
      {
        title: 'Find the invoice',
        description: 'Scroll through the list or use filters to find the invoice you want to download.',
      },
      {
        title: 'Click the PDF button',
        description: 'On the invoice row, click the "PDF" button. This generates a formatted PDF of the invoice with all line items, totals, and your practice details.',
      },
      {
        title: 'Save or print',
        description: 'The PDF will download to your device. From there you can print it, attach it to an email, or save it for your records.',
        tip: 'PDFs include your practice logo if you\'ve uploaded one in Account settings.',
      },
    ],
  },
  {
    id: 'calendar-export',
    title: 'Export Appointments to Your Calendar',
    description: 'Add appointments to Apple Calendar, Google Calendar, or other calendar apps.',
    icon: <CalendarCheck size={24} />,
    color: 'bg-lime-500',
    steps: [
      {
        title: 'Go to Scheduler',
        description: 'Click "Scheduler" in the navigation bar to open your appointment calendar.',
      },
      {
        title: 'Find the appointment',
        description: 'Navigate to the date and click on the appointment you want to export.',
      },
      {
        title: 'Click the export/calendar button',
        description: 'Look for the calendar export option on the appointment detail. This generates an ICS file.',
      },
      {
        title: 'Open with your calendar app',
        description: 'The ICS file automatically opens in your default calendar app (Apple Calendar, Google Calendar, Outlook, etc.) and adds the appointment with all the details.',
        tip: 'You can also send appointment confirmations to owners, which include a link they can use to add it to their own calendar.',
      },
    ],
  },
  {
    id: 'communications-log',
    title: 'View Your Communications Log',
    description: 'Track all emails and text messages sent to clients, with delivery status and filters.',
    icon: <MessageSquare size={24} />,
    color: 'bg-fuchsia-500',
    steps: [
      {
        title: 'Go to Messages',
        description: 'Click "Messages" in the navigation bar to open the communications log.',
      },
      {
        title: 'Browse all communications',
        description: 'The page shows a chronological list of every email and SMS sent through the system, including invoice notifications, appointment reminders, and manual messages.',
      },
      {
        title: 'Filter by channel',
        description: 'Use the channel filter buttons to show only emails, only SMS messages, or both.',
      },
      {
        title: 'Filter by owner',
        description: 'Use the owner filter to see all communications sent to a specific client.',
      },
      {
        title: 'Check delivery status',
        description: 'Each message shows its delivery status — sent, delivered, failed, or bounced. This helps you identify if a client didn\'t receive a message.',
        tip: 'If a message shows "failed" or "bounced," double-check the owner\'s email address or phone number in their profile.',
      },
    ],
  },
  {
    id: 'billing-subscription',
    title: 'Manage Your Subscription',
    description: 'View your plan, start or renew your subscription, and manage payment details.',
    icon: <CreditCard size={24} />,
    color: 'bg-yellow-500',
    steps: [
      {
        title: 'Go to Account, then Billing',
        description: 'Click "More" in the nav bar, then "Account." From your account page, navigate to the billing section.',
      },
      {
        title: 'View your current plan',
        description: 'See your subscription status (active, trialing, past due, or cancelled), what plan you\'re on, and when your next billing date is.',
      },
      {
        title: 'Choose a plan',
        description: 'If you\'re on a free trial or need to subscribe, choose between the Monthly plan ($49/month) or the Annual plan ($499/year — save 15%).',
        tip: 'The annual plan saves you about $89 per year compared to monthly billing.',
      },
      {
        title: 'Enter payment details',
        description: 'Click "Subscribe" on your chosen plan. You\'ll be directed to a secure Stripe checkout to enter your payment information.',
      },
      {
        title: 'Confirmation',
        description: 'After successful payment, you\'ll see a confirmation and your subscription status will update to "Active." All features are now fully unlocked.',
      },
    ],
  },
  {
    id: 'onboarding-setup',
    title: 'First-Time Setup (Onboarding)',
    description: 'Set up your practice when you first sign up — name, details, and logo.',
    icon: <Rocket size={24} />,
    color: 'bg-gradient-to-r from-blue-500 to-purple-500',
    steps: [
      {
        title: 'Create your account',
        description: 'Sign up at the Stride website with your email and password. You\'ll be directed to the onboarding wizard automatically.',
      },
      {
        title: 'Step 1 — Your name',
        description: 'Enter your full name as the practitioner. This is how you\'ll be identified in the system.',
      },
      {
        title: 'Step 2 — Practice details',
        description: 'Enter your practice name, select which animals you treat (horses, dogs, or both), and add your practice location.',
      },
      {
        title: 'Step 3 — Upload your logo',
        description: 'Upload your practice logo (PNG, JPG, or SVG). This will appear on invoices, consent forms, intake forms, and emails sent to clients.',
        tip: 'You can skip the logo for now and add it later from your Account settings.',
      },
      {
        title: 'Start using Stride',
        description: 'After completing the wizard, you\'ll land on your dashboard. From there, add your first client and patient to get started!',
      },
    ],
  },
]

function StepCard({ step, stepNumber, isLast }: { step: Step; stepNumber: number; isLast: boolean }) {
  return (
    <div className="flex gap-4">
      {/* Step number + connector line */}
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
          {stepNumber}
        </div>
        {!isLast && <div className="mt-1 w-0.5 flex-1 bg-slate-200" />}
      </div>

      {/* Step content */}
      <div className={`flex-1 ${!isLast ? 'pb-6' : 'pb-2'}`}>
        <h4 className="font-semibold text-slate-900">{step.title}</h4>
        <p className="mt-1 text-sm text-slate-600 leading-relaxed">{step.description}</p>
        {step.tip && (
          <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Tip:</span> {step.tip}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function GuideCard({ guide }: { guide: Guide }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="rounded-3xl bg-white shadow-sm border border-slate-200 overflow-hidden transition-all">
      {/* Header — always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50 transition-colors"
      >
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-white ${guide.color}`}>
          {guide.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900">{guide.title}</h3>
          <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{guide.description}</p>
        </div>
        <div className="flex-shrink-0 text-slate-400">
          {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="border-t border-slate-100 px-5 py-5">
          <p className="text-sm text-slate-600 mb-5">{guide.description}</p>
          <div>
            {guide.steps.map((step, i) => (
              <StepCard
                key={i}
                step={step}
                stepNumber={i + 1}
                isLast={i === guide.steps.length - 1}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
            <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800 font-medium">You&apos;re all set! That&apos;s all there is to it.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredGuides = guides.filter(
    (guide) =>
      guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guide.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guide.steps.some(
        (step) =>
          step.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          step.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
  )

  const categories = [
    {
      label: 'Getting Started',
      ids: ['onboarding-setup', 'add-owner', 'add-patient'],
    },
    {
      label: 'Patient Care',
      ids: ['record-visit', 'anatomy-viewer', 'patient-records', 'consent-intake'],
    },
    {
      label: 'Invoicing & Billing',
      ids: ['create-invoice', 'edit-invoice', 'invoice-pdf', 'manage-services'],
    },
    {
      label: 'Scheduling & Communication',
      ids: ['schedule-appointment', 'calendar-export', 'send-communications', 'communications-log'],
    },
    {
      label: 'Insights & Settings',
      ids: ['view-reports', 'account-settings', 'billing-subscription'],
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-900 text-white mb-4">
            <HelpCircle size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">How-To Guides</h1>
          <p className="text-slate-600 mt-2 max-w-lg mx-auto">
            Step-by-step instructions for everything you can do in Stride. Click any guide to expand it.
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guides... (e.g. invoice, patient, services)"
              className="w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-slate-900 shadow-sm"
            />
          </div>
        </div>

        {/* Quick links */}
        {!searchQuery && (
          <div className="mb-8 flex flex-wrap gap-2 justify-center">
            {guides.map((guide) => (
              <button
                key={guide.id}
                onClick={() => {
                  const el = document.getElementById(`guide-${guide.id}`)
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-sm"
              >
                {guide.title}
              </button>
            ))}
          </div>
        )}

        {/* Guides grouped by category */}
        {searchQuery ? (
          <div className="space-y-3">
            {filteredGuides.length === 0 ? (
              <div className="rounded-3xl bg-white p-12 shadow-sm text-center">
                <Search size={32} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600">No guides found for &quot;{searchQuery}&quot;</p>
                <p className="text-sm text-slate-400 mt-1">Try different keywords</p>
              </div>
            ) : (
              filteredGuides.map((guide) => (
                <div key={guide.id} id={`guide-${guide.id}`}>
                  <GuideCard guide={guide} />
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map((cat) => {
              const catGuides = guides.filter((g) => cat.ids.includes(g.id))
              return (
                <div key={cat.label}>
                  <h2 className="text-lg font-bold text-slate-900 mb-3 px-1">{cat.label}</h2>
                  <div className="space-y-3">
                    {catGuides.map((guide) => (
                      <div key={guide.id} id={`guide-${guide.id}`}>
                        <GuideCard guide={guide} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 rounded-3xl bg-slate-900 p-6 text-center">
          <h3 className="text-lg font-semibold text-white">Still need help?</h3>
          <p className="text-slate-300 mt-1 text-sm">
            Reach out to us and we&apos;ll get back to you as soon as possible.
          </p>
          <Link
            href="/contact"
            className="mt-4 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  )
}
