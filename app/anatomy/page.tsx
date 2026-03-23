'use client'

import Link from 'next/link'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, Html, Center } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { supabase } from '../lib/supabase'

type LayerState = {
  Skin: boolean
  Muscles: boolean
  Skeleton: boolean
  Nerves: boolean
  Vascular: boolean
  Lymphatic: boolean
  Organs: boolean
  Cartilage: boolean
}

type LandmarkKey =
  | 'pollAtlas'
  | 'withers'
  | 'thoracolumbar'
  | 'siJoint'
  | 'hock'

type LandmarkInfo = {
  key: LandmarkKey
  title: string
  subtitle: string
  clinical: string
  ownerFriendly: string
  layers: LayerState
  position: [number, number, number]
}

type DrawMode = 'none' | 'pen' | 'circle' | 'arrow' | 'text'

type TextInput = {
  x: number      // canvas pixel position
  y: number
  cssX: number   // CSS overlay position for the <input>
  cssY: number
  value: string
}

const NOTES_STORAGE_KEY = 'shortgo_anatomy_region_notes'
const CENTER_TARGET: [number, number, number] = [0, 0, 0]
const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 0.25, 3.0]

const INITIAL_LAYERS: LayerState = {
  Skin: false,
  Muscles: true,
  Skeleton: false,
  Nerves: false,
  Vascular: false,
  Lymphatic: false,
  Organs: false,
  Cartilage: false,
}

const LANDMARKS: Record<LandmarkKey, LandmarkInfo> = {
  pollAtlas: {
    key: 'pollAtlas',
    title: 'Poll / Atlas',
    subtitle: 'Upper cervical region',
    clinical:
      'Useful for evaluating upper cervical alignment, poll tension, and nerve-related compensation patterns around the head and neck junction.',
    ownerFriendly:
      'This is the top of the neck right behind the head. Restrictions here can affect comfort, head carriage, and overall movement.',
    layers: {
      Skin: false,
      Muscles: false,
      Skeleton: true,
      Nerves: true,
      Vascular: false,
      Lymphatic: false,
      Organs: false,
      Cartilage: false,
    },
    position: [3.0, 0.9, 0],
  },
  withers: {
    key: 'withers',
    title: 'Withers',
    subtitle: 'Cranial thoracic region',
    clinical:
      'Helpful for visualizing the thoracic spine, surrounding musculature, and common compensation patterns tied to saddle pressure and front-end restriction.',
    ownerFriendly:
      'The withers are the high point at the base of the neck. Tightness here can affect saddle comfort and shoulder movement.',
    layers: {
      Skin: false,
      Muscles: true,
      Skeleton: true,
      Nerves: false,
      Vascular: false,
      Lymphatic: false,
      Organs: false,
      Cartilage: false,
    },
    position: [2.9, 0.55, 0],
  },
  thoracolumbar: {
    key: 'thoracolumbar',
    title: 'Thoracolumbar',
    subtitle: 'Mid-back to lumbar junction',
    clinical:
      'Useful for assessing transition zones through the back where performance horses often develop stiffness, soreness, or compensatory loading.',
    ownerFriendly:
      'This is the working part of the back where a lot of motion and load transfer happens. Restrictions here can affect topline and performance.',
    layers: {
      Skin: false,
      Muscles: true,
      Skeleton: true,
      Nerves: false,
      Vascular: false,
      Lymphatic: false,
      Organs: false,
      Cartilage: false,
    },
    position: [2.8, 0.25, 0],
  },
  siJoint: {
    key: 'siJoint',
    title: 'SI Joint',
    subtitle: 'Sacroiliac region',
    clinical:
      'Important for evaluating hind-end drive, pelvic balance, and common compensation patterns that influence stride length and push from behind.',
    ownerFriendly:
      'This area connects the spine and pelvis. Restrictions here can affect impulsion, hind-end comfort, and willingness to work.',
    layers: {
      Skin: false,
      Muscles: true,
      Skeleton: true,
      Nerves: false,
      Vascular: false,
      Lymphatic: false,
      Organs: false,
      Cartilage: false,
    },
    position: [2.7, 0.0, 0],
  },
  hock: {
    key: 'hock',
    title: 'Hock',
    subtitle: 'Distal hind limb joint complex',
    clinical:
      'Useful for demonstrating the relationship between the lower hind limb, joint mechanics, and cartilage-supported movement through the hock.',
    ownerFriendly:
      'The hock is a major joint in the hind leg. Issues here can influence push-off, stopping, turning, and overall hind-end comfort.',
    layers: {
      Skin: false,
      Muscles: false,
      Skeleton: true,
      Nerves: false,
      Vascular: false,
      Lymphatic: false,
      Organs: false,
      Cartilage: true,
    },
    position: [2.6, -0.15, 0],
  },
}

