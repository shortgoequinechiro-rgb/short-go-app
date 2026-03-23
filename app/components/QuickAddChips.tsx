'use client'

import { useState } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// QUICK ADD CHIP DATA
// ═══════════════════════════════════════════════════════════════════════════

export type ChipCategory = {
  groupLabel: string
  chips: { id: string; label: string; output: string }[]
}

// ── SUBJECTIVE CHIPS ──
export const SUBJECTIVE_CHIPS: ChipCategory[] = [
  {
    groupLabel: 'Visit Type',
    chips: [
      { id: 'sub_routine', label: 'Routine maintenance', output: 'routine maintenance' },
      { id: 'sub_perf', label: 'Performance check', output: 'performance evaluation' },
      { id: 'sub_new', label: 'New complaint', output: 'a new complaint' },
      { id: 'sub_postcomp', label: 'Post-competition', output: 'post-competition evaluation' },
      { id: 'sub_followup', label: 'Follow-up visit', output: 'follow-up evaluation' },
    ],
  },
  {
    groupLabel: 'Symptoms',
    chips: [
      { id: 'sub_stiff', label: 'Stiffness noted', output: 'noted stiffness' },
      { id: 'sub_decflex', label: 'Decreased flexibility', output: 'decreased flexibility' },
      { id: 'sub_bendl', label: 'Difficulty bending left', output: 'difficulty bending left' },
      { id: 'sub_bendr', label: 'Difficulty bending right', output: 'difficulty bending right' },
      { id: 'sub_lead', label: 'Trouble picking up lead', output: 'trouble picking up lead' },
      { id: 'sub_short', label: 'Short striding', output: 'short striding' },
      { id: 'sub_resist', label: 'Behavioral resistance', output: 'behavioral resistance under saddle' },
      { id: 'sub_decperf', label: 'Decreased performance', output: 'decreased performance' },
    ],
  },
  {
    groupLabel: 'Recent Changes',
    chips: [
      { id: 'sub_travel', label: 'Recent travel', output: 'following recent travel' },
      { id: 'sub_workload', label: 'Increased workload', output: 'with increased workload' },
      { id: 'sub_timeoff', label: 'Time off prior', output: 'after time off' },
      { id: 'sub_training', label: 'Change in training', output: 'with a change in training intensity' },
    ],
  },
  {
    groupLabel: 'Owner Input',
    chips: [
      { id: 'sub_improved', label: 'Owner reports improvement', output: 'Owner reports improvement since last visit' },
      { id: 'sub_noconcern', label: 'No major concerns', output: 'Owner reports no major concerns' },
      { id: 'sub_backsore', label: 'Concerned about back', output: 'Owner concerned about back soreness' },
      { id: 'sub_hind', label: 'Concerned about hind end', output: 'Owner concerned about hind end' },
    ],
  },
]

// ── OBJECTIVE CHIPS ──
export const OBJECTIVE_CHIPS: ChipCategory[] = [
  {
    groupLabel: 'Palpation Findings',
    chips: [
      { id: 'obj_restricted', label: 'Restricted', output: 'restriction' },
      { id: 'obj_hypertonic', label: 'Hypertonic', output: 'hypertonicity' },
      { id: 'obj_tender', label: 'Tender', output: 'tenderness' },
      { id: 'obj_reactive', label: 'Reactive', output: 'reactivity to palpation' },
      { id: 'obj_tightness', label: 'Muscle tightness', output: 'muscular tightness' },
      { id: 'obj_decmob', label: 'Decreased mobility', output: 'decreased segmental mobility' },
    ],
  },
  {
    groupLabel: 'Motion Findings',
    chips: [
      { id: 'obj_decflex', label: 'Decreased flexion', output: 'decreased flexion' },
      { id: 'obj_decext', label: 'Decreased extension', output: 'decreased extension' },
      { id: 'obj_decrom', label: 'Reduced ROM', output: 'reduced range of motion' },
      { id: 'obj_asymmetry', label: 'Asymmetrical movement', output: 'asymmetrical movement' },
      { id: 'obj_shortstride', label: 'Shortened stride', output: 'shortened stride length' },
      { id: 'obj_guarded', label: 'Guarded movement', output: 'guarded movement patterns' },
    ],
  },
  {
    groupLabel: 'Patterns',
    chips: [
      { id: 'obj_comp', label: 'Compensation pattern', output: 'compensation pattern present' },
      { id: 'obj_pelvic', label: 'Pelvic asymmetry', output: 'pelvic asymmetry' },
      { id: 'obj_hindrestrict', label: 'Hind-end restriction', output: 'hind-end restriction' },
      { id: 'obj_thoracolumbar', label: 'Thoracolumbar tension', output: 'thoracolumbar tension' },
      { id: 'obj_cervrestrict', label: 'Cervical restriction', output: 'cervical restriction' },
    ],
  },
  {
    groupLabel: 'Response',
    chips: [
      { id: 'obj_improvedpost', label: 'Improved post-adjustment', output: 'improved mobility post-adjustment' },
      { id: 'obj_incmob', label: 'Increased mobility', output: 'increased mobility post-treatment' },
      { id: 'obj_dectension', label: 'Decreased tension', output: 'decreased tension post-treatment' },
    ],
  },
]

