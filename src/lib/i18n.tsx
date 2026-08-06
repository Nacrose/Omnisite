'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { usePersistentState } from '@/lib/use-persistent-state'

export type Locale = 'en' | 'np'
export type CalendarSystem = 'BS' | 'AD'

interface I18nContextValue {
  locale: Locale
  calendar: CalendarSystem
  setLocale: (l: Locale) => void
  setCalendar: (c: CalendarSystem) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  calendar: 'AD',
  setLocale: () => {},
  setCalendar: () => {},
  t: (key: string) => key,
})

// Translation dictionary — English + Nepali
export const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Common
    'app.name': 'OmniSite',
    'app.tagline': 'Construction Cloud',
    'button.search': 'Search…',
    'button.quickAdd': 'Quick Add',
    'button.export': 'Export',
    'button.save': 'Save',
    'button.cancel': 'Cancel',
    'button.add': 'Add',
    'button.delete': 'Delete',
    'button.edit': 'Edit',
    // Modules
    'module.dashboard': 'Global Dashboard',
    'module.boq': 'BOQ & Rate Analysis',
    'module.scheduler': 'Scheduler',
    'module.dailyOps': 'Daily Operations',
    'module.equipment': 'Equipment & Fleet',
    'module.procurement': 'Procurement & Inventory',
    'module.financials': 'Financials & Commercial',
    'module.vendors': 'Vendors',
    'module.drawings': 'Drawings & Documents',
    'module.correspondence': 'Correspondence',
    'module.qs': 'Quality & Safety',
    'module.reports': 'Report & PDF Designer',
    'module.timeAttendance': 'Time & Attendance',
    'module.admin': 'Admin & Master Data',
    'module.chat': 'Messages',
    // Dashboard
    'dashboard.title': 'Project Command Center',
    'dashboard.subtitle':
      'Kathmandu Ring Road Expansion · Package 3 · FIDIC Red Book · DoR Norms 2075',
    'dashboard.kpi.spi': 'Schedule Performance',
    'dashboard.kpi.cpi': 'Cost Performance',
    'dashboard.kpi.eac': 'Estimate at Completion',
    'dashboard.kpi.margin': 'Project gross margin',
    // Status
    'status.saved': 'Saved',
    'status.syncing': 'Syncing…',
    'status.connected': 'Cloud sync active',
    'status.local': 'Local mode',
    'status.collaborators': 'collaborators',
    'status.reset': 'Reset',
    'status.resetTitle': 'Reset all data to defaults?',
    'status.resetConfirm':
      'Reset all data to defaults? This will clear all your edits to BOQ, Schedule, and Financials.',
    'status.resetSuccess': 'Data reset to defaults',
    'status.resetSuccessDesc': 'Page reloading…',
    // Calendar
    'calendar.fiscalYear': 'FY',
    'calendar.bs': 'BS',
    'calendar.ad': 'AD',
    // BOQ
    'boq.title': 'BOQ Grid',
    'boq.contractTotal': 'Contract Total',
    'boq.qty': 'Qty',
    'boq.rate': 'Rate',
    'boq.amount': 'Amount',
    'boq.type': 'Type',
    'boq.uom': 'UOM',
    // Scheduler
    'scheduler.gantt': 'Gantt Canvas',
    'scheduler.criticalPath': 'Critical path',
    'scheduler.projectFinish': 'Project finish',
    'scheduler.dragToMove': 'Drag bars to move',
    'scheduler.dragToResize': 'drag edges to resize',
    // Chat
    'chat.channels': 'Channels',
    'chat.team': 'Team',
    'chat.typeMessage': 'Message',
    'chat.sendMessage': 'Send',
    'chat.pressEnter': 'Press Enter to send · Shift+Enter for new line',
    // Financials
    'financials.title': 'Financials & Commercial',
    'financials.budget': 'Budgeted (Contract)',
    'financials.committed': 'Committed (POs)',
    'financials.actual': 'Actual (DSR+Exp)',
    'financials.forecast': 'Forecast (EAC)',
    'financials.margin': 'Margin %',
    'financials.exportCsv': 'Export CSV',
    'financials.uploadRaBill': 'Upload RA Bill',
    // Procurement
    'procurement.title': 'Procurement & Inventory',
    'procurement.requisitions': 'Requisitions',
    'procurement.purchaseOrders': 'Purchase Orders',
    'procurement.grn': 'GRN / 3-Way Match',
    'procurement.stock': 'Live Stock',
    'procurement.min': 'Material Issue Notes',
    'procurement.vendor': 'Vendor',
    'procurement.rate': 'Rate',
    'procurement.qty': 'Qty',
    'procurement.status': 'Status',
    'procurement.committed': 'Committed cost',
    'procurement.stockValue': 'Stock value',
    // Daily Ops
    'dailyOps.title': 'Daily Operations',
    'dailyOps.dsr': 'Daily Site Report',
    'dailyOps.rfi': 'RFI Register',
    'dailyOps.date': 'Date',
    'dailyOps.task': 'Task',
    'dailyOps.chainage': 'Chainage',
    'dailyOps.planned': 'Planned',
    'dailyOps.actual': 'Actual',
    'dailyOps.variance': 'Variance',
    // Q&S
    'qs.title': 'Quality & Safety',
    'qs.ncr': 'NCR Register',
    'qs.itr': 'Inspection & Test Requests',
    'qs.punch': 'Punch List',
    'qs.incident': 'Incidents',
    'qs.overdue': 'overdue',
    // Equipment
    'equipment.title': 'Equipment & Fleet',
    'equipment.status': 'Status',
    'equipment.operator': 'Operator',
    'equipment.chargeRate': 'Charge Rate',
    'equipment.fuelToday': 'Fuel Today',
    'equipment.hoursToday': 'Hours Today',
    // Drawings
    'drawings.title': 'Drawings & Documents',
    'drawings.number': 'Drawing No.',
    'drawings.revision': 'Revision',
    'drawings.discipline': 'Discipline',
    'drawings.status': 'Status',
    // Correspondence
    'correspondence.title': 'Correspondence',
    'correspondence.from': 'From',
    'correspondence.to': 'To',
    'correspondence.subject': 'Subject',
    'correspondence.date': 'Date',
    'correspondence.replyBy': 'Reply By',
    // Time & Attendance
    'timeAttendance.title': 'Time & Attendance',
    'timeAttendance.clockIn': 'Clock In',
    'timeAttendance.clockOut': 'Clock Out',
    'timeAttendance.todayHours': 'Today Hours',
    'timeAttendance.wageRate': 'Wage Rate',
    'timeAttendance.labourCost': 'Labour Cost',
    // Admin
    'admin.title': 'Admin & Master Data',
    'admin.users': 'Users',
    'admin.roles': 'Roles',
    'admin.projects': 'Projects',
    'admin.materials': 'Materials Library',
    // Reports
    'reports.title': 'Report & PDF Designer',
    'reports.preview': 'Preview',
    'reports.save': 'Save',
    'reports.export': 'Export PDF',
    // Common status
    'common.open': 'Open',
    'common.closed': 'Closed',
    'common.pending': 'Pending',
    'common.approved': 'Approved',
    'common.rejected': 'Rejected',
    'common.draft': 'Draft',
    'common.active': 'Active',
    'common.idle': 'Idle',
    'common.breakdown': 'Breakdown',
    'common.delivered': 'Delivered',
    'common.partial': 'Partial',
    'common.cleared': 'Cleared',
    'common.hold': 'Hold',
    'common.overdue': 'Overdue',
    'common.onSite': 'On-site',
    'common.offSite': 'Off-site',
    // Auth / Onboarding (pass-2: i18n)
    'auth.signIn': 'Sign in',
    'auth.signingIn': 'Signing in…',
    'auth.forgotPassword': 'Forgot your password?',
    'auth.resetPassword': 'Reset password',
    'auth.sendResetLink': 'Send reset link',
    'auth.sendingReset': 'Sending reset link…',
    'auth.resetSent': 'Check your email',
    'auth.resetSentDesc': 'If the email exists, a reset link is on its way.',
    'auth.demoMode': 'Demo mode — Supabase not configured',
    'auth.demoModeDesc':
      'Enter any email and password to sign in as the demo user (Demo User, PM role). All data stays in your browser. Password reset is unavailable in demo mode.',
    'auth.firstTimeHere': 'First time here? Ask your PM to invite you from Admin → Users.',
    // Onboarding wizard
    'onboarding.welcome': 'Welcome to OmniSite',
    'onboarding.welcomeDesc': "Let's get you set up in 3 quick steps.",
    'onboarding.profile': 'Confirm your profile',
    'onboarding.profileDesc': "We'll use this name across the app.",
    'onboarding.project': 'Create your first project',
    'onboarding.projectDesc': "You'll be auto-assigned as Project Manager.",
    'onboarding.assigning': 'Setting up…',
    'onboarding.assigningDesc': 'Creating the project and assigning you as PM…',
    'onboarding.done': "You're all set",
    'onboarding.doneDesc': 'Project created — redirecting to your dashboard.',
    'onboarding.getStarted': 'Get started',
    'onboarding.continue': 'Continue',
    'onboarding.back': 'Back',
    'onboarding.createAndAssign': 'Create & assign me as PM',
    'onboarding.displayName': 'Display name',
    'onboarding.projectName': 'Project Name',
    'onboarding.projectCode': 'Project Code',
    'onboarding.location': 'Location',
    'onboarding.startDate': 'Start Date',
    // Notifications bell
    'notifications.title': 'Notifications',
    'notifications.markAllRead': 'Mark all read',
    'notifications.loading': 'Loading…',
    'notifications.empty': 'No notifications',
    'notifications.scannedDaily':
      'Notifications are scanned daily by cron. Critical alerts email the PM.',
    // Time & Attendance
    'tna.logAttendance': 'Log Attendance',
    'tna.logUpdate': 'Log / Update',
    'tna.attendanceHistory': 'Attendance History',
    'tna.payrollSummary': 'Payroll Summary (last 30 days)',
    'tna.daysLogged': 'Days logged',
    'tna.totalHours': 'Total hours',
    'tna.totalPay': 'Total pay (30 days)',
  },
  np: {
    // Common
    'app.name': 'ओम्निसाइट',
    'app.tagline': 'निर्माण क्लाउड',
    'button.search': 'खोज्नुहोस्…',
    'button.quickAdd': 'छिटो थप्नुहोस्',
    'button.export': 'निर्यात',
    'button.save': 'सुरक्षित गर्नुहोस्',
    'button.cancel': 'रद्द गर्नुहोस्',
    'button.add': 'थप्नुहोस्',
    'button.delete': 'मेटाउनुहोस्',
    'button.edit': 'सम्पादन',
    // Modules
    'module.dashboard': 'ग्लोबल ड्यासबोर्ड',
    'module.boq': 'बीओक्यू दर विश्लेषण',
    'module.scheduler': 'अनुसूची',
    'module.dailyOps': 'दैनिक सञ्चालन',
    'module.equipment': 'उपकरण',
    'module.procurement': 'खरिद र स्टक',
    'module.financials': 'वित्तीय',
    'module.vendors': 'विक्रेता',
    'module.drawings': 'चित्र र कागजात',
    'module.correspondence': 'पत्राचार',
    'module.qs': 'गुणस्तर र सुरक्षा',
    'module.reports': 'रिपोर्ट डिजाइनर',
    'module.timeAttendance': 'समय उपस्थिति',
    'module.admin': 'व्यवस्थापन',
    'module.chat': 'सन्देश',
    // Dashboard
    'dashboard.title': 'परियोजना आज्ञाकेन्द्र',
    'dashboard.subtitle': 'काठमाडौं रिङ रोड विस्तार · प्याकेज ३ · फिडिक रेड बुक · डिओआर मानक २०७५',
    'dashboard.kpi.spi': 'अनुसूची प्रदर्शन',
    'dashboard.kpi.cpi': 'लागत प्रदर्शन',
    'dashboard.kpi.eac': 'पूर्वअनुमान लागत',
    'dashboard.kpi.margin': 'परियोजना सकग नाफा',
    // Status
    'status.saved': 'सुरक्षित',
    'status.syncing': 'समिकरण…',
    'status.connected': 'क्लाउड सिंक सक्रिय',
    'status.local': 'स्थानीय मोड',
    'status.collaborators': 'सहयोगीहरू',
    'status.reset': 'रिसेट',
    'status.resetTitle': 'सबै डाटा डिफल्टमा फर्काउने?',
    'status.resetConfirm':
      'सबै डाटा डिफल्टमा फर्काउने? यसले BOQ, अनुसूची र वित्तीयमा गरेका सम्पादनहरू मेटाउँछ।',
    'status.resetSuccess': 'डाटा डिफल्टमा फर्काइयो',
    'status.resetSuccessDesc': 'पृष्ठ पुनः लोड हुँदै…',
    // Calendar
    'calendar.fiscalYear': 'वित्तीय वर्ष',
    'calendar.bs': 'बि सं',
    'calendar.ad': 'ई सं',
    // BOQ
    'boq.title': 'बीओक्यू ग्रिड',
    'boq.contractTotal': 'करार कुल',
    'boq.qty': 'परिमाण',
    'boq.rate': 'दर',
    'boq.amount': 'रकम',
    'boq.type': 'प्रकार',
    'boq.uom': 'एकाइ',
    // Scheduler
    'scheduler.gantt': 'ग्यान्ट क्यानभास',
    'scheduler.criticalPath': 'महत्वपूर्ण बाटो',
    'scheduler.projectFinish': 'परियोजना समाप्ति',
    'scheduler.dragToMove': 'बार सार्नुहोस्',
    'scheduler.dragToResize': 'किनारा तान्नुहोस्',
    // Chat
    'chat.channels': 'च्यानलहरू',
    'chat.team': 'टोली',
    'chat.typeMessage': 'सन्देश',
    'chat.sendMessage': 'पठाउनुहोस्',
    'chat.pressEnter': 'Enter थिच्नुहोस् · नयाँ लाइनको लागि Shift+Enter',
    // Financials
    'financials.title': 'वित्तीय र व्यावसायिक',
    'financials.budget': 'बजेट (करार)',
    'financials.committed': 'प्रतिबद्ध (PO)',
    'financials.actual': 'वास्तविक (DSR+Exp)',
    'financials.forecast': 'पूर्वानुमान (EAC)',
    'financials.margin': 'नाफा %',
    'financials.exportCsv': 'CSV निर्यात',
    'financials.uploadRaBill': 'RA बिल अपलोड',
    // Procurement
    'procurement.title': 'खरिद र स्टक',
    'procurement.requisitions': 'मागहरू',
    'procurement.purchaseOrders': 'खरिद आदेश',
    'procurement.grn': 'GRN / ३-तरिका मिलान',
    'procurement.stock': 'जीवन्त स्टक',
    'procurement.min': 'सामग्री जारी नोट',
    'procurement.vendor': 'आपूर्तिकर्ता',
    'procurement.rate': 'दर',
    'procurement.qty': 'परिमाण',
    'procurement.status': 'स्थिति',
    'procurement.committed': 'प्रतिबद्ध लागत',
    'procurement.stockValue': 'स्टक मूल्य',
    // Daily Ops
    'dailyOps.title': 'दैनिक सञ्चालन',
    'dailyOps.dsr': 'दैनिक साइट रिपोर्ट',
    'dailyOps.rfi': 'RFI रेजिस्टर',
    'dailyOps.date': 'मिति',
    'dailyOps.task': 'कार्य',
    'dailyOps.chainage': 'चेनेज',
    'dailyOps.planned': 'योजना',
    'dailyOps.actual': 'वास्तविक',
    'dailyOps.variance': 'भिन्नता',
    // Q&S
    'qs.title': 'गुणस्तर र सुरक्षा',
    'qs.ncr': 'NCR रेजिस्टर',
    'qs.itr': 'निरीक्षण र परीक्षण अनुरोध',
    'qs.punch': 'पञ्च सूची',
    'qs.incident': 'घटनाहरू',
    'qs.overdue': 'म्याद नाघेको',
    // Equipment
    'equipment.title': 'उपकरण र बाहन',
    'equipment.status': 'स्थिति',
    'equipment.operator': 'सञ्चालक',
    'equipment.chargeRate': 'शुल्क दर',
    'equipment.fuelToday': 'आजको इन्धन',
    'equipment.hoursToday': 'आजको घण्टा',
    // Drawings
    'drawings.title': 'चित्र र कागजात',
    'drawings.number': 'चित्र नं.',
    'drawings.revision': 'संशोधन',
    'drawings.discipline': 'अनुशासन',
    'drawings.status': 'स्थिति',
    // Correspondence
    'correspondence.title': 'पत्राचार',
    'correspondence.from': 'बाट',
    'correspondence.to': 'लाई',
    'correspondence.subject': 'विषय',
    'correspondence.date': 'मिति',
    'correspondence.replyBy': 'जवाफ दिने',
    // Time & Attendance
    'timeAttendance.title': 'समय उपस्थिति',
    'timeAttendance.clockIn': 'आगमन टिपोट',
    'timeAttendance.clockOut': 'प्रस्थान टिपोट',
    'timeAttendance.todayHours': 'आजको घण्टा',
    'timeAttendance.wageRate': 'ज्याला दर',
    'timeAttendance.labourCost': 'श्रम लागत',
    // Admin
    'admin.title': 'व्यवस्थापन र मास्टर डाटा',
    'admin.users': 'प्रयोगकर्ता',
    'admin.roles': 'भूमिका',
    'admin.projects': 'परियोजना',
    'admin.materials': 'सामग्री पुस्तकालय',
    // Reports
    'reports.title': 'रिपोर्ट र PDF डिजाइनर',
    'reports.preview': 'पूर्वावलोकन',
    'reports.save': 'सुरक्षित',
    'reports.export': 'PDF निर्यात',
    // Common status
    'common.open': 'खुला',
    'common.closed': 'बन्द',
    'common.pending': 'पेन्डिङ',
    'common.approved': 'स्वीकृत',
    'common.rejected': 'अस्वीकृत',
    'common.draft': 'ड्राफ्ट',
    'common.active': 'सक्रिय',
    'common.idle': 'निष्क्रिय',
    'common.breakdown': 'बिग्रिएको',
    'common.delivered': 'डेलिभर भएको',
    'common.partial': 'आंशिक',
    'common.cleared': 'क्लियर',
    'common.hold': 'होल्ड',
    'common.overdue': 'म्याद नाघेको',
    'common.onSite': 'साइटमा',
    'common.offSite': 'साइट बाहिर',
    // Auth / Onboarding (pass-2: i18n)
    'auth.signIn': 'साइन इन',
    'auth.signingIn': 'साइन इन हुँदै…',
    'auth.forgotPassword': 'पासवर्ड बिर्सनुभयो?',
    'auth.resetPassword': 'पासवर्ड रिसेट',
    'auth.sendResetLink': 'रिसेट लिङ्क पठाउनुहोस्',
    'auth.sendingReset': 'रिसेट लिङ्क पठाउँदै…',
    'auth.resetSent': 'आफ्नो इमेल हेर्नुहोस्',
    'auth.resetSentDesc': 'इमेल अवस्थित भएमा, रिसेट लिङ्क पठाइनेछ।',
    'auth.demoMode': 'डेमो मोड — Supabase कन्फिगर गरिएको छैन',
    'auth.demoModeDesc':
      'डेमो प्रयोगकर्ता (PM भूमिका) को रूपमा साइन इन गर्न कुनै पनि इमेल/पासवर्ड प्रविष्ट गर्नुहोस्। सबै डाटा तपाईंको ब्राउजरमा रहन्छ।',
    'auth.firstTimeHere':
      'पहिलो पटक? आफ्नो PM लाई Admin → Users बाट निमन्त्रणा गर्न अनुरोध गर्नुहोस्।',
    // Onboarding wizard
    'onboarding.welcome': 'ओम्निसाइटमा स्वागत छ',
    'onboarding.welcomeDesc': '३ चरणमा सेट अप गरौँ।',
    'onboarding.profile': 'प्रोफाइल पुष्टि गर्नुहोस्',
    'onboarding.profileDesc': 'यो नाम एपमा प्रयोग गरिनेछ।',
    'onboarding.project': 'पहिलो परियोजना सिर्जना गर्नुहोस्',
    'onboarding.projectDesc': 'तपाईंलाई परियोजना प्रबन्धकको रूपमा स्वतः असाइन गरिनेछ।',
    'onboarding.assigning': 'सेट अप हुँदै…',
    'onboarding.assigningDesc': 'परियोजना सिर्जना गर्दै र तपाईंलाई PM को रूपमा असाइन गर्दै…',
    'onboarding.done': 'सबै तयार छ',
    'onboarding.doneDesc': 'परियोजना सिर्जना भयो — ड्यासबोर्डमा रिडाइरेक्ट हुँदै।',
    'onboarding.getStarted': 'सुरु गर्नुहोस्',
    'onboarding.continue': 'अगाडि बढ्नुहोस्',
    'onboarding.back': 'पछाडि',
    'onboarding.createAndAssign': 'सिर्जना गर्नुहोस् र PM को रूपमा असाइन गर्नुहोस्',
    'onboarding.displayName': 'प्रदर्शन नाम',
    'onboarding.projectName': 'परियोजनाको नाम',
    'onboarding.projectCode': 'परियोजना कोड',
    'onboarding.location': 'स्थान',
    'onboarding.startDate': 'सुरु मिति',
    // Notifications bell
    'notifications.title': 'सूचनाहरू',
    'notifications.markAllRead': 'सबै पढिएको चिन्हित गर्नुहोस्',
    'notifications.loading': 'लोड हुँदै…',
    'notifications.empty': 'कुनै सूचना छैन',
    'notifications.scannedDaily':
      'सूचनाहरू दैनिक क्रोन द्वारा स्क्यान गरिन्छ। महत्त्वपूर्ण सूचनाहरू PM लाई इमेल गरिन्छ।',
    // Time & Attendance
    'tna.logAttendance': 'उपस्थिति लग गर्नुहोस्',
    'tna.logUpdate': 'लग / अपडेट',
    'tna.attendanceHistory': 'उपस्थिति इतिहास',
    'tna.payrollSummary': 'तलब सारांश (गत ३० दिन)',
    'tna.daysLogged': 'लग गरिएका दिनहरू',
    'tna.totalHours': 'कुल घण्टा',
    'tna.totalPay': 'कुल तलब (३० दिन)',
  },
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = usePersistentState<Locale>('omnisite-locale', 'en')
  const [calendar, setCalendarState] = usePersistentState<CalendarSystem>('omnisite-calendar', 'AD')

  const setLocale = (l: Locale) => setLocaleState(l)
  const setCalendar = (c: CalendarSystem) => setCalendarState(c)

  const t = (key: string, params?: Record<string, string | number>): string => {
    let str = translations[locale]?.[key] ?? translations.en[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  }

  return (
    <I18nContext.Provider value={{ locale, calendar, setLocale, setCalendar, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = () => useContext(I18nContext)