// ── Drawing helpers ────────────────────────────────────────────────────────────

function drawArrowOnCtx(
  ctx: CanvasRenderingContext2D,
  fromX: number, fromY: number,
  toX: number, toY: number,
  color: string,
  width: number
) {
  const headLen = Math.max(18, width * 5)
  const angle = Math.atan2(toY - fromY, toX - fromX)

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Shaft
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()

  // Arrowhead
  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(
    toX - headLen * Math.cos(angle - Math.PI / 6),
    toY - headLen * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    toX - headLen * Math.cos(angle + Math.PI / 6),
    toY - headLen * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
}

// ── 3D scene components ────────────────────────────────────────────────────────

function HorseModel({ layers }: { layers: LayerState }) {
  const { scene } = useGLTF('/models/horse_anatomy_final.glb')
  const clonedScene = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    clonedScene.traverse((child: any) => {
      if (!child?.name) return
      const name = child.name.trim()
      if (name === 'Skin') child.visible = layers.Skin
      if (name === 'Muscles') child.visible = layers.Muscles
      if (name === 'Skeleton') child.visible = layers.Skeleton
      if (name === 'Nerves') child.visible = layers.Nerves
      if (name === 'Vascular') child.visible = layers.Vascular
      if (name === 'Lymphatic') child.visible = layers.Lymphatic
      if (name === 'Organs') child.visible = layers.Organs
      if (name === 'Cartilage') child.visible = layers.Cartilage
    })
  }, [clonedScene, layers])

  return (
    <group>
      <primitive object={clonedScene} scale={2.5} />
    </group>
  )
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow">
        Loading anatomy model...
      </div>
    </Html>
  )
}

function LayerButton({
  label,
  active,
  onClick,
}: {
  label: keyof LayerState
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )
}

function ViewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-50"
    >
      {label}
    </button>
  )
}

function CameraAnimator({
  controlsRef,
  desiredPosition,
  isAnimating,
  setIsAnimating,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  desiredPosition: [number, number, number]
  isAnimating: boolean
  setIsAnimating: (value: boolean) => void
}) {
  const targetPosition = useMemo(
    () => new THREE.Vector3(...desiredPosition),
    [desiredPosition]
  )
  const centerTarget = useMemo(() => new THREE.Vector3(...CENTER_TARGET), [])

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls || !isAnimating) return

    controls.object.position.lerp(targetPosition, 0.12)
    controls.target.lerp(centerTarget, 0.12)
    controls.update()

    const positionDone = controls.object.position.distanceTo(targetPosition) < 0.02
    const targetDone = controls.target.distanceTo(centerTarget) < 0.02

    if (positionDone && targetDone) {
      controls.object.position.copy(targetPosition)
      controls.target.copy(centerTarget)
      controls.update()
      setIsAnimating(false)
    }
  })

  return null
}

// ── Draw tool color swatch ────────────────────────────────────────────────────

const DRAW_COLORS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f59e0b', label: 'Yellow' },
  { value: '#ffffff', label: 'White' },
  { value: '#1e293b', label: 'Black' },
]

// ── Main content ──────────────────────────────────────────────────────────────