// ── ASSESSMENT CHIPS ──
export const ASSESSMENT_CHIPS: ChipCategory[] = [
  {
    groupLabel: 'Core Assessment',
    chips: [
      { id: 'asx_segdys', label: 'Segmental dysfunction', output: 'segmental dysfunction' },
      { id: 'asx_spinerestrict', label: 'Spinal restriction', output: 'spinal restriction' },
      { id: 'asx_redmob', label: 'Reduced mobility', output: 'reduced spinal mobility' },
      { id: 'asx_funclimit', label: 'Functional limitation', output: 'functional limitation' },
    ],
  },
  {
    groupLabel: 'Patterns',
    chips: [
      { id: 'asx_comp', label: 'Compensation pattern', output: 'compensatory tension pattern' },
      { id: 'asx_perfrestrict', label: 'Performance restriction', output: 'performance-related restriction' },
      { id: 'asx_pelvimbal', label: 'Pelvic imbalance', output: 'pelvic imbalance' },
      { id: 'asx_thoracodys', label: 'Thoracolumbar dysfunction', output: 'thoracolumbar dysfunction' },
      { id: 'asx_cervdys', label: 'Cervical dysfunction', output: 'cervical dysfunction' },
    ],
  },
  {
    groupLabel: 'Case Type',
    chips: [
      { id: 'asx_maint', label: 'Maintenance care', output: 'maintenance care' },
      { id: 'asx_acute', label: 'Acute presentation', output: 'acute presentation' },
      { id: 'asx_chronic', label: 'Chronic pattern', output: 'chronic recurring pattern' },
      { id: 'asx_improving', label: 'Improving as expected', output: 'improving as expected' },
    ],
  },
]

// ── PLAN CHIPS ──
export const PLAN_CHIPS: ChipCategory[] = [
  {
    groupLabel: 'Adjustments Performed',
    chips: [
      { id: 'plan_cerv', label: 'Cervical adjusted', output: 'cervical' },
      { id: 'plan_thor', label: 'Thoracic adjusted', output: 'thoracic' },
      { id: 'plan_lumb', label: 'Lumbar adjusted', output: 'lumbar' },
      { id: 'plan_pelv', label: 'Pelvis/SI adjusted', output: 'pelvic/SI' },
    ],
  },
  {
    groupLabel: 'Recommendations',
    chips: [
      { id: 'plan_light', label: 'Light work', output: 'Light work is recommended' },
      { id: 'plan_resume', label: 'Resume normal activity', output: 'Normal activity may be resumed' },
      { id: 'plan_rest', label: 'Rest recommended', output: 'Rest is recommended' },
      { id: 'plan_gradual', label: 'Gradual return', output: 'Gradual return to work is recommended' },
      { id: 'plan_stretch', label: 'Stretching recommended', output: 'Stretching exercises are recommended' },
      { id: 'plan_softtissue', label: 'Soft tissue work', output: 'Soft tissue work was performed' },
      { id: 'plan_mobilityex', label: 'Mobility exercises', output: 'Mobility exercises are advised' },
    ],
  },
  {
    groupLabel: 'Follow-Up',
    chips: [
      { id: 'plan_2wk', label: '2 weeks', output: 're-evaluation in 2 weeks' },
      { id: 'plan_3wk', label: '3–4 weeks', output: 're-evaluation in 3–4 weeks' },
      { id: 'plan_monthly', label: 'Monthly maintenance', output: 'monthly maintenance schedule' },
      { id: 'plan_prn', label: 'PRN follow-up', output: 'follow-up on a PRN basis' },
    ],
  },
]


// ═══════════════════════════════════════════════════════════════════════════
// SENTENCE BUILDER LOGIC
// ═══════════════════════════════════════════════════════════════════════════

