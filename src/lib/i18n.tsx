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
const translations: Record<Locale, Record<string, string>> = {
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
    'module.subcontractor': 'Subcontractor Mgmt',
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
    'module.subcontractor': 'उप-निर्माणकर्ता व्यवस्थापन',
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
