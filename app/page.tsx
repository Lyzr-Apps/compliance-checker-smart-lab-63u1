'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { VscShield, VscCode, VscSearch, VscHistory, VscBook, VscWarning, VscError, VscInfo, VscCheck, VscExport, VscClose, VscPlay, VscFilter, VscRepoForked, VscTrash, VscFile, VscVerified, VscCircleFilled, VscDash, VscCopy, VscWand, VscTerminal, VscTools } from 'react-icons/vsc'
import { HiOutlineShieldCheck, HiOutlineExclamationTriangle, HiOutlineInformationCircle } from 'react-icons/hi2'
import { HiMiniShieldCheck, HiMiniXCircle, HiMiniExclamationTriangle, HiMiniMinusCircle } from 'react-icons/hi2'

// --- Constants ---
const MANAGER_AGENT_ID = '699888d562205d38ecc8323f'

// --- Types ---
interface Violation {
  title: string
  severity: 'high' | 'medium' | 'low'
  guideline_reference: string
  description: string
  affected_code: string
  suggested_fix: string
}

interface Category {
  category_name: string
  violations: Violation[]
  category_summary: string
}

interface PriorityFix {
  priority: number
  title: string
  category: string
  action: string
}

interface RiskSummary {
  high: number
  medium: number
  low: number
}

interface ReadinessCheckItem {
  item: string
  status: 'pass' | 'fail' | 'warning' | 'not_applicable'
  details: string
}

interface AnalysisResult {
  compliance_score: number
  readiness_status?: 'ready' | 'needs_fixes' | 'high_risk'
  risk_summary: RiskSummary
  readiness_checklist?: ReadinessCheckItem[]
  categories: Category[]
  overall_assessment: string
  priority_fixes: PriorityFix[]
}

interface HistoryEntry {
  id: string
  date: string
  appName: string
  complianceScore: number
  highCount: number
  mediumCount: number
  lowCount: number
  result: AnalysisResult
}

interface CategoryOption {
  id: string
  name: string
  checked: boolean
}

interface RepoFile {
  path: string
  content: string
  size: number
}

// --- Dev Environment Types ---
interface DevEnvironment {
  id: string
  name: string
  category: 'ide' | 'nocode' | 'lowcode'
  icon: string
  promptPrefix: string
  contextNote: string
}

const DEV_ENVIRONMENTS: DevEnvironment[] = [
  {
    id: 'xcode',
    name: 'Xcode',
    category: 'ide',
    icon: 'Xcode',
    promptPrefix: 'In Xcode project',
    contextNote: 'Navigate to the file in Xcode Project Navigator, apply the changes in the source editor, and rebuild.'
  },
  {
    id: 'vscode',
    name: 'VS Code',
    category: 'ide',
    icon: 'VS Code',
    promptPrefix: 'In VS Code workspace',
    contextNote: 'Open the file via Cmd/Ctrl+P, make the edits, and save. Run the build from the integrated terminal.'
  },
  {
    id: 'appcode',
    name: 'AppCode (JetBrains)',
    category: 'ide',
    icon: 'AppCode',
    promptPrefix: 'In AppCode/JetBrains IDE',
    contextNote: 'Use the project tree to navigate to the file, apply the refactoring, and rebuild the scheme.'
  },
  {
    id: 'cursor',
    name: 'Cursor',
    category: 'ide',
    icon: 'Cursor',
    promptPrefix: 'In Cursor AI editor',
    contextNote: 'You can paste this prompt directly into Cursor Chat (Cmd+L) and let Cursor apply the fix automatically.'
  },
  {
    id: 'flutterflow',
    name: 'FlutterFlow',
    category: 'nocode',
    icon: 'FlutterFlow',
    promptPrefix: 'In FlutterFlow visual builder',
    contextNote: 'Use the FlutterFlow UI editor to make these changes. Some fixes may require Custom Code blocks or Custom Actions.'
  },
  {
    id: 'adalo',
    name: 'Adalo',
    category: 'nocode',
    icon: 'Adalo',
    promptPrefix: 'In Adalo app builder',
    contextNote: 'Apply changes through the Adalo visual editor. For privacy and metadata issues, check the App Settings panel.'
  },
  {
    id: 'thunkable',
    name: 'Thunkable',
    category: 'nocode',
    icon: 'Thunkable',
    promptPrefix: 'In Thunkable project',
    contextNote: 'Use the Thunkable drag-and-drop editor and Blocks section. For compliance items, check Project Settings.'
  },
  {
    id: 'bubble',
    name: 'Bubble',
    category: 'nocode',
    icon: 'Bubble',
    promptPrefix: 'In Bubble.io editor',
    contextNote: 'Apply changes via the Bubble visual editor. For data privacy, check the Privacy tab and API settings.'
  },
  {
    id: 'swiftui_playgrounds',
    name: 'Swift Playgrounds',
    category: 'ide',
    icon: 'Swift Playgrounds',
    promptPrefix: 'In Swift Playgrounds',
    contextNote: 'Open the relevant source file in Swift Playgrounds and apply the code changes directly.'
  },
  {
    id: 'react_native',
    name: 'React Native (Expo)',
    category: 'lowcode',
    icon: 'Expo',
    promptPrefix: 'In React Native / Expo project',
    contextNote: 'Edit the relevant source files in your code editor, then rebuild using expo build:ios or eas build.'
  },
  {
    id: 'other',
    name: 'Other / Manual',
    category: 'ide',
    icon: 'Other',
    promptPrefix: 'In your development environment',
    contextNote: 'Apply the changes in your preferred editor or platform. Adjust the steps as needed for your specific setup.'
  }
]

// iOS-relevant file extensions for filtering
const IOS_EXTENSIONS = ['.swift', '.m', '.mm', '.h', '.plist', '.storyboard', '.xib', '.entitlements', '.xcconfig', '.pbxproj', '.podfile', '.podspec']

function isIOSRelevantFile(path: string): boolean {
  const lower = path.toLowerCase()
  return IOS_EXTENSIONS.some(ext => lower.endsWith(ext)) ||
    lower.includes('podfile') ||
    lower.includes('cartfile') ||
    lower.includes('package.swift') ||
    lower.includes('info.plist') ||
    lower.endsWith('.json') && (lower.includes('config') || lower.includes('package'))
}

function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string; path: string } | null {
  try {
    const cleaned = url.trim().replace(/\/+$/, '').replace(/\.git$/, '')
    // Match: github.com/owner/repo or github.com/owner/repo/tree/branch/path
    const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.*))?)?/)
    if (!match) return null
    return {
      owner: match[1],
      repo: match[2],
      branch: match[3] || 'main',
      path: match[4] || ''
    }
  } catch {
    return null
  }
}