function joinList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1]
}

/**
 * Build a Subjective sentence from selected chip IDs
 */
export function buildSubjectiveSentence(selectedIds: Set<string>): string {
  if (selectedIds.size === 0) return ''

  const allChips = SUBJECTIVE_CHIPS.flatMap(c => c.chips)
  const selected = allChips.filter(c => selectedIds.has(c.id))

  // Split into categories
  const visitType = selected.filter(c => c.id.startsWith('sub_') && ['sub_routine', 'sub_perf', 'sub_new', 'sub_postcomp', 'sub_followup'].includes(c.id))
  const symptoms = selected.filter(c => ['sub_stiff', 'sub_decflex', 'sub_bendl', 'sub_bendr', 'sub_lead', 'sub_short', 'sub_resist', 'sub_decperf'].includes(c.id))
  const changes = selected.filter(c => ['sub_travel', 'sub_workload', 'sub_timeoff', 'sub_training'].includes(c.id))
  const ownerInput = selected.filter(c => ['sub_improved', 'sub_noconcern', 'sub_backsore', 'sub_hind'].includes(c.id))

  const parts: string[] = []

  // Visit context
  if (visitType.length > 0) {
    parts.push(`Horse presented for ${visitType[0].output}`)
  }

  // Symptoms
  if (symptoms.length > 0) {
    const symptomStr = joinList(symptoms.map(s => s.output))
    if (parts.length > 0) {
      parts[0] += ` with ${symptomStr}`
    } else {
      parts.push(`Horse presented with ${symptomStr}`)
    }
  }

  // Recent changes
  if (changes.length > 0) {
    const lastPart = parts[parts.length - 1] || ''
    if (lastPart) {
      parts[parts.length - 1] = lastPart + ' ' + changes.map(c => c.output).join(' and ')
    } else {
      parts.push(changes.map(c => c.output).join(' and '))
    }
  }

  // Finish first sentence
  if (parts.length > 0) {
    parts[0] = parts[0] + '.'
  }

  // Owner input as separate sentence
  if (ownerInput.length > 0) {
    parts.push(ownerInput.map(o => o.output).join('. ') + '.')
  }

  return parts.join(' ')
}

/**
 * Build an Objective sentence from selected chip IDs + spine region summary
 */
export function buildObjectiveSentence(selectedIds: Set<string>, spineRegionSummary?: string): string {
  if (selectedIds.size === 0 && !spineRegionSummary) return ''

  const allChips = OBJECTIVE_CHIPS.flatMap(c => c.chips)
  const selected = allChips.filter(c => selectedIds.has(c.id))

  const findings = selected.filter(c => ['obj_restricted', 'obj_hypertonic', 'obj_tender', 'obj_reactive', 'obj_tightness', 'obj_decmob'].includes(c.id))
  const motion = selected.filter(c => ['obj_decflex', 'obj_decext', 'obj_decrom', 'obj_asymmetry', 'obj_shortstride', 'obj_guarded'].includes(c.id))
  const patterns = selected.filter(c => ['obj_comp', 'obj_pelvic', 'obj_hindrestrict', 'obj_thoracolumbar', 'obj_cervrestrict'].includes(c.id))
  const response = selected.filter(c => ['obj_improvedpost', 'obj_incmob', 'obj_dectension'].includes(c.id))

  const sentences: string[] = []

  // Palpation findings
  if (findings.length > 0) {
    const findingsStr = joinList(findings.map(f => f.output))
    if (spineRegionSummary) {
      sentences.push(`Palpation revealed ${findingsStr} throughout the ${spineRegionSummary}.`)
    } else {
      sentences.push(`Palpation revealed ${findingsStr}.`)
    }
  } else if (spineRegionSummary) {
    sentences.push(`Findings noted in the ${spineRegionSummary}.`)
  }

  // Motion findings
  if (motion.length > 0) {
    sentences.push(joinList(motion.map(m => m.output.charAt(0).toUpperCase() + m.output.slice(1))) + ' observed.')
  }

  // Patterns
  if (patterns.length > 0) {
    sentences.push(joinList(patterns.map(p => p.output.charAt(0).toUpperCase() + p.output.slice(1))) + ' noted.')
  }

  // Response
  if (response.length > 0) {
    sentences.push(joinList(response.map(r => r.output.charAt(0).toUpperCase() + r.output.slice(1))) + '.')
  }

  return sentences.join(' ')
}