function AnatomyContent() {
  const searchParams = useSearchParams()
  const visitId = searchParams.get('visitId') || ''
  const horseName = searchParams.get('horseName') || ''

  const [horseId, setHorseId] = useState('')
  const [loadingHorseLink, setLoadingHorseLink] = useState(true)

  const [layers, setLayers] = useState<LayerState>(INITIAL_LAYERS)
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkInfo | null>(null)
  const [notesByLandmark, setNotesByLandmark] = useState<Record<string, string>>({})
  const [noteDraft, setNoteDraft] = useState('')
  const [noteMessage, setNoteMessage] = useState('')
  const [loadingVisitNotes, setLoadingVisitNotes] = useState(false)

  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [desiredPosition, setDesiredPosition] = useState<[number, number, number]>(DEFAULT_CAMERA_POSITION)
  const [isAnimating, setIsAnimating] = useState(false)

  // ── Drawing state ────────────────────────────────────────────────────────────
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [drawMode, setDrawMode] = useState<DrawMode>('none')
  const [drawColor, setDrawColor] = useState('#ef4444')
  const [drawSize, setDrawSize] = useState(3)
  const isDrawingRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const snapshotRef = useRef<ImageData | null>(null)
  const historyRef = useRef<ImageData[]>([])

  // Text annotation state
  const [activeText, setActiveText] = useState<TextInput | null>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const [fontSize, setFontSize] = useState(22)

  // Sync overlay canvas dimensions to its CSS size
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas) return

    function syncSize() {
      if (!canvas) return
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // Helper: canvas-relative coordinates
  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = overlayRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function pushHistory() {
    const canvas = overlayRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height)
    historyRef.current.push(snap)
    if (historyRef.current.length > 30) historyRef.current.shift()
  }

  function undo() {
    setActiveText(null) // discard any uncommitted text
    const canvas = overlayRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    const prev = historyRef.current.pop()
    if (prev) ctx.putImageData(prev, 0, 0)
    else ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  function clearOverlay() {
    setActiveText(null)
    const canvas = overlayRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    pushHistory()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  function onOverlayMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (drawMode === 'none') return

    // Text mode: place a text input at the clicked position
    if (drawMode === 'text') {
      if (activeText) { commitText(activeText) }
      const pos = getPos(e)
      const canvas = overlayRef.current!
      const rect = canvas.getBoundingClientRect()
      // cssX/Y are used for positioning the <input> element in CSS space
      const cssX = e.clientX - rect.left
      const cssY = e.clientY - rect.top
      setActiveText({ x: pos.x, y: pos.y, cssX, cssY, value: '' })
      setTimeout(() => textInputRef.current?.focus(), 0)
      return
    }

    pushHistory()
    const pos = getPos(e)
    isDrawingRef.current = true
    startPosRef.current = pos

    const canvas = overlayRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)

    if (drawMode === 'pen') {
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }
  }

  function onOverlayMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || drawMode === 'none') return
    const pos = getPos(e)
    const canvas = overlayRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    ctx.strokeStyle = drawColor
    ctx.fillStyle = drawColor
    ctx.lineWidth = drawSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (drawMode === 'pen') {
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    } else if (drawMode === 'circle') {
      if (snapshotRef.current) ctx.putImageData(snapshotRef.current, 0, 0)
      const rx = Math.abs(pos.x - startPosRef.current.x) / 2
      const ry = Math.abs(pos.y - startPosRef.current.y) / 2
      const cx = (pos.x + startPosRef.current.x) / 2
      const cy = (pos.y + startPosRef.current.y) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2)
      ctx.stroke()
    } else if (drawMode === 'arrow') {
      if (snapshotRef.current) ctx.putImageData(snapshotRef.current, 0, 0)
      drawArrowOnCtx(ctx, startPosRef.current.x, startPosRef.current.y, pos.x, pos.y, drawColor, drawSize)
    }
  }

  function onOverlayMouseUp() {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    snapshotRef.current = null
    if (drawMode === 'pen') {
      const ctx = overlayRef.current?.getContext('2d')
      ctx?.closePath()
    }
  }

  function commitText(ti: TextInput) {
    if (!ti.value.trim()) { setActiveText(null); return }
    const canvas = overlayRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) { setActiveText(null); return }
    pushHistory()
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.fillStyle = drawColor
    ctx.textBaseline = 'top'
    // Subtle shadow so text is legible on any background
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 4
    ctx.fillText(ti.value, ti.x, ti.y)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    setActiveText(null)
  }

  function toggleDrawMode(mode: DrawMode) {
    // Commit any pending text before switching
    if (activeText) commitText(activeText)
    setDrawMode(prev => (prev === mode ? 'none' : mode))
  }

  // ── Load horse link ──────────────────────────────────────────────────────────

  async function loadHorseIdForVisit(activeVisitId: string) {
    if (!activeVisitId) {
      setHorseId('')
      setLoadingHorseLink(false)
      return
    }

    const { data, error } = await supabase
      .from('visits')
      .select('horse_id')
      .eq('id', activeVisitId)
      .single()

    if (error) {
      setHorseId('')
      setLoadingHorseLink(false)
      return
    }

    setHorseId(data?.horse_id || '')
    setLoadingHorseLink(false)
  }

  useEffect(() => {
    loadHorseIdForVisit(visitId)
  }, [visitId])

  // ── Load notes ───────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadNotes() {
      setNoteMessage('')

      if (visitId) {
        setLoadingVisitNotes(true)

        const { data, error } = await supabase
          .from('visit_anatomy_regions')
          .select('region_key, notes')
          .eq('visit_id', visitId)

        if (error) {
          setNoteMessage(`Error loading visit notes: ${error.message}`)
          setNotesByLandmark({})
          setLoadingVisitNotes(false)
          return
        }

        const mapped = Object.fromEntries(
          (data || []).map((row) => [row.region_key, row.notes || ''])
        )

        setNotesByLandmark(mapped)
        setLoadingVisitNotes(false)
        return
      }

      if (typeof window === 'undefined') return

      try {
        const saved = window.localStorage.getItem(NOTES_STORAGE_KEY)
        setNotesByLandmark(saved ? JSON.parse(saved) : {})
      } catch {
        setNotesByLandmark({})
      }
    }

    loadNotes()
  }, [visitId])

  useEffect(() => {
    if (!selectedLandmark) {
      setNoteDraft('')
      setNoteMessage('')
      return
    }
    setNoteDraft(notesByLandmark[selectedLandmark.key] || '')
    setNoteMessage('')
  }, [selectedLandmark, notesByLandmark])

  // ── Layer / view helpers ─────────────────────────────────────────────────────

  function persistLocalNotes(nextNotes: Record<string, string>) {
    setNotesByLandmark(nextNotes)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(nextNotes))
    } catch {
      // ignore
    }
  }

  function toggleLayer(layer: keyof LayerState) {
    setSelectedLandmark(null)
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }))
  }

  function showOnly(layer: keyof LayerState) {
    setSelectedLandmark(null)
    setLayers({ Skin: false, Muscles: false, Skeleton: false, Nerves: false, Vascular: false, Lymphatic: false, Organs: false, Cartilage: false, [layer]: true })
  }

  function showAll() {
    setSelectedLandmark(null)
    setLayers({ Skin: true, Muscles: true, Skeleton: true, Nerves: true, Vascular: true, Lymphatic: true, Organs: true, Cartilage: true })
  }

  function animateTo(position: [number, number, number]) {
    setDesiredPosition(position)
    setIsAnimating(true)
  }

  function activateLandmark(landmark: LandmarkInfo) {
    setSelectedLandmark(landmark)
    setLayers(landmark.layers)
    animateTo(landmark.position)
  }

  function setView(position: [number, number, number]) {
    setSelectedLandmark(null)
    animateTo(position)
  }

  function resetView() {
    setSelectedLandmark(null)
    setLayers(INITIAL_LAYERS)
    setNoteMessage('')
    animateTo(DEFAULT_CAMERA_POSITION)
  }

  // ── Notes CRUD ───────────────────────────────────────────────────────────────

  async function saveRegionNotes() {
    if (!selectedLandmark) return
    if (!navigator.onLine) { setNoteMessage('Cannot save region notes while offline. Please reconnect and try again.'); return }

    if (visitId) {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('visit_anatomy_regions').upsert(
        {
          visit_id: visitId,
          region_key: selectedLandmark.key,
          notes: noteDraft,
          updated_at: new Date().toISOString(),
          practitioner_id: user?.id,
        },
        { onConflict: 'visit_id,region_key' }
      )

      if (error) {
        setNoteMessage(`Error saving visit notes: ${error.message}`)
        return
      }

      setNotesByLandmark((prev) => ({ ...prev, [selectedLandmark.key]: noteDraft }))
      setNoteMessage('Region notes saved to this visit.')
      return
    }

    const nextNotes = { ...notesByLandmark, [selectedLandmark.key]: noteDraft }
    persistLocalNotes(nextNotes)
    setNoteMessage('Region notes saved locally.')
  }

  async function clearRegionNotes() {
    if (!selectedLandmark) return

    if (visitId) {
      const { error } = await supabase
        .from('visit_anatomy_regions')
        .delete()
        .eq('visit_id', visitId)
        .eq('region_key', selectedLandmark.key)

      if (error) {
        setNoteMessage(`Error clearing visit notes: ${error.message}`)
        return
      }

      setNotesByLandmark((prev) => {
        const next = { ...prev }
        delete next[selectedLandmark.key]
        return next
      })
      setNoteDraft('')
      setNoteMessage('Region notes cleared from this visit.')
      return
    }

    const nextNotes = { ...notesByLandmark }
    delete nextNotes[selectedLandmark.key]
    persistLocalNotes(nextNotes)
    setNoteDraft('')
    setNoteMessage('Region notes cleared.')
  }

  // ── Screenshot (composites 3D + annotations) ─────────────────────────────────

  async function captureAnatomyScreenshot() {
    if (!navigator.onLine) { alert('Cannot capture screenshots while offline. Please reconnect and try again.'); return }
    if (!canvasRef.current) { alert('Canvas not ready yet.'); return }
    if (!visitId) { alert('Screenshot only saves in Visit Mode.'); return }
    if (!horseId) { alert('Horse record not loaded yet.'); return }

    // Composite: 3D canvas + overlay drawings
    const composite = document.createElement('canvas')
    composite.width = canvasRef.current.width
    composite.height = canvasRef.current.height
    const ctx = composite.getContext('2d')!
    ctx.drawImage(canvasRef.current, 0, 0)
    if (overlayRef.current) {
      ctx.drawImage(overlayRef.current, 0, 0, composite.width, composite.height)
    }

    const dataUrl = composite.toDataURL('image/png')
    const blob = await (await fetch(dataUrl)).blob()

    const fileName = `anatomy-${visitId}-${Date.now()}.png`
    const filePath = `anatomy/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('horse-photos')
      .upload(filePath, blob)

    if (uploadError) { alert(`Upload failed: ${uploadError.message}`); return }

    const { data: { user: photoUser } } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('photos').insert([{
      horse_id: horseId,
      visit_id: visitId,
      caption: 'Anatomy Screenshot',
      body_area: selectedLandmark?.title || null,
      image_path: filePath,
      practitioner_id: photoUser?.id,
    }])

    if (insertError) { alert(`Database save failed: ${insertError.message}`); return }

    alert('Screenshot saved to visit.')
  }

  // Camera view shortcuts
  const frontView  = () => setView([4,    0.25,  0])
  const rearView   = () => setView([-4,   0.25,  0])
  const leftView   = () => setView([0,    0.25, -4])
  const rightView  = () => setView([0,    0.25,  4])
  const topView    = () => setView([0,    4,     0.01])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-400 p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl">

        {/* ── Header ── */}
        <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">Horse Anatomy Viewer</h1>
              <p className="mt-2 text-sm text-slate-600 md:text-base">
                Drag to rotate · Scroll to zoom · Toggle layers · Annotate with drawing tools
              </p>
              {visitId ? (
                <p className="mt-2 text-sm text-slate-500">
                  {`Visit Mode${horseName ? ` • ${horseName}` : ''}`}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {horseId ? (
                <Link href={`/horses/${horseId}`} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900">
                  ← Back to Horse Record
                </Link>
              ) : (
                <Link href="/dashboard" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900">
                  {loadingHorseLink ? 'Loading...' : '← Back to Dashboard'}
                </Link>
              )}
              <button onClick={resetView} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900">
                Reset View
              </button>
              <button onClick={showAll} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900">
                Show All Layers
              </button>
              {visitId ? (
                <button onClick={captureAnatomyScreenshot} className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-medium text-white">
                  Save Screenshot
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Main 3-column layout ── */}
        <div className="mt-5 grid gap-5 xl:grid-cols-[320px_1fr_360px]">

          {/* ── Left: Layers + camera ── */}
          <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-slate-900">Layers</h2>

            <div className="mt-4 grid gap-3">
              {(Object.keys(INITIAL_LAYERS) as (keyof LayerState)[]).map(layer => (
                <LayerButton key={layer} label={layer} active={layers[layer]} onClick={() => toggleLayer(layer)} />
              ))}
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quick Views</h3>
              <div className="mt-3 grid gap-2">
                <button onClick={() => showOnly('Skeleton')} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900">Skeleton Only</button>
                <button onClick={() => showOnly('Muscles')} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900">Muscles Only</button>
                <button onClick={() => showOnly('Nerves')} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900">Nerves Only</button>
                <button onClick={() => showOnly('Organs')} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900">Organs Only</button>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Camera Views</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ViewButton label="Front" onClick={frontView} />
                <ViewButton label="Rear" onClick={rearView} />
                <ViewButton label="Left" onClick={leftView} />
                <ViewButton label="Right" onClick={rightView} />
                <ViewButton label="Top" onClick={topView} />
                <ViewButton label="Reset" onClick={resetView} />
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Chiropractic Landmarks</h3>
              <div className="mt-3 grid gap-2">
                <ViewButton label="Poll / Atlas"    onClick={() => activateLandmark(LANDMARKS.pollAtlas)} />
                <ViewButton label="Withers"         onClick={() => activateLandmark(LANDMARKS.withers)} />
                <ViewButton label="Thoracolumbar"   onClick={() => activateLandmark(LANDMARKS.thoracolumbar)} />
                <ViewButton label="SI Joint"        onClick={() => activateLandmark(LANDMARKS.siJoint)} />
                <ViewButton label="Hock"            onClick={() => activateLandmark(LANDMARKS.hock)} />
              </div>
            </div>
          </div>

          {/* ── Center: 3D viewer + drawing overlay ── */}
          <div className="rounded-3xl bg-white p-3 shadow-sm md:p-4">
            <div className="relative h-[72vh] min-h-[600px] overflow-hidden rounded-2xl bg-slate-100">

              {/* Three.js canvas */}
              <Canvas
                camera={{ position: [0, 0.25, 3.0], fov: 35, near: 0.01, far: 100 }}
                gl={{ preserveDrawingBuffer: true }}
                onCreated={({ gl }) => { canvasRef.current = gl.domElement }}
              >
                <ambientLight intensity={1.2} />
                <directionalLight position={[8, 8, 5]} intensity={1.6} />
                <directionalLight position={[-8, 4, -5]} intensity={0.7} />

                <Suspense fallback={<LoadingFallback />}>
                  <Center>
                    <HorseModel layers={layers} />
                  </Center>
                </Suspense>

                <CameraAnimator
                  controlsRef={controlsRef}
                  desiredPosition={desiredPosition}
                  isAnimating={isAnimating}
                  setIsAnimating={setIsAnimating}
                />

                <OrbitControls
                  ref={controlsRef}
                  enabled={drawMode === 'none'}
                  enablePan={false}
                  enableZoom
                  minDistance={0.45}
                  maxDistance={12}
                  target={[0, 0, 0]}
                />
              </Canvas>

              {/* ── Drawing overlay canvas ── */}
              <canvas
                ref={overlayRef}
                className="absolute inset-0 h-full w-full"
                style={{
                  pointerEvents: drawMode === 'none' ? 'none' : 'auto',
                  cursor: drawMode !== 'none' ? 'crosshair' : 'default',
                  touchAction: 'none',
                }}
                onMouseDown={onOverlayMouseDown}
                onMouseMove={onOverlayMouseMove}
                onMouseUp={onOverlayMouseUp}
                onMouseLeave={onOverlayMouseUp}
              />

              {/* ── Drawing toolbar (floats at bottom of viewer) ── */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-2xl bg-white/95 backdrop-blur-sm px-3 py-2.5 shadow-xl border border-slate-200">

                {/* Mode buttons */}
                <button
                  onClick={() => toggleDrawMode('pen')}
                  title="Freehand draw"
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition ${
                    drawMode === 'pen'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ✏️
                </button>
                <button
                  onClick={() => toggleDrawMode('circle')}
                  title="Draw circle / ellipse"
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition ${
                    drawMode === 'circle'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ⭕
                </button>
                <button
                  onClick={() => toggleDrawMode('arrow')}
                  title="Draw arrow / pointer"
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition ${
                    drawMode === 'arrow'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ➡️
                </button>
                <button
                  onClick={() => toggleDrawMode('text')}
                  title="Add text label"
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold transition ${
                    drawMode === 'text'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  T
                </button>

                {/* Divider */}
                <div className="mx-1 h-6 w-px bg-slate-200" />

                {/* Color swatches */}
                {DRAW_COLORS.map(({ value, label }) => (
                  <button
                    key={value}
                    title={label}
                    onClick={() => setDrawColor(value)}
                    className={`h-6 w-6 rounded-full border-2 transition ${
                      drawColor === value ? 'border-slate-900 scale-125' : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: value }}
                  />
                ))}

                {/* Divider */}
                <div className="mx-1 h-6 w-px bg-slate-200" />

                {/* Line size (hidden in text mode) */}
                {drawMode !== 'text' && (
                  <select
                    value={drawSize}
                    onChange={e => setDrawSize(Number(e.target.value))}
                    title="Stroke width"
                    className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-1.5 text-xs font-medium text-slate-700"
                  >
                    <option value={2}>Thin</option>
                    <option value={4}>Medium</option>
                    <option value={7}>Thick</option>
                    <option value={12}>Bold</option>
                  </select>
                )}

                {/* Font size (only in text mode) */}
                {drawMode === 'text' && (
                  <select
                    value={fontSize}
                    onChange={e => setFontSize(Number(e.target.value))}
                    title="Font size"
                    className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-1.5 text-xs font-medium text-slate-700"
                  >
                    <option value={14}>Small</option>
                    <option value={22}>Medium</option>
                    <option value={32}>Large</option>
                    <option value={48}>X-Large</option>
                  </select>
                )}

                {/* Divider */}
                <div className="mx-1 h-6 w-px bg-slate-200" />

                {/* Undo */}
                <button
                  onClick={undo}
                  title="Undo last stroke"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-base text-slate-700 transition hover:bg-slate-200"
                >
                  ↩
                </button>

                {/* Clear all */}
                <button
                  onClick={clearOverlay}
                  title="Clear all annotations"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-base text-slate-700 transition hover:bg-red-100 hover:text-red-600"
                >
                  🗑
                </button>
              </div>

              {/* Floating text input — appears where the user clicks in text mode */}
              {activeText && (
                <input
                  ref={textInputRef}
                  type="text"
                  value={activeText.value}
                  onChange={e => setActiveText(t => t ? { ...t, value: e.target.value } : null)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitText(activeText) }
                    if (e.key === 'Escape') { setActiveText(null) }
                  }}
                  onBlur={() => { if (activeText) commitText(activeText) }}
                  style={{
                    position: 'absolute',
                    left: activeText.cssX,
                    top: activeText.cssY,
                    fontSize: `${fontSize}px`,
                    color: drawColor,
                    fontWeight: 'bold',
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px dashed rgba(255,255,255,0.6)',
                    borderRadius: 4,
                    outline: 'none',
                    padding: '2px 6px',
                    minWidth: 80,
                    zIndex: 20,
                    caretColor: drawColor,
                  }}
                  placeholder="Type here…"
                />
              )}

              {/* Drawing mode badge */}
              {drawMode !== 'none' && (
                <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                  {drawMode === 'pen' ? 'Drawing' : drawMode === 'circle' ? 'Circle' : drawMode === 'arrow' ? 'Arrow' : 'Text'} mode
                  {drawMode === 'text' ? ' — click to place, Enter to commit' : ' — click a tool again to rotate'}
                  <button
                    onClick={() => { if (activeText) commitText(activeText); setDrawMode('none') }}
                    className="ml-1 rounded-lg px-1.5 py-0.5 hover:bg-white/20 transition"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Region details + notes ── */}
          <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-slate-900">Region Details</h2>

            {!selectedLandmark ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">
                  Select a chiropractic landmark to focus the camera, switch to a
                  recommended layer view, and record notes for that region.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Region</p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">{selectedLandmark.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{selectedLandmark.subtitle}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clinical Relevance</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{selectedLandmark.clinical}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner-Friendly Explanation</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{selectedLandmark.ownerFriendly}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Layers</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(selectedLandmark.layers)
                      .filter(([, isOn]) => isOn)
                      .map(([name]) => (
                        <span key={name} className="rounded-2xl bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                          {name}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes for Selected Region</p>
                    {loadingVisitNotes ? <span className="text-xs text-slate-500">Loading…</span> : null}
                  </div>

                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    className="mt-3 min-h-[140px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
                    placeholder="Enter findings, restriction notes, tenderness, adjustments performed, or follow-up thoughts for this region..."
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={saveRegionNotes} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white">
                      Save Notes
                    </button>
                    <button onClick={clearRegionNotes} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900">
                      Clear Notes
                    </button>
                  </div>

                  {noteMessage ? <p className="mt-3 text-sm text-slate-600">{noteMessage}</p> : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

useGLTF.preload('/models/horse_anatomy_final.glb')

export default function AnatomyPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading anatomy...</div>}>
      <AnatomyContent />
    </Suspense>
  )
}