// --- Sample Data ---
const SAMPLE_RESULT: AnalysisResult = {
  compliance_score: 72,
  readiness_status: 'needs_fixes',
  risk_summary: { high: 3, medium: 5, low: 2 },
  readiness_checklist: [
    { item: 'Privacy Policy URL configured', status: 'fail', details: 'No privacy policy URL was detected in the app configuration or Info.plist. This is required for apps that collect any user data.' },
    { item: 'Data collection declarations match actual usage', status: 'warning', details: 'App uses CLLocationManager but location data collection may not be fully declared in App Store Connect privacy nutrition labels.' },
    { item: 'App Tracking Transparency implemented', status: 'fail', details: 'App appears to access advertising identifiers but ATTrackingManager.requestTrackingAuthorization() was not found in the code.' },
    { item: 'Account deletion mechanism present', status: 'fail', details: 'No account deletion or data erasure functionality was found. Required since June 2022 for apps with account creation.' },
    { item: 'In-app purchase terms clearly displayed', status: 'warning', details: 'Subscription pricing page exists but renewal period and cancellation terms are not prominently displayed before the purchase button.' },
    { item: 'Age rating accurately reflects content', status: 'pass', details: 'Age rating of 4+ appears appropriate for the described app functionality. No mature content detected.' },
    { item: 'App name follows guidelines', status: 'pass', details: 'App name "PhotoSync Pro" is within the 30-character limit and does not contain generic terms or misleading claims.' },
    { item: 'Screenshots match actual app UI', status: 'fail', details: 'Screenshots contain Android-style navigation bars and non-Apple device frames that do not match iOS UI standards.' },
    { item: 'No placeholder or test content', status: 'pass', details: 'No placeholder text, lorem ipsum, or test content was detected in the codebase.' },
    { item: 'Required purpose strings present', status: 'warning', details: 'NSLocationWhenInUseUsageDescription found but NSPhotoLibraryUsageDescription may be missing for a photo sync app.' },
    { item: 'Sign in with Apple implemented', status: 'not_applicable', details: 'No third-party login SDK detected. Sign in with Apple is only required when third-party login options are offered.' },
    { item: 'HTTPS enforced for all network calls', status: 'pass', details: 'No HTTP URLs or ATS exceptions were detected in the code snippets provided.' },
    { item: 'Accessibility basics covered', status: 'warning', details: 'No explicit VoiceOver accessibility labels or Dynamic Type support was detected. Consider adding accessibility annotations.' },
    { item: 'No private API usage detected', status: 'pass', details: 'No private framework imports or undocumented API calls were identified in the code.' },
    { item: 'Background modes justified', status: 'warning', details: 'Background location usage detected. Ensure this mode is declared in Info.plist and justified in App Review notes.' }
  ],
  categories: [
    {
      category_name: 'Privacy & Data Collection',
      category_summary: 'Several privacy-related issues found. The app collects user data without adequate disclosure in the privacy policy. Location data is accessed without clear justification.',
      violations: [
        {
          title: 'Missing Privacy Nutrition Label',
          severity: 'high',
          guideline_reference: 'Guideline 5.1.1',
          description: 'App collects email and location data but does not declare these data types in the App Privacy nutrition label on App Store Connect.',
          affected_code: 'CLLocationManager.requestWhenInUseAuthorization()',
          suggested_fix: 'Update the App Privacy section in App Store Connect to declare Location and Contact Info data collection. Provide a clear purpose string in Info.plist for NSLocationWhenInUseUsageDescription.'
        },
        {
          title: 'Insufficient Data Deletion Mechanism',
          severity: 'medium',
          guideline_reference: 'Guideline 5.1.1(v)',
          description: 'No account deletion or data erasure option found in the app settings or described in the submission.',
          affected_code: 'N/A - Missing implementation',
          suggested_fix: 'Implement an in-app account deletion flow that allows users to request full data erasure, as required by App Review guidelines since 2022.'
        }
      ]
    },
    {
      category_name: 'UI/UX & Technical',
      category_summary: 'Minor technical compliance issues detected. The app meets most UI standards but has some edge cases that could trigger review rejection.',
      violations: [
        {
          title: 'Non-Standard Back Navigation',
          severity: 'low',
          guideline_reference: 'Guideline 4.0 - Design',
          description: 'Custom back button does not follow iOS HIG navigation patterns. The swipe-to-go-back gesture is disabled on some screens.',
          affected_code: 'navigationController?.interactivePopGestureRecognizer?.isEnabled = false',
          suggested_fix: 'Re-enable the interactive pop gesture recognizer. If custom back navigation is needed, ensure it supplements rather than replaces the standard gesture.'
        },
        {
          title: 'Missing iPad Layout Adaptation',
          severity: 'medium',
          guideline_reference: 'Guideline 2.4.1',
          description: 'App does not adapt its layout for iPad screen sizes. Content appears stretched on larger displays.',
          affected_code: 'UIDevice.current.userInterfaceIdiom check missing',
          suggested_fix: 'Implement adaptive layouts using Size Classes and Auto Layout constraints that respond to different screen sizes. Test on iPad simulator.'
        }
      ]
    },
    {
      category_name: 'Content & Monetization',
      category_summary: 'Monetization practices are mostly compliant. One issue found with subscription terminology.',
      violations: [
        {
          title: 'Unclear Subscription Terms',
          severity: 'high',
          guideline_reference: 'Guideline 3.1.2(a)',
          description: 'Subscription pricing page does not clearly state the renewal period and cancellation terms before the purchase button.',
          affected_code: 'SubscriptionView.swift - purchaseButton action',
          suggested_fix: 'Display the subscription price, renewal period, and a link to Apple subscription management settings directly on the purchase screen, before the user taps Subscribe.'
        }
      ]
    },
    {
      category_name: 'Metadata & Marketing',
      category_summary: 'App metadata has issues that could delay review. Keywords and screenshots need attention.',
      violations: [
        {
          title: 'Keyword Stuffing in Subtitle',
          severity: 'medium',
          guideline_reference: 'Guideline 2.3.7',
          description: 'App subtitle contains repeated keywords that also appear in the app name, which Apple considers keyword stuffing.',
          affected_code: 'N/A - App Store Connect metadata',
          suggested_fix: 'Revise the subtitle to use unique, descriptive terms that do not duplicate the app name. Focus on communicating the app value proposition.'
        },
        {
          title: 'Screenshots Show Non-iOS UI Elements',
          severity: 'high',
          guideline_reference: 'Guideline 2.3.1',
          description: 'Marketing screenshots include Android-style navigation bars and non-Apple device frames.',
          affected_code: 'N/A - Marketing assets',
          suggested_fix: 'Replace all screenshots with actual iOS device captures. Use Apple-approved device frames and ensure all UI elements shown are native iOS components.'
        },
        {
          title: 'Misleading Performance Claims',
          severity: 'medium',
          guideline_reference: 'Guideline 2.3.7',
          description: 'App description claims "fastest app in the category" without verifiable benchmarks.',
          affected_code: 'N/A - App Store description text',
          suggested_fix: 'Remove unsubstantiated performance claims or provide verifiable data. Use factual descriptions of app features instead.'
        }
      ]
    }
  ],
  overall_assessment: '## Compliance Overview\n\nThe app has **several critical issues** that are likely to result in App Store rejection if not addressed before submission.\n\n### Key Concerns\n- **Privacy compliance** is the most urgent area, with missing nutrition labels and no data deletion mechanism\n- **Subscription transparency** needs immediate attention to meet Apple\'s updated requirements\n- **Marketing materials** contain elements that will trigger automatic rejection\n\n### Positive Aspects\n- Core app functionality appears to meet technical standards\n- No obvious crash risks or performance issues detected in the code snippets\n- In-app purchase implementation follows StoreKit best practices\n\n### Recommendation\nAddress the **3 high-severity issues** before submitting for review. The medium and low severity items should also be resolved but are less likely to cause immediate rejection.',
  priority_fixes: [
    { priority: 1, title: 'Add Privacy Nutrition Labels', category: 'Privacy & Data Collection', action: 'Declare all collected data types in App Store Connect Privacy section and add purpose strings to Info.plist' },
    { priority: 2, title: 'Fix Subscription Disclosure', category: 'Content & Monetization', action: 'Add clear pricing, renewal terms, and cancellation instructions on the subscription purchase screen' },
    { priority: 3, title: 'Replace Marketing Screenshots', category: 'Metadata & Marketing', action: 'Capture new screenshots from iOS devices with native UI elements and Apple-approved device frames' },
    { priority: 4, title: 'Implement Account Deletion', category: 'Privacy & Data Collection', action: 'Build an in-app account deletion flow and document data erasure procedures' },
    { priority: 5, title: 'Fix iPad Layout', category: 'UI/UX & Technical', action: 'Implement adaptive layouts using Size Classes for iPad compatibility' }
  ]
}

const SAMPLE_HISTORY: HistoryEntry[] = [
  {
    id: 'hist-001',
    date: '2025-02-18T14:30:00Z',
    appName: 'PhotoSync Pro',
    complianceScore: 72,
    highCount: 3,
    mediumCount: 5,
    lowCount: 2,
    result: SAMPLE_RESULT
  },
  {
    id: 'hist-002',
    date: '2025-02-15T09:15:00Z',
    appName: 'FitTrack Daily',
    complianceScore: 89,
    highCount: 1,
    mediumCount: 2,
    lowCount: 3,
    result: { ...SAMPLE_RESULT, compliance_score: 89, risk_summary: { high: 1, medium: 2, low: 3 } }
  },
  {
    id: 'hist-003',
    date: '2025-02-10T16:45:00Z',
    appName: 'BudgetWise',
    complianceScore: 45,
    highCount: 6,
    mediumCount: 4,
    lowCount: 1,
    result: { ...SAMPLE_RESULT, compliance_score: 45, risk_summary: { high: 6, medium: 4, low: 1 } }
  }
]

// --- Helper Functions ---

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'hsl(135, 94%, 60%)'
  if (score >= 50) return 'hsl(31, 100%, 65%)'
  return 'hsl(0, 100%, 62%)'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Pass'
  if (score >= 50) return 'Warning'
  return 'Fail'
}

function getReadinessColor(status: string): string {
  switch (status) {
    case 'ready': return 'hsl(135, 94%, 60%)'
    case 'needs_fixes': return 'hsl(31, 100%, 65%)'
    case 'high_risk': return 'hsl(0, 100%, 62%)'
    default: return 'hsl(228, 10%, 62%)'
  }
}

function getReadinessLabel(status: string): string {
  switch (status) {
    case 'ready': return 'Ready to Submit'
    case 'needs_fixes': return 'Needs Fixes'
    case 'high_risk': return 'High Rejection Risk'
    default: return 'Unknown'
  }
}

function getChecklistStatusIcon(status: string) {
  switch (status) {
    case 'pass': return <HiMiniShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
    case 'fail': return <HiMiniXCircle className="w-4 h-4 text-red-400 shrink-0" />
    case 'warning': return <HiMiniExclamationTriangle className="w-4 h-4 text-amber-400 shrink-0" />
    case 'not_applicable': return <HiMiniMinusCircle className="w-4 h-4 text-muted-foreground shrink-0" />
    default: return <VscDash className="w-4 h-4 text-muted-foreground shrink-0" />
  }
}

function getChecklistStatusBg(status: string): string {
  switch (status) {
    case 'pass': return 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10'
    case 'fail': return 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
    case 'warning': return 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
    case 'not_applicable': return 'bg-secondary/30 border-border/50 hover:bg-secondary/50'
    default: return 'bg-secondary/30 border-border/50'
  }
}