/**
 * Build an Assessment sentence from selected chip IDs
 */
export function buildAssessmentSentence(selectedIds: Set<string>): string {
  if (selectedIds.size === 0) return ''

  const allChips = ASSESSMENT_CHIPS.flatMap(c => c.chips)
  const selected = allChips.filter(c => selectedIds.has(c.id))

  const core = selected.filter(c => ['asx_segdys', 'asx_spinerestrict', 'asx_redmob', 'asx_funclimit'].includes(c.id))
  const patterns = selected.filter(c => ['asx_comp', 'asx_perfrestrict', 'asx_pelvimbal', 'asx_thoracodys', 'asx_cervdys'].includes(c.id))
  const caseType = selected.filter(c => ['asx_maint', 'asx_acute', 'asx_chronic', 'asx_improving'].includes(c.id))

  const sentences: string[] = []

  if (core.length > 0 || patterns.length > 0) {
    const all = [...core, ...patterns]
    sentences.push(`Findings are consistent with ${joinList(all.map(a => a.output))}.`)
  }

  if (caseType.length > 0) {
    // Capitalize first
    const typeStr = caseType.map(c => c.output).join('; ')
    sentences.push(`Presentation consistent with ${typeStr}.`)
  }

  return sentences.join(' ')
}

/**
 * Build a Plan sentence from selected chip IDs
 */
export function buildPlanSentence(selectedIds: Set<string>): string {
  if (selectedIds.size === 0) return ''

  const allChips = PLAN_CHIPS.flatMap(c => c.chips)
  const selected = allChips.filter(c => selectedIds.has(c.id))

  const adjustments = selected.filter(c => ['plan_cerv', 'plan_thor', 'plan_lumb', 'plan_pelv'].includes(c.id))
  const recs = selected.filter(c => ['plan_light', 'plan_resume', 'plan_rest', 'plan_gradual', 'plan_stretch', 'plan_softtissue', 'plan_mobilityex'].includes(c.id))
  const followup = selected.filter(c => ['plan_2wk', 'plan_3wk', 'plan_monthly', 'plan_prn'].includes(c.id))

  const sentences: string[] = []

  if (adjustments.length > 0) {
    sentences.push(`Chiropractic adjustments were performed to the ${joinList(adjustments.map(a => a.output))} region${adjustments.length > 1 ? 's' : ''}.`)
  }

  if (recs.length > 0) {
    sentences.push(recs.map(r => r.output).join('. ') + '.')
  }

  if (followup.length > 0) {
    sentences.push(`Recommended ${joinList(followup.map(f => f.output))}.`)
  }

  return sentences.join(' ')
}


// ═══════════════════════════════════════════════════════════════════════════
// QUICK ADD CHIPS UI COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

type QuickAddChipsSectionProps = {
  categories: ChipCategory[]
  selectedIds: Set<string>
  onToggle: (chipId: string) => void
  onClearSection: () => void
  generatedText: string
  onFill: () => void
  sectionLabel: string
}

export function QuickAddChipsSection({
  categories,
  selectedIds,
  onToggle,
  onClearSection,
  generatedText,
  onFill,
  sectionLabel,
}: QuickAddChipsSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const hasSelections = selectedIds.size > 0

  // Show first group always, rest behind "More"
  const visibleCategories = expanded ? categories : categories.slice(0, 1)
  const hasMore = categories.length > 1

  return (
    <div className="mt-2 space-y-2">
      {/* Chip groups */}
      <div className="space-y-2">
        {visibleCategories.map((cat) => (
          <div key={cat.groupLabel}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {cat.groupLabel}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cat.chips.map((chip) => {
                const isSelected = selectedIds.has(chip.id)
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => onToggle(chip.id)}
                    className={[
                      'rounded-lg border px-2.5 py-1 text-xs font-medium transition',
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    {chip.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* More / Less toggle */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-slate-500 hover:text-slate-700 transition"
        >
          {expanded ? '− Less options' : `+ More ${sectionLabel.toLowerCase()} options`}
        </button>
      )}

      {/* Generate & Clear row */}
      {hasSelections && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onFill}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-sm"
          >
            Fill from selections
          </button>
          <button
            type="button"
            onClick={onClearSection}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition"
          >
            Clear {sectionLabel}
          </button>
          {generatedText && (
            <p className="text-[10px] text-slate-400 italic truncate max-w-[200px]">
              Preview: {generatedText.slice(0, 60)}…
            </p>
          )}
        </div>
      )}
    </div>
  )
}