function getSeverityClasses(severity: string): string {
  switch (severity) {
    case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    case 'low': return 'bg-blue-400/20 text-blue-400 border-blue-400/30'
    default: return 'bg-muted text-muted-foreground'
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

// --- ErrorBoundary ---
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// --- Compliance Score Circle ---
function ComplianceScoreCircle({ score, size = 160 }: { score: number; size?: number }) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference
  const color = getScoreColor(score)
  const label = getScoreLabel(score)

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(232, 16%, 28%)" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out" style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tracking-tight" style={{ color }}>{score}</span>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

// --- Risk Card ---
function RiskCard({ label, count, icon, colorClass, glowClass }: { label: string; count: number; icon: React.ReactNode; colorClass: string; glowClass: string }) {
  return (
    <Card className={`border ${colorClass} ${glowClass} transition-all duration-300 hover:scale-[1.02]`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClass}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold tracking-tight">{count}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Loading Skeleton ---
function AnalysisLoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Performing 360-degree compliance analysis across all guideline categories...</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="flex gap-6">
        <Skeleton className="h-44 w-44 rounded-full mx-auto" />
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  )
}

// --- Sidebar Navigation ---
function SidebarNav({ activeView, setActiveView }: { activeView: string; setActiveView: (v: string) => void }) {
  const items = [
    { id: 'analysis', label: 'Analysis', icon: <VscCode className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <VscHistory className="w-4 h-4" /> },
    { id: 'guidelines', label: 'Guidelines', icon: <VscBook className="w-4 h-4" /> },
  ]

  return (
    <div className="w-56 min-h-screen bg-[hsl(231,18%,12%)] border-r border-border flex flex-col">
      <div className="p-5 flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-primary/20 shadow-[0_0_12px_hsl(265,89%,72%,0.3)]">
          <VscShield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight leading-none">Compliance</h1>
          <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">Analyzer</p>
        </div>
      </div>
      <Separator className="mb-2" />
      <nav className="flex-1 px-3 py-2 space-y-1">
        {items.map((item) => (
          <button key={item.id} onClick={() => setActiveView(item.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeView === item.id ? 'bg-primary/15 text-primary shadow-[0_0_10px_hsl(265,89%,72%,0.15)]' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-3 mt-auto">
        <Card className="bg-secondary/50 border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_6px_hsl(135,94%,60%,0.5)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Agent Status</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">Compliance Coordinator</p>
            <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 truncate">{MANAGER_AGENT_ID}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// --- Results Dashboard ---
function ResultsDashboard({ result, onExport, onBack }: { result: AnalysisResult; onExport: () => void; onBack: () => void }) {
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const [showChecklist, setShowChecklist] = useState(true)

  const categories = Array.isArray(result?.categories) ? result.categories : []
  const priorityFixes = Array.isArray(result?.priority_fixes) ? result.priority_fixes : []
  const readinessChecklist = Array.isArray(result?.readiness_checklist) ? result.readiness_checklist : []
  const readinessStatus = result?.readiness_status ?? (result?.compliance_score >= 85 ? 'ready' : result?.compliance_score >= 60 ? 'needs_fixes' : 'high_risk')
  const riskHigh = result?.risk_summary?.high ?? 0
  const riskMedium = result?.risk_summary?.medium ?? 0
  const riskLow = result?.risk_summary?.low ?? 0
  const score = result?.compliance_score ?? 0
  const assessment = result?.overall_assessment ?? ''
  const checklistPassed = readinessChecklist.filter(c => c?.status === 'pass').length
  const checklistFailed = readinessChecklist.filter(c => c?.status === 'fail').length
  const checklistWarnings = readinessChecklist.filter(c => c?.status === 'warning').length
  const checklistNA = readinessChecklist.filter(c => c?.status === 'not_applicable').length

  const filteredCategories = categories.map(cat => {
    const violations = Array.isArray(cat?.violations) ? cat.violations : []
    const filtered = violations.filter(v => {
      if (severityFilter !== 'all' && v?.severity !== severityFilter) return false
      return true
    })
    return { ...cat, violations: filtered }
  }).filter(cat => {
    if (categoryFilter !== 'all' && cat?.category_name !== categoryFilter) return false
    return cat.violations.length > 0 || categoryFilter === 'all'
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <VscClose className="w-4 h-4 mr-1" /> Back
          </Button>
          <h2 className="text-lg font-bold tracking-tight">Analysis Results</h2>
        </div>
        <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
          <VscExport className="w-3.5 h-3.5" /> Export Report
        </Button>
      </div>

      {/* Score + Risk Summary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1 border-border shadow-xl flex items-center justify-center py-4">
          <ComplianceScoreCircle score={score} size={150} />
        </Card>
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RiskCard label="High Risk" count={riskHigh} icon={<VscError className="w-5 h-5 text-red-400" />} colorClass="bg-red-500/10 border-red-500/20" glowClass="shadow-[0_0_15px_hsl(0,100%,62%,0.1)]" />
          <RiskCard label="Medium Risk" count={riskMedium} icon={<VscWarning className="w-5 h-5 text-amber-400" />} colorClass="bg-amber-500/10 border-amber-500/20" glowClass="shadow-[0_0_15px_hsl(31,100%,65%,0.1)]" />
          <RiskCard label="Low Risk" count={riskLow} icon={<VscInfo className="w-5 h-5 text-blue-400" />} colorClass="bg-blue-400/10 border-blue-400/20" glowClass="shadow-[0_0_15px_hsl(191,97%,70%,0.1)]" />
        </div>
      </div>

      {/* Readiness Status Banner */}
      <Card className={`border shadow-lg overflow-hidden ${
        readinessStatus === 'ready' ? 'border-green-500/30 shadow-[0_0_20px_hsl(135,94%,60%,0.1)]' :
        readinessStatus === 'needs_fixes' ? 'border-amber-500/30 shadow-[0_0_20px_hsl(31,100%,65%,0.1)]' :
        'border-red-500/30 shadow-[0_0_20px_hsl(0,100%,62%,0.1)]'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {readinessStatus === 'ready' ? (
                <div className="p-2 rounded-full bg-green-500/15"><VscVerified className="w-6 h-6 text-green-400" /></div>
              ) : readinessStatus === 'needs_fixes' ? (
                <div className="p-2 rounded-full bg-amber-500/15"><HiOutlineExclamationTriangle className="w-6 h-6 text-amber-400" /></div>
              ) : (
                <div className="p-2 rounded-full bg-red-500/15"><VscError className="w-6 h-6 text-red-400" /></div>
              )}
              <div>
                <p className="text-base font-bold tracking-tight" style={{ color: getReadinessColor(readinessStatus) }}>
                  {getReadinessLabel(readinessStatus)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {readinessStatus === 'ready'
                    ? 'Your app appears to meet all critical App Store requirements. Proceed with submission.'
                    : readinessStatus === 'needs_fixes'
                    ? 'Some issues need attention before submitting. Address the items below to improve your chances.'
                    : 'Significant issues detected. Submitting now will likely result in rejection.'
                  }
                </p>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs font-mono" style={{ color: getReadinessColor(readinessStatus), borderColor: getReadinessColor(readinessStatus) }}>
              {score}/100
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Pre-Submission Readiness Checklist */}
      {readinessChecklist.length > 0 && (
        <Card className="border-border shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <VscVerified className="w-4 h-4 text-primary" /> Pre-Submission Readiness Checklist
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-green-400">{checklistPassed} passed</span>
                  <VscCircleFilled className="w-1.5 h-1.5 text-muted-foreground/30" />
                  <span className="text-[10px] font-semibold text-red-400">{checklistFailed} failed</span>
                  <VscCircleFilled className="w-1.5 h-1.5 text-muted-foreground/30" />
                  <span className="text-[10px] font-semibold text-amber-400">{checklistWarnings} warnings</span>
                  {checklistNA > 0 && (
                    <>
                      <VscCircleFilled className="w-1.5 h-1.5 text-muted-foreground/30" />
                      <span className="text-[10px] font-semibold text-muted-foreground">{checklistNA} N/A</span>
                    </>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowChecklist(!showChecklist)} className="h-7 text-xs text-muted-foreground">
                  {showChecklist ? 'Collapse' : 'Expand'}
                </Button>
              </div>
            </div>
            <CardDescription className="text-xs">Every item must pass or be N/A for 100% submission confidence.</CardDescription>
          </CardHeader>
          {showChecklist && (
            <CardContent className="pt-0">
              {/* Progress bar */}
              <div className="mb-3">
                <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
                  {checklistPassed > 0 && (
                    <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(checklistPassed / readinessChecklist.length) * 100}%` }} />
                  )}
                  {checklistWarnings > 0 && (
                    <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${(checklistWarnings / readinessChecklist.length) * 100}%` }} />
                  )}
                  {checklistFailed > 0 && (
                    <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(checklistFailed / readinessChecklist.length) * 100}%` }} />
                  )}
                  {checklistNA > 0 && (
                    <div className="h-full bg-muted-foreground/30 transition-all duration-500" style={{ width: `${(checklistNA / readinessChecklist.length) * 100}%` }} />
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                {readinessChecklist.map((check, idx) => (
                  <div key={idx} className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all duration-200 ${getChecklistStatusBg(check?.status ?? '')}`}>
                    {getChecklistStatusIcon(check?.status ?? '')}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{check?.item ?? 'Check item'}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{check?.details ?? ''}</p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 uppercase tracking-wider font-bold ${
                      check?.status === 'pass' ? 'text-green-400 border-green-500/30' :
                      check?.status === 'fail' ? 'text-red-400 border-red-500/30' :
                      check?.status === 'warning' ? 'text-amber-400 border-amber-500/30' :
                      'text-muted-foreground border-border'
                    }`}>
                      {check?.status === 'not_applicable' ? 'N/A' : check?.status ?? ''}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Overall Assessment */}
      {assessment && (
        <Card className="border-border shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HiOutlineShieldCheck className="w-4 h-4 text-primary" /> Overall Assessment
            </CardTitle>
          </CardHeader>
          <CardContent className="text-foreground/90">
            {renderMarkdown(assessment)}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <VscFilter className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'high', 'medium', 'low'].map((sev) => (
            <Button key={sev} variant={severityFilter === sev ? 'default' : 'outline'} size="sm" onClick={() => setSeverityFilter(sev)} className={`text-xs h-7 px-3 ${severityFilter === sev ? 'shadow-[0_0_10px_hsl(265,89%,72%,0.3)]' : 'border-border'}`}>
              {sev === 'all' ? 'All Severity' : sev.charAt(0).toUpperCase() + sev.slice(1)}
            </Button>
          ))}
        </div>
        <Separator orientation="vertical" className="h-6 hidden sm:block" />
        <div className="flex gap-1.5 flex-wrap">
          <Button variant={categoryFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setCategoryFilter('all')} className={`text-xs h-7 px-3 ${categoryFilter === 'all' ? 'shadow-[0_0_10px_hsl(265,89%,72%,0.3)]' : 'border-border'}`}>
            All Categories
          </Button>
          {categories.map((cat) => (
            <Button key={cat?.category_name ?? 'unknown'} variant={categoryFilter === cat?.category_name ? 'default' : 'outline'} size="sm" onClick={() => setCategoryFilter(cat?.category_name ?? 'all')} className={`text-xs h-7 px-3 ${categoryFilter === cat?.category_name ? 'shadow-[0_0_10px_hsl(265,89%,72%,0.3)]' : 'border-border'}`}>
              {cat?.category_name ?? 'Unknown'}
            </Button>
          ))}
        </div>
      </div>

      {/* Violation Cards by Category */}
      <div className="space-y-4">
        {filteredCategories.map((cat, catIdx) => {
          const violations = Array.isArray(cat?.violations) ? cat.violations : []
          return (
            <Card key={catIdx} className="border-border shadow-lg overflow-hidden">
              <CardHeader className="pb-2 bg-secondary/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{cat?.category_name ?? 'Category'}</CardTitle>
                  <Badge variant="outline" className="text-xs border-border">{violations.length} issue{violations.length !== 1 ? 's' : ''}</Badge>
                </div>
                {cat?.category_summary && (
                  <CardDescription className="text-xs text-muted-foreground mt-1">{cat.category_summary}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {violations.length > 0 ? (
                  <Accordion type="multiple" className="w-full">
                    {violations.map((v, vIdx) => (
                      <AccordionItem key={vIdx} value={`${catIdx}-${vIdx}`} className="border-border/50">
                        <AccordionTrigger className="px-4 py-3 text-sm hover:no-underline hover:bg-secondary/20">
                          <div className="flex items-center gap-2.5 text-left flex-1 mr-2">
                            {v?.severity === 'high' && <VscError className="w-4 h-4 text-red-400 shrink-0" />}
                            {v?.severity === 'medium' && <VscWarning className="w-4 h-4 text-amber-400 shrink-0" />}
                            {v?.severity === 'low' && <VscInfo className="w-4 h-4 text-blue-400 shrink-0" />}
                            <span className="font-medium">{v?.title ?? 'Violation'}</span>
                            <Badge className={`text-[10px] px-1.5 py-0 h-5 ml-auto shrink-0 ${getSeverityClasses(v?.severity ?? '')}`}>
                              {v?.severity ?? 'unknown'}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="space-y-3">
                            {v?.guideline_reference && (
                              <div className="flex items-center gap-2">
                                <VscBook className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="text-xs font-medium text-primary">{v.guideline_reference}</span>
                              </div>
                            )}
                            {v?.description && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                                <p className="text-sm text-foreground/90">{v.description}</p>
                              </div>
                            )}
                            {v?.affected_code && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Affected Code</p>
                                <pre className="bg-[hsl(231,18%,12%)] border border-border rounded-lg p-3 text-xs font-mono text-foreground/80 overflow-x-auto">{v.affected_code}</pre>
                              </div>
                            )}
                            {v?.suggested_fix && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Suggested Fix</p>
                                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
                                  <p className="text-sm text-foreground/90">{v.suggested_fix}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    <VscCheck className="w-5 h-5 mx-auto mb-1 text-accent" />
                    No violations in this category match the current filter.
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Priority Fixes */}
      {priorityFixes.length > 0 && (
        <Card className="border-border shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HiOutlineExclamationTriangle className="w-4 h-4 text-amber-400" /> Priority Fixes
            </CardTitle>
            <CardDescription className="text-xs">Address these items in order of priority before submitting for review.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {priorityFixes.map((fix, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50 hover:border-primary/30 transition-all duration-200">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shadow-[0_0_8px_hsl(265,89%,72%,0.2)]">
                    {fix?.priority ?? idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{fix?.title ?? 'Fix'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fix?.category ?? ''}</p>
                    <p className="text-xs text-foreground/80 mt-1">{fix?.action ?? ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fix Assistant */}
      <FixAssistant result={result} />
    </div>
  )
}

// --- Fix Prompt Generator ---
function generateFixPrompt(
  env: DevEnvironment,
  violation: Violation,
  categoryName: string
): string {
  const isNoCode = env.category === 'nocode'
  const isLowCode = env.category === 'lowcode'

  if (isNoCode) {
    return `[${env.name} - Fix Required]

Issue: ${violation.title}
Severity: ${(violation.severity ?? 'unknown').toUpperCase()}
Guideline: ${violation.guideline_reference ?? 'N/A'}
Category: ${categoryName}

What's wrong:
${violation.description ?? ''}

How to fix in ${env.name}:
${violation.suggested_fix ?? ''}

${env.contextNote}

Since you're using ${env.name} (a ${env.category === 'nocode' ? 'no-code' : 'low-code'} platform), look for the relevant setting in your app's configuration panel or settings screen. If the fix requires code-level changes that aren't available in the visual editor, you may need to use a Custom Code/Action block or contact the platform's support for guidance on compliance requirements.`
  }

  if (isLowCode) {
    return `[${env.name} - Fix Required]

Issue: ${violation.title}
Severity: ${(violation.severity ?? 'unknown').toUpperCase()}
Guideline: ${violation.guideline_reference ?? 'N/A'}
Category: ${categoryName}

Problem:
${violation.description ?? ''}

${violation.affected_code && violation.affected_code !== 'N/A' ? `Affected code:\n${violation.affected_code}\n` : ''}
Fix instructions for ${env.name}:
${violation.suggested_fix ?? ''}

${env.contextNote}`
  }

  // IDE prompt - more code-centric
  return `${env.promptPrefix}, fix the following App Store compliance violation:

Issue: ${violation.title}
Severity: ${(violation.severity ?? 'unknown').toUpperCase()}
Guideline: ${violation.guideline_reference ?? 'N/A'}
Category: ${categoryName}

Description:
${violation.description ?? ''}

${violation.affected_code && violation.affected_code !== 'N/A' ? `Current code:\n\`\`\`\n${violation.affected_code}\n\`\`\`\n` : ''}
Required fix:
${violation.suggested_fix ?? ''}

${env.contextNote}`
}

function generateAllFixesPrompt(
  env: DevEnvironment,
  result: AnalysisResult
): string {
  const categories = Array.isArray(result?.categories) ? result.categories : []
  const allViolations: { violation: Violation; category: string }[] = []

  categories.forEach(cat => {
    const violations = Array.isArray(cat?.violations) ? cat.violations : []
    violations.forEach(v => {
      allViolations.push({ violation: v, category: cat?.category_name ?? 'Unknown' })
    })
  })

  if (allViolations.length === 0) return 'No violations found to fix.'

  const isNoCode = env.category === 'nocode'

  let prompt = `# App Store Compliance Fix Guide for ${env.name}\n`
  prompt += `Platform: ${env.name} (${isNoCode ? 'No-Code' : env.category === 'lowcode' ? 'Low-Code' : 'IDE'})\n`
  prompt += `Total issues: ${allViolations.length}\n`
  prompt += `Score: ${result?.compliance_score ?? 'N/A'}/100\n\n`
  prompt += `---\n\n`

  // Sort by severity: high first
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  allViolations.sort((a, b) => (severityOrder[a.violation.severity] ?? 3) - (severityOrder[b.violation.severity] ?? 3))

  allViolations.forEach((item, idx) => {
    prompt += `## Fix ${idx + 1}: ${item.violation.title}\n`
    prompt += `Severity: ${(item.violation.severity ?? 'unknown').toUpperCase()} | ${item.violation.guideline_reference ?? ''} | ${item.category}\n\n`
    prompt += `Problem: ${item.violation.description ?? ''}\n\n`

    if (item.violation.affected_code && item.violation.affected_code !== 'N/A') {
      if (isNoCode) {
        prompt += `Related area: ${item.violation.affected_code}\n\n`
      } else {
        prompt += `Code: \`${item.violation.affected_code}\`\n\n`
      }
    }

    prompt += `Fix: ${item.violation.suggested_fix ?? ''}\n\n`

    if (isNoCode) {
      prompt += `${env.name} Steps: Look for this in your app settings, configuration panel, or visual editor. If not available through the UI, check if ${env.name} offers a custom code/plugin option.\n\n`
    }

    prompt += `---\n\n`
  })

  prompt += `\n${env.contextNote}`

  return prompt
}

// --- Fix Assistant Component ---
function FixAssistant({ result }: { result: AnalysisResult }) {
  const [selectedEnv, setSelectedEnv] = useState<string>('')
  const [copiedId, setCopiedId] = useState<string>('')
  const [showAssistant, setShowAssistant] = useState(false)
  const [envCategory, setEnvCategory] = useState<string>('all')

  const env = DEV_ENVIRONMENTS.find(e => e.id === selectedEnv)

  const categories = Array.isArray(result?.categories) ? result.categories : []
  const allViolations: { violation: Violation; category: string; id: string }[] = []
  categories.forEach(cat => {
    const violations = Array.isArray(cat?.violations) ? cat.violations : []
    violations.forEach((v, idx) => {
      allViolations.push({
        violation: v,
        category: cat?.category_name ?? 'Unknown',
        id: `${cat?.category_name ?? 'cat'}-${idx}`
      })
    })
  })

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(''), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedId(id)
      setTimeout(() => setCopiedId(''), 2000)
    }
  }

  const filteredEnvs = envCategory === 'all'
    ? DEV_ENVIRONMENTS
    : DEV_ENVIRONMENTS.filter(e => e.category === envCategory)

  if (allViolations.length === 0) return null

  return (
    <Card className="border-border shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <VscWand className="w-4 h-4 text-primary" /> Fix Assistant
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAssistant(!showAssistant)}
            className="h-7 text-xs text-muted-foreground"
          >
            {showAssistant ? 'Collapse' : 'Get Fix Prompts'}
          </Button>
        </div>
        <CardDescription className="text-xs">
          Tell us where you built your app. We will generate tailored fix prompts you can copy and use directly in your development environment.
        </CardDescription>
      </CardHeader>

      {showAssistant && (
        <CardContent className="space-y-4">
          {/* Environment Category Filter */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Where did you build your app?</Label>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {[
                { id: 'all', label: 'All' },
                { id: 'ide', label: 'IDE / Code Editor' },
                { id: 'nocode', label: 'No-Code Platform' },
                { id: 'lowcode', label: 'Low-Code / Hybrid' }
              ].map((cat) => (
                <Button
                  key={cat.id}
                  variant={envCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEnvCategory(cat.id)}
                  className={`text-xs h-7 px-3 ${envCategory === cat.id ? 'shadow-[0_0_10px_hsl(265,89%,72%,0.3)]' : 'border-border'}`}
                >
                  {cat.label}
                </Button>
              ))}
            </div>

            {/* Environment Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filteredEnvs.map((envOption) => (
                <button
                  key={envOption.id}
                  onClick={() => setSelectedEnv(envOption.id)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all duration-200 ${
                    selectedEnv === envOption.id
                      ? 'border-primary/50 bg-primary/10 shadow-[0_0_12px_hsl(265,89%,72%,0.15)]'
                      : 'border-border hover:border-border/80 bg-card hover:bg-secondary/30'
                  }`}
                >
                  <div className={`p-1.5 rounded-md ${selectedEnv === envOption.id ? 'bg-primary/20' : 'bg-secondary/50'}`}>
                    {envOption.category === 'ide' ? (
                      <VscTerminal className={`w-3.5 h-3.5 ${selectedEnv === envOption.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    ) : (
                      <VscTools className={`w-3.5 h-3.5 ${selectedEnv === envOption.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${selectedEnv === envOption.id ? 'text-primary' : ''}`}>
                      {envOption.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 capitalize">{envOption.category === 'nocode' ? 'No-Code' : envOption.category === 'lowcode' ? 'Low-Code' : 'IDE'}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generated Prompts */}
          {env && (
            <div className="space-y-3 pt-2">
              <Separator />

              {/* Selected environment info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                    {env.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {allViolations.length} fix prompt{allViolations.length !== 1 ? 's' : ''} generated
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(generateAllFixesPrompt(env, result), 'all-fixes')}
                  className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 h-7 text-xs"
                >
                  {copiedId === 'all-fixes' ? (
                    <><VscCheck className="w-3 h-3" /> Copied</>
                  ) : (
                    <><VscCopy className="w-3 h-3" /> Copy All Fixes</>
                  )}
                </Button>
              </div>

              {/* Context note for the platform */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <VscInfo className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80">{env.contextNote}</p>
                </div>
              </div>

              {/* Individual fix prompts */}
              <div className="space-y-2">
                {allViolations.map((item) => {
                  const prompt = generateFixPrompt(env, item.violation, item.category)
                  const isCopied = copiedId === item.id

                  return (
                    <div key={item.id} className="rounded-lg border border-border/50 overflow-hidden hover:border-primary/20 transition-all duration-200">
                      <div className="flex items-center justify-between px-3 py-2 bg-secondary/20">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {item.violation.severity === 'high' && <VscError className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                          {item.violation.severity === 'medium' && <VscWarning className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          {item.violation.severity === 'low' && <VscInfo className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                          <span className="text-xs font-medium truncate">{item.violation.title}</span>
                          <Badge className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${getSeverityClasses(item.violation.severity ?? '')}`}>
                            {item.violation.severity ?? 'unknown'}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(prompt, item.id)}
                          className={`h-6 px-2 text-[10px] gap-1 shrink-0 ml-2 ${isCopied ? 'text-accent' : 'text-muted-foreground hover:text-primary'}`}
                        >
                          {isCopied ? (
                            <><VscCheck className="w-3 h-3" /> Copied</>
                          ) : (
                            <><VscCopy className="w-3 h-3" /> Copy</>
                          )}
                        </Button>
                      </div>
                      <div className="px-3 py-2">
                        <pre className="text-[11px] text-foreground/70 font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto leading-relaxed">
                          {prompt}
                        </pre>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// --- History View ---
function HistoryView({ history, onSelectEntry, searchQuery, setSearchQuery }: { history: HistoryEntry[]; onSelectEntry: (entry: HistoryEntry) => void; searchQuery: string; setSearchQuery: (q: string) => void }) {
  const filtered = history.filter(e => {
    const q = searchQuery.toLowerCase()
    if (!q) return true
    return (e?.appName ?? '').toLowerCase().includes(q) || (e?.date ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">Analysis History</h2>
        <Badge variant="outline" className="border-border">{history.length} analyses</Badge>
      </div>
      <div className="relative">
        <VscSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by app name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-card border-border" />
      </div>
      {filtered.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <VscHistory className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No analysis history found.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Completed analyses will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <Card key={entry.id} className="border-border shadow-md hover:border-primary/30 hover:shadow-[0_0_15px_hsl(265,89%,72%,0.1)] transition-all duration-300 cursor-pointer" onClick={() => onSelectEntry(entry)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">{entry?.appName ?? 'Unknown App'}</h3>
                  <span className="text-xs text-muted-foreground">{formatDate(entry?.date ?? '')}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ color: getScoreColor(entry?.complianceScore ?? 0), borderColor: getScoreColor(entry?.complianceScore ?? 0), borderWidth: '2px' }}>
                      {entry?.complianceScore ?? 0}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">{entry?.highCount ?? 0} High</Badge>
                    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">{entry?.mediumCount ?? 0} Med</Badge>
                    <Badge className="bg-blue-400/15 text-blue-400 border-blue-400/30 text-[10px]">{entry?.lowCount ?? 0} Low</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Guidelines Reference ---
function GuidelinesView() {
  const guidelineSections = [
    {
      title: 'Safety (Guideline 1)',
      items: ['1.1 Objectionable Content', '1.2 User Generated Content', '1.3 Kids Category', '1.4 Physical Harm', '1.5 Developer Information', '1.6 Data Security']
    },
    {
      title: 'Performance (Guideline 2)',
      items: ['2.1 App Completeness', '2.2 Beta Testing', '2.3 Accurate Metadata', '2.4 Hardware Compatibility', '2.5 Software Requirements']
    },
    {
      title: 'Business (Guideline 3)',
      items: ['3.1 Payments - In-App Purchase', '3.1.1 In-App Purchase', '3.1.2 Subscriptions', '3.2 Other Business Model Issues']
    },
    {
      title: 'Design (Guideline 4)',
      items: ['4.0 Design - General', '4.1 Copycats', '4.2 Minimum Functionality', '4.3 Spam', '4.4 Extensions', '4.5 Apple Sites and Services']
    },
    {
      title: 'Legal & Privacy (Guideline 5)',
      items: ['5.1 Privacy - Data Collection and Storage', '5.1.1 Data Collection and Storage', '5.1.2 Data Use and Sharing', '5.2 Intellectual Property', '5.3 Gaming, Gambling, and Lotteries', '5.4 VPN Apps', '5.5 Mobile Device Management']
    }
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <VscBook className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold tracking-tight">App Store Review Guidelines</h2>
      </div>
      <p className="text-sm text-muted-foreground">Reference guide for Apple App Store Review Guidelines. The analyzer checks your app against these categories.</p>
      <div className="space-y-3">
        {guidelineSections.map((section, idx) => (
          <Card key={idx} className="border-border shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HiOutlineInformationCircle className="w-4 h-4 text-primary" />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {section.items.map((item, iIdx) => (
                  <li key={iIdx} className="text-xs text-muted-foreground flex items-start gap-2 py-0.5">
                    <VscCheck className="w-3 h-3 text-accent mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// --- Main Page ---
export default function Page() {
  // Navigation
  const [activeView, setActiveView] = useState('analysis')

  // Form state
  const [codeSnippet, setCodeSnippet] = useState('')
  const [appDescription, setAppDescription] = useState('')
  const [appName, setAppName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [keywords, setKeywords] = useState('')
  const [ageRating, setAgeRating] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<CategoryOption[]>([
    { id: 'privacy', name: 'Privacy & Data', checked: false },
    { id: 'uiux', name: 'UI/UX & Technical', checked: false },
    { id: 'content', name: 'Content & Monetization', checked: false },
    { id: 'metadata', name: 'Metadata & Marketing', checked: false },
  ])

  // Analysis state
  const [isLoading, setIsLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<HistoryEntry | null>(null)

  // Sample Data toggle
  const [sampleDataOn, setSampleDataOn] = useState(false)

  // 360 Deep Scan toggle
  const [deepScan, setDeepScan] = useState(true)

  // GitHub repo state
  const [repoUrl, setRepoUrl] = useState('')
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([])
  const [isFetchingRepo, setIsFetchingRepo] = useState(false)
  const [repoError, setRepoError] = useState('')
  const [repoFetchStatus, setRepoFetchStatus] = useState('')

  // Fetch repo files from GitHub
  const fetchRepoFiles = async () => {
    if (!repoUrl.trim()) {
      setRepoError('Please enter a GitHub repository URL.')
      return
    }

    const parsed = parseGitHubUrl(repoUrl)
    if (!parsed) {
      setRepoError('Invalid GitHub URL. Expected format: https://github.com/owner/repo')
      return
    }

    setIsFetchingRepo(true)
    setRepoError('')
    setRepoFiles([])
    setRepoFetchStatus('Fetching repository tree...')

    try {
      // Step 1: Get the repo tree recursively via GitHub API
      const treeUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${parsed.branch}?recursive=1`
      const treeRes = await fetch(treeUrl)

      if (!treeRes.ok) {
        if (treeRes.status === 404) {
          // Try 'master' branch as fallback
          const fallbackUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/master?recursive=1`
          const fallbackRes = await fetch(fallbackUrl)
          if (!fallbackRes.ok) {
            throw new Error(`Repository not found or not public. Status: ${treeRes.status}`)
          }
          const fallbackData = await fallbackRes.json()
          await processTree(fallbackData, parsed.owner, parsed.repo, 'master', parsed.path)
          return
        }
        throw new Error(`GitHub API error: ${treeRes.status} ${treeRes.statusText}`)
      }

      const treeData = await treeRes.json()
      await processTree(treeData, parsed.owner, parsed.repo, parsed.branch, parsed.path)
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Failed to fetch repository.')
    } finally {
      setIsFetchingRepo(false)
      setRepoFetchStatus('')
    }
  }

  const processTree = async (
    treeData: { tree?: Array<{ path: string; type: string; size?: number }> },
    owner: string,
    repo: string,
    branch: string,
    subPath: string
  ) => {
    const tree = Array.isArray(treeData?.tree) ? treeData.tree : []

    // Filter for iOS-relevant files
    let relevantFiles = tree.filter(
      (item) => item.type === 'blob' && isIOSRelevantFile(item.path) && (item.size ?? 0) < 100000
    )

    // If a subPath is specified, filter to only files within that directory
    if (subPath) {
      relevantFiles = relevantFiles.filter(f => f.path.startsWith(subPath))
    }

    if (relevantFiles.length === 0) {
      setRepoError('No iOS-relevant source files found in this repository. Looked for .swift, .m, .h, .plist, .entitlements, and other iOS files.')
      return
    }

    // Cap at 15 files to stay within reasonable token limits
    const filesToFetch = relevantFiles.slice(0, 15)
    setRepoFetchStatus(`Fetching ${filesToFetch.length} of ${relevantFiles.length} iOS files...`)

    const fetchedFiles: RepoFile[] = []
    for (let i = 0; i < filesToFetch.length; i++) {
      const file = filesToFetch[i]
      setRepoFetchStatus(`Fetching file ${i + 1}/${filesToFetch.length}: ${file.path}`)
      try {
        const contentUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`
        const contentRes = await fetch(contentUrl)
        if (contentRes.ok) {
          const contentData = await contentRes.json()
          if (contentData.content && contentData.encoding === 'base64') {
            const decoded = atob(contentData.content.replace(/\n/g, ''))
            fetchedFiles.push({
              path: file.path,
              content: decoded,
              size: file.size ?? decoded.length
            })
          }
        }
      } catch {
        // Skip files that fail to fetch
      }
    }

    if (fetchedFiles.length === 0) {
      setRepoError('Could not fetch any file contents from the repository.')
      return
    }

    setRepoFiles(fetchedFiles)
    setRepoFetchStatus('')

    // Auto-populate the code snippet textarea with fetched code
    const combinedCode = fetchedFiles
      .map(f => `// === ${f.path} ===\n${f.content}`)
      .join('\n\n')
    setCodeSnippet(prev => {
      if (prev.trim()) return prev + '\n\n' + combinedCode
      return combinedCode
    })

    // Try to extract app name from project if not already set
    if (!appName.trim()) {
      const pbxproj = fetchedFiles.find(f => f.path.endsWith('.pbxproj'))
      if (pbxproj) {
        const nameMatch = pbxproj.content.match(/PRODUCT_NAME\s*=\s*"?([^";]+)"?/)
        if (nameMatch) setAppName(nameMatch[1].trim())
      } else {
        // Use repo name as fallback
        setAppName(repo.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
      }
    }
  }

  const removeRepoFile = (path: string) => {
    setRepoFiles(prev => prev.filter(f => f.path !== path))
    // Also remove from code snippet
    setCodeSnippet(prev => {
      const marker = `// === ${path} ===`
      const lines = prev.split('\n')
      const newLines: string[] = []
      let skipping = false
      for (const line of lines) {
        if (line.startsWith('// === ') && line.endsWith(' ===')) {
          if (line === marker) {
            skipping = true
            continue
          } else {
            skipping = false
          }
        }
        if (!skipping) newLines.push(line)
      }
      return newLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    })
  }

  const clearRepoFiles = () => {
    setRepoFiles([])
    setRepoUrl('')
    setRepoError('')
    setCodeSnippet('')
  }

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('compliance_history')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setHistory(parsed)
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  // Save history to localStorage
  const saveHistory = useCallback((entries: HistoryEntry[]) => {
    setHistory(entries)
    try {
      localStorage.setItem('compliance_history', JSON.stringify(entries))
    } catch {
      // ignore storage errors
    }
  }, [])

  // Toggle category
  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c))
  }

  // Build message
  const buildAnalysisMessage = () => {
    let message = ''
    if (deepScan) {
      message += `## MODE: 360-DEGREE DEEP SCAN\nPerform an exhaustive 360-degree analysis covering EVERY possible App Store rejection vector. Include the pre-submission readiness checklist with pass/fail/warning status for each item. Leave no stone unturned - I need to be 100% confident this app will pass review.\n\n`
    }
    const code = sampleDataOn && !codeSnippet.trim() ? 'import UIKit\nimport CoreLocation\n\nclass LocationManager: NSObject, CLLocationManagerDelegate {\n    let manager = CLLocationManager()\n    func startTracking() {\n        manager.requestWhenInUseAuthorization()\n        manager.startUpdatingLocation()\n    }\n}' : codeSnippet
    const desc = sampleDataOn && !appDescription.trim() ? 'A photo synchronization app that backs up your photos to the cloud, with social sharing features and a premium subscription for unlimited storage.' : appDescription
    const name = sampleDataOn && !appName.trim() ? 'PhotoSync Pro' : appName
    const sub = sampleDataOn && !subtitle.trim() ? 'Photo Backup & Sync - Cloud Storage Photo Manager' : subtitle
    const kw = sampleDataOn && !keywords.trim() ? 'photo, backup, sync, cloud, storage, gallery, share' : keywords
    const age = sampleDataOn && !ageRating ? '4+' : ageRating

    if (repoFiles.length > 0) {
      const parsed = parseGitHubUrl(repoUrl)
      if (parsed) {
        message += `## Source: GitHub Repository\nRepository: ${parsed.owner}/${parsed.repo} (branch: ${parsed.branch})\nFiles analyzed: ${repoFiles.map(f => f.path).join(', ')}\n\n`
      }
    }
    if (code.trim()) {
      message += `## Code Snippets\n\`\`\`\n${code}\n\`\`\`\n\n`
    }
    if (desc.trim()) {
      message += `## App Description\n${desc}\n\n`
    }
    if (name.trim()) {
      message += `## App Metadata\n- App Name: ${name}\n`
    }
    if (sub.trim()) {
      message += `- Subtitle: ${sub}\n`
    }
    if (kw.trim()) {
      message += `- Keywords: ${kw}\n`
    }
    if (age) {
      message += `- Age Rating: ${age}\n`
    }
    const selected = selectedCategories.filter(c => c.checked)
    if (selected.length > 0 && selected.length < 4) {
      message += `\n## Focus Areas\nPlease focus the analysis on: ${selected.map(c => c.name).join(', ')}\n`
    }
    return message
  }

  // Run analysis
  const runAnalysis = async () => {
    const message = buildAnalysisMessage()
    if (!message.trim()) {
      setErrorMessage('Please provide at least one input field (code, description, or metadata) to analyze.')
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    setAnalysisResult(null)
    setShowResults(false)
    setActiveAgentId(MANAGER_AGENT_ID)

    try {
      const result = await callAIAgent(message, MANAGER_AGENT_ID)
      setActiveAgentId(null)

      if (result.success) {
        let data = result?.response?.result
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data)
          } catch {
            // fallback: treat as text response
          }
        }

        if (data && typeof data === 'object' && ('compliance_score' in data || 'categories' in data || 'risk_summary' in data)) {
          const analysisData = data as AnalysisResult
          setAnalysisResult(analysisData)
          setShowResults(true)

          // Save to history
          const entryName = sampleDataOn && !appName.trim() ? 'PhotoSync Pro' : (appName.trim() || 'Unnamed App')
          const newEntry: HistoryEntry = {
            id: `hist-${Date.now()}`,
            date: new Date().toISOString(),
            appName: entryName,
            complianceScore: analysisData?.compliance_score ?? 0,
            highCount: analysisData?.risk_summary?.high ?? 0,
            mediumCount: analysisData?.risk_summary?.medium ?? 0,
            lowCount: analysisData?.risk_summary?.low ?? 0,
            result: analysisData
          }
          saveHistory([newEntry, ...history])
        } else {
          // Try to extract text response
          const textResult = result?.response?.message ?? result?.response?.result?.text ?? ''
          if (textResult) {
            setErrorMessage(`Received text response instead of structured data. The agent responded: ${typeof textResult === 'string' ? textResult.slice(0, 500) : 'Unknown format'}`)
          } else {
            setErrorMessage('Received an unexpected response format from the analysis agent.')
          }
        }
      } else {
        setErrorMessage(result?.error ?? 'Analysis failed. Please try again.')
      }
    } catch (err) {
      setActiveAgentId(null)
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsLoading(false)
      setActiveAgentId(null)
    }
  }

  // Export report
  const exportReport = () => {
    const data = analysisResult ?? selectedHistoryEntry?.result
    if (!data) return
    const categories = Array.isArray(data?.categories) ? data.categories : []
    const priorityFixes = Array.isArray(data?.priority_fixes) ? data.priority_fixes : []

    const readinessChecklist = Array.isArray(data?.readiness_checklist) ? data.readiness_checklist : []

    let report = '# App Store Compliance Report - 360 Degree Analysis\n\n'
    report += `**Compliance Score:** ${data?.compliance_score ?? 'N/A'}/100\n`
    report += `**Readiness Status:** ${getReadinessLabel(data?.readiness_status ?? 'unknown')}\n`
    report += `**Generated:** ${new Date().toLocaleString()}\n\n`
    report += `## Risk Summary\n- High: ${data?.risk_summary?.high ?? 0}\n- Medium: ${data?.risk_summary?.medium ?? 0}\n- Low: ${data?.risk_summary?.low ?? 0}\n\n`

    if (readinessChecklist.length > 0) {
      report += '## Pre-Submission Readiness Checklist\n\n'
      report += '| Status | Item | Details |\n|--------|------|---------|\n'
      readinessChecklist.forEach(check => {
        const statusIcon = check?.status === 'pass' ? 'PASS' : check?.status === 'fail' ? 'FAIL' : check?.status === 'warning' ? 'WARN' : 'N/A'
        report += `| ${statusIcon} | ${check?.item ?? ''} | ${check?.details ?? ''} |\n`
      })
      report += '\n'
    }

    if (data?.overall_assessment) {
      report += `## Overall Assessment\n${data.overall_assessment}\n\n`
    }

    report += '## Violations by Category\n\n'
    categories.forEach(cat => {
      report += `### ${cat?.category_name ?? 'Category'}\n`
      report += `${cat?.category_summary ?? ''}\n\n`
      const violations = Array.isArray(cat?.violations) ? cat.violations : []
      violations.forEach(v => {
        report += `#### [${(v?.severity ?? 'unknown').toUpperCase()}] ${v?.title ?? 'Violation'}\n`
        report += `- **Guideline:** ${v?.guideline_reference ?? 'N/A'}\n`
        report += `- **Description:** ${v?.description ?? ''}\n`
        report += `- **Affected Code:** \`${v?.affected_code ?? 'N/A'}\`\n`
        report += `- **Suggested Fix:** ${v?.suggested_fix ?? ''}\n\n`
      })
    })

    if (priorityFixes.length > 0) {
      report += '## Priority Fixes\n\n'
      priorityFixes.forEach(fix => {
        report += `${fix?.priority ?? '-'}. **${fix?.title ?? 'Fix'}** (${fix?.category ?? ''})\n   ${fix?.action ?? ''}\n\n`
      })
    }

    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compliance-report-${new Date().toISOString().slice(0, 10)}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Handle sample data toggle
  const handleSampleToggle = (checked: boolean) => {
    setSampleDataOn(checked)
    if (checked) {
      if (!codeSnippet.trim()) setCodeSnippet('import UIKit\nimport CoreLocation\n\nclass LocationManager: NSObject, CLLocationManagerDelegate {\n    let manager = CLLocationManager()\n    func startTracking() {\n        manager.requestWhenInUseAuthorization()\n        manager.startUpdatingLocation()\n    }\n}')
      if (!appDescription.trim()) setAppDescription('A photo synchronization app that backs up your photos to the cloud, with social sharing features and a premium subscription for unlimited storage.')
      if (!appName.trim()) setAppName('PhotoSync Pro')
      if (!subtitle.trim()) setSubtitle('Photo Backup & Sync - Cloud Storage Photo Manager')
      if (!keywords.trim()) setKeywords('photo, backup, sync, cloud, storage, gallery, share')
      if (!ageRating) setAgeRating('4+')
      if (!analysisResult && !showResults) {
        setAnalysisResult(SAMPLE_RESULT)
        setShowResults(true)
      }
      if (history.length === 0) {
        setHistory(SAMPLE_HISTORY)
      }
    } else {
      setCodeSnippet('')
      setAppDescription('')
      setAppName('')
      setSubtitle('')
      setKeywords('')
      setAgeRating('')
      setAnalysisResult(null)
      setShowResults(false)
      setSelectedHistoryEntry(null)
      setRepoUrl('')
      setRepoFiles([])
      setRepoError('')
      try {
        const saved = localStorage.getItem('compliance_history')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) setHistory(parsed)
          else setHistory([])
        } else {
          setHistory([])
        }
      } catch {
        setHistory([])
      }
    }
  }

  // Handle history entry selection
  const handleSelectHistoryEntry = (entry: HistoryEntry) => {
    setSelectedHistoryEntry(entry)
    setAnalysisResult(entry.result)
    setShowResults(true)
    setActiveView('analysis')
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground flex">
        {/* Sidebar */}
        <SidebarNav activeView={activeView} setActiveView={(v) => { setActiveView(v); if (v !== 'analysis') { setShowResults(false); setSelectedHistoryEntry(null) } }} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Top Bar */}
          <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold tracking-tight">
                {activeView === 'analysis' && 'Compliance Analysis'}
                {activeView === 'history' && 'Analysis History'}
                {activeView === 'guidelines' && 'Guidelines Reference'}
              </h2>
              {activeAgentId && (
                <div className="flex items-center gap-1.5 text-xs text-primary">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_6px_hsl(265,89%,72%,0.5)]" />
                  Agent Active
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">Sample Data</Label>
              <Switch id="sample-toggle" checked={sampleDataOn} onCheckedChange={handleSampleToggle} />
            </div>
          </header>

          {/* Content Area */}
          <ScrollArea className="flex-1">
            <div className="max-w-5xl mx-auto p-6">
              {/* Analysis View */}
              {activeView === 'analysis' && (
                <>
                  {showResults && analysisResult ? (
                    <ResultsDashboard result={analysisResult} onExport={exportReport} onBack={() => { setShowResults(false); setAnalysisResult(null); setSelectedHistoryEntry(null) }} />
                  ) : isLoading ? (
                    <AnalysisLoadingSkeleton />
                  ) : (
                    <div className="space-y-6">
                      {/* Welcome / Input Form */}
                      <div className="text-center mb-2">
                        <div className="inline-flex p-2.5 rounded-xl bg-primary/10 shadow-[0_0_20px_hsl(265,89%,72%,0.2)] mb-3">
                          <VscShield className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight mb-1">App Store Compliance Analyzer</h2>
                        <p className="text-sm text-muted-foreground max-w-lg mx-auto">Import a GitHub repo, paste your code, describe your app, and check for App Store guideline violations before submitting for review.</p>
                      </div>

                      {/* GitHub Repo Import */}
                      <Card className="border-border shadow-lg overflow-hidden">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <VscRepoForked className="w-4 h-4 text-primary" /> Import from GitHub
                          </CardTitle>
                          <CardDescription className="text-xs">Provide a public GitHub repository URL to automatically fetch and analyze iOS source files.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex gap-2">
                            <Input
                              value={repoUrl}
                              onChange={(e) => setRepoUrl(e.target.value)}
                              placeholder="https://github.com/owner/repo"
                              className="bg-[hsl(231,18%,12%)] border-border text-sm font-mono flex-1"
                              onKeyDown={(e) => { if (e.key === 'Enter' && !isFetchingRepo) fetchRepoFiles() }}
                              disabled={isFetchingRepo}
                            />
                            <Button
                              onClick={fetchRepoFiles}
                              disabled={isFetchingRepo || !repoUrl.trim()}
                              variant="outline"
                              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                            >
                              {isFetchingRepo ? (
                                <><div className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" /> Fetching</>
                              ) : (
                                <><VscRepoForked className="w-3.5 h-3.5" /> Fetch Repo</>
                              )}
                            </Button>
                          </div>

                          {/* Fetch status */}
                          {isFetchingRepo && repoFetchStatus && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
                              <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                              <span className="truncate">{repoFetchStatus}</span>
                            </div>
                          )}

                          {/* Repo error */}
                          {repoError && (
                            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                              <VscError className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span>{repoError}</span>
                              <button onClick={() => setRepoError('')} className="ml-auto shrink-0 hover:text-destructive/80">
                                <VscClose className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {/* Fetched files list */}
                          {repoFiles.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <VscCheck className="w-3.5 h-3.5 text-accent" />
                                  <span className="text-xs font-semibold text-accent">{repoFiles.length} file{repoFiles.length !== 1 ? 's' : ''} fetched and loaded into code input</span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={clearRepoFiles} className="text-muted-foreground hover:text-destructive h-7 gap-1 text-xs">
                                  <VscTrash className="w-3 h-3" /> Clear All
                                </Button>
                              </div>
                              <div className="bg-[hsl(231,18%,12%)] border border-border rounded-lg divide-y divide-border/50 max-h-48 overflow-y-auto">
                                {repoFiles.map((file) => (
                                  <div key={file.path} className="flex items-center gap-2 px-3 py-1.5 text-xs group hover:bg-secondary/20 transition-colors">
                                    <VscFile className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-mono text-foreground/80 truncate flex-1">{file.path}</span>
                                    <span className="text-muted-foreground/50 text-[10px] shrink-0">{(file.size / 1024).toFixed(1)}KB</span>
                                    <button
                                      onClick={() => removeRepoFile(file.path)}
                                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                                    >
                                      <VscClose className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <p className="text-[10px] text-muted-foreground/60">
                                Files have been appended to the Code Snippets field below. You can remove individual files or edit the code directly.
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Error */}
                      {errorMessage && (
                        <Card className="border-destructive/50 bg-destructive/5">
                          <CardContent className="p-4 flex items-start gap-3">
                            <VscError className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm text-destructive font-medium">Analysis Error</p>
                              <p className="text-xs text-destructive/80 mt-1">{errorMessage}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setErrorMessage('')} className="text-destructive/60 hover:text-destructive shrink-0">
                              <VscClose className="w-4 h-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      )}

                      {/* Code Input */}
                      <Card className="border-border shadow-lg">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <VscCode className="w-4 h-4 text-primary" /> Code Snippets
                          </CardTitle>
                          <CardDescription className="text-xs">Paste Swift, Objective-C, or relevant code snippets for analysis.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Textarea value={codeSnippet} onChange={(e) => setCodeSnippet(e.target.value)} placeholder="// Paste your Swift or Objective-C code here&#10;import UIKit&#10;&#10;class ViewController: UIViewController {&#10;    // ..." className="min-h-[180px] font-mono text-xs bg-[hsl(231,18%,12%)] border-border resize-y" />
                        </CardContent>
                      </Card>

                      {/* App Description */}
                      <Card className="border-border shadow-lg">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <HiOutlineInformationCircle className="w-4 h-4 text-primary" /> App Description
                          </CardTitle>
                          <CardDescription className="text-xs">Describe what your app does, its features, and target audience.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Textarea value={appDescription} onChange={(e) => setAppDescription(e.target.value)} placeholder="Describe your app's functionality, features, and purpose..." className="min-h-[100px] text-sm bg-card border-border resize-y" />
                        </CardContent>
                      </Card>

                      {/* Metadata Fields */}
                      <Card className="border-border shadow-lg">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <VscShield className="w-4 h-4 text-primary" /> App Metadata
                          </CardTitle>
                          <CardDescription className="text-xs">Provide App Store listing metadata for compliance checks.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">App Name</Label>
                              <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="My Awesome App" className="bg-card border-border text-sm" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Subtitle</Label>
                              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="A brief tagline for your app" className="bg-card border-border text-sm" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Keywords</Label>
                              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="keyword1, keyword2, keyword3" className="bg-card border-border text-sm" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Age Rating</Label>
                              <Select value={ageRating} onValueChange={setAgeRating}>
                                <SelectTrigger className="bg-card border-border text-sm">
                                  <SelectValue placeholder="Select age rating" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="4+">4+</SelectItem>
                                  <SelectItem value="9+">9+</SelectItem>
                                  <SelectItem value="12+">12+</SelectItem>
                                  <SelectItem value="17+">17+</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Category Toggles */}
                      <Card className="border-border shadow-lg">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <VscFilter className="w-4 h-4 text-primary" /> Focus Areas
                          </CardTitle>
                          <CardDescription className="text-xs">Optionally narrow the analysis to specific guideline categories.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {selectedCategories.map((cat) => (
                              <label key={cat.id} className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${cat.checked ? 'border-primary/50 bg-primary/5 shadow-[0_0_10px_hsl(265,89%,72%,0.1)]' : 'border-border hover:border-border/80 bg-card'}`}>
                                <Checkbox checked={cat.checked} onCheckedChange={() => toggleCategory(cat.id)} className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                                <span className="text-xs font-medium">{cat.name}</span>
                              </label>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* 360 Deep Scan Toggle */}
                      <Card className={`border shadow-lg transition-all duration-300 ${deepScan ? 'border-primary/40 shadow-[0_0_20px_hsl(265,89%,72%,0.15)]' : 'border-border'}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg transition-all duration-300 ${deepScan ? 'bg-primary/15 shadow-[0_0_12px_hsl(265,89%,72%,0.2)]' : 'bg-secondary/50'}`}>
                                <VscVerified className={`w-5 h-5 transition-colors duration-300 ${deepScan ? 'text-primary' : 'text-muted-foreground'}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold tracking-tight">360-Degree Deep Scan</p>
                                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider font-bold ${deepScan ? 'text-primary border-primary/40' : 'text-muted-foreground border-border'}`}>
                                    {deepScan ? 'ON' : 'OFF'}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {deepScan
                                    ? 'Exhaustive analysis covering all possible rejection vectors with pre-submission readiness checklist.'
                                    : 'Standard compliance check against core App Store guidelines.'}
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={deepScan}
                              onCheckedChange={setDeepScan}
                              className="data-[state=checked]:bg-primary"
                            />
                          </div>
                          {deepScan && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                  { label: 'Privacy & ATT', icon: <VscShield className="w-3 h-3" /> },
                                  { label: 'Accessibility', icon: <VscInfo className="w-3 h-3" /> },
                                  { label: 'Security & ATS', icon: <VscVerified className="w-3 h-3" /> },
                                  { label: 'Background Modes', icon: <VscCode className="w-3 h-3" /> },
                                  { label: 'Sign in with Apple', icon: <HiOutlineShieldCheck className="w-3 h-3" /> },
                                  { label: 'StoreKit Compliance', icon: <VscFilter className="w-3 h-3" /> },
                                  { label: 'Crash Safety', icon: <VscWarning className="w-3 h-3" /> },
                                  { label: 'Readiness Checklist', icon: <VscCheck className="w-3 h-3" /> },
                                ].map((item, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary/30 rounded-md px-2 py-1.5">
                                    <span className="text-primary">{item.icon}</span>
                                    {item.label}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Run Button */}
                      <div className="flex justify-center pt-2">
                        <Button onClick={runAnalysis} disabled={isLoading} size="lg" className={`gap-2 px-8 transition-all duration-300 ${deepScan ? 'shadow-[0_0_25px_hsl(265,89%,72%,0.4)] hover:shadow-[0_0_35px_hsl(265,89%,72%,0.6)]' : 'shadow-[0_0_20px_hsl(265,89%,72%,0.3)] hover:shadow-[0_0_30px_hsl(265,89%,72%,0.5)]'}`}>
                          {deepScan ? <VscVerified className="w-4 h-4" /> : <VscPlay className="w-4 h-4" />}
                          {deepScan ? 'Run 360 Deep Scan' : 'Run Compliance Check'}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* History View */}
              {activeView === 'history' && (
                <HistoryView history={sampleDataOn && history.length === 0 ? SAMPLE_HISTORY : history} onSelectEntry={handleSelectHistoryEntry} searchQuery={historySearchQuery} setSearchQuery={setHistorySearchQuery} />
              )}

              {/* Guidelines View */}
              {activeView === 'guidelines' && (
                <GuidelinesView />
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </ErrorBoundary>
  )
}
