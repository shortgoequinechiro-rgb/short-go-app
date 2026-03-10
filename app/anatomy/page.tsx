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

function ViewButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
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

    const positionDone =
      controls.object.position.distanceTo(targetPosition) < 0.02
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

function AnatomyContent() {
  const searchParams = useSearchParams()
  const visitId = searchParams.get('visitId') || ''
  const horseName = searchParams.get('horseName') || ''

  const [horseId, setHorseId] = useState('')
  const [loadingHorseLink, setLoadingHorseLink] = useState(true)

  const [layers, setLayers] = useState<LayerState>(INITIAL_LAYERS)
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkInfo | null>(
    null
  )
  const [notesByLandmark, setNotesByLandmark] = useState<Record<string, string>>(
    {}
  )
  const [noteDraft, setNoteDraft] = useState('')
  const [noteMessage, setNoteMessage] = useState('')
  const [loadingVisitNotes, setLoadingVisitNotes] = useState(false)

  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [desiredPosition, setDesiredPosition] = useState<
    [number, number, number]
  >(DEFAULT_CAMERA_POSITION)
  const [isAnimating, setIsAnimating] = useState(false)

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
      console.error('Error loading horse id for anatomy back link:', error.message)
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

  function persistLocalNotes(nextNotes: Record<string, string>) {
    setNotesByLandmark(nextNotes)

    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(nextNotes))
    } catch {
      // ignore storage errors
    }
  }

  function toggleLayer(layer: keyof LayerState) {
    setSelectedLandmark(null)
    setLayers((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }))
  }

  function showOnly(layer: keyof LayerState) {
    setSelectedLandmark(null)
    setLayers({
      Skin: false,
      Muscles: false,
      Skeleton: false,
      Nerves: false,
      Vascular: false,
      Lymphatic: false,
      Organs: false,
      Cartilage: false,
      [layer]: true,
    })
  }

  function showAll() {
    setSelectedLandmark(null)
    setLayers({
      Skin: true,
      Muscles: true,
      Skeleton: true,
      Nerves: true,
      Vascular: true,
      Lymphatic: true,
      Organs: true,
      Cartilage: true,
    })
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

  async function saveRegionNotes() {
    if (!selectedLandmark) return

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
        {
          onConflict: 'visit_id,region_key',
        }
      )

      if (error) {
        setNoteMessage(`Error saving visit notes: ${error.message}`)
        return
      }

      setNotesByLandmark((prev) => ({
        ...prev,
        [selectedLandmark.key]: noteDraft,
      }))
      setNoteMessage('Region notes saved to this visit.')
      return
    }

    const nextNotes = {
      ...notesByLandmark,
      [selectedLandmark.key]: noteDraft,
    }

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

  async function captureAnatomyScreenshot() {
    if (!canvasRef.current) {
      alert('Canvas not ready yet.')
      return
    }

    if (!visitId) {
      alert('Screenshot only saves in Visit Mode.')
      return
    }

    if (!horseId) {
      alert('Horse record not loaded yet.')
      return
    }

    const dataUrl = canvasRef.current.toDataURL('image/png')
    const blob = await (await fetch(dataUrl)).blob()

    const fileName = `anatomy-${visitId}-${Date.now()}.png`
    const filePath = `anatomy/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('horse-photos')
      .upload(filePath, blob)

    if (uploadError) {
      alert(`Upload failed: ${uploadError.message}`)
      return
    }

    const { data: { user: photoUser } } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('photos').insert([
      {
        horse_id: horseId,
        visit_id: visitId,
        caption: 'Anatomy Screenshot',
        body_area: selectedLandmark?.title || null,
        image_path: filePath,
        practitioner_id: photoUser?.id,
      },
    ])

    if (insertError) {
      alert(`Database save failed: ${insertError.message}`)
      return
    }

    alert('Screenshot saved to visit.')
  }

  function frontView() {
    setView([4, 0.25, 0])
  }

  function rearView() {
    setView([-4, 0.25, 0])
  }

  function leftView() {
    setView([0, 0.25, -4])
  }

  function rightView() {
    setView([0, 0.25, 4])
  }

  function topView() {
    setView([0, 4, 0.01])
  }

  return (
    <main className="min-h-screen bg-slate-400 p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
                Horse Anatomy Viewer
              </h1>
              <p className="mt-2 text-sm text-slate-600 md:text-base">
                Drag to rotate. Scroll to zoom. Toggle anatomy layers and jump
                to preset views.
              </p>
              {visitId ? (
                <p className="mt-2 text-sm text-slate-500">
                  {`Visit Mode${horseName ? ` • ${horseName}` : ''}`}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {horseId ? (
                <Link
                  href={`/horses/${horseId}`}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                >
                  ← Back to Horse Record
                </Link>
              ) : (
                <Link
                  href="/"
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                >
                  {loadingHorseLink ? 'Loading...' : '← Back to Dashboard'}
                </Link>
              )}
              <button
                onClick={resetView}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900"
              >
                Reset View
              </button>
              <button
                onClick={showAll}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900"
              >
                Show All Layers
              </button>
              {visitId ? (
                <button
                  onClick={captureAnatomyScreenshot}
                  className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                >
                  Save Screenshot
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[320px_1fr_360px]">
          <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-slate-900">Layers</h2>

            <div className="mt-4 grid gap-3">
              <LayerButton
                label="Skin"
                active={layers.Skin}
                onClick={() => toggleLayer('Skin')}
              />
              <LayerButton
                label="Muscles"
                active={layers.Muscles}
                onClick={() => toggleLayer('Muscles')}
              />
              <LayerButton
                label="Skeleton"
                active={layers.Skeleton}
                onClick={() => toggleLayer('Skeleton')}
              />
              <LayerButton
                label="Nerves"
                active={layers.Nerves}
                onClick={() => toggleLayer('Nerves')}
              />
              <LayerButton
                label="Vascular"
                active={layers.Vascular}
                onClick={() => toggleLayer('Vascular')}
              />
              <LayerButton
                label="Lymphatic"
                active={layers.Lymphatic}
                onClick={() => toggleLayer('Lymphatic')}
              />
              <LayerButton
                label="Organs"
                active={layers.Organs}
                onClick={() => toggleLayer('Organs')}
              />
              <LayerButton
                label="Cartilage"
                active={layers.Cartilage}
                onClick={() => toggleLayer('Cartilage')}
              />
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Quick Views
              </h3>

              <div className="mt-3 grid gap-2">
                <button
                  onClick={() => showOnly('Skeleton')}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900"
                >
                  Skeleton Only
                </button>
                <button
                  onClick={() => showOnly('Muscles')}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900"
                >
                  Muscles Only
                </button>
                <button
                  onClick={() => showOnly('Nerves')}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900"
                >
                  Nerves Only
                </button>
                <button
                  onClick={() => showOnly('Organs')}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900"
                >
                  Organs Only
                </button>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Camera Views
              </h3>

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
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Chiropractic Landmarks
              </h3>

              <div className="mt-3 grid gap-2">
                <ViewButton
                  label="Poll / Atlas"
                  onClick={() => activateLandmark(LANDMARKS.pollAtlas)}
                />
                <ViewButton
                  label="Withers"
                  onClick={() => activateLandmark(LANDMARKS.withers)}
                />
                <ViewButton
                  label="Thoracolumbar"
                  onClick={() => activateLandmark(LANDMARKS.thoracolumbar)}
                />
                <ViewButton
                  label="SI Joint"
                  onClick={() => activateLandmark(LANDMARKS.siJoint)}
                />
                <ViewButton
                  label="Hock"
                  onClick={() => activateLandmark(LANDMARKS.hock)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-3 shadow-sm md:p-4">
            <div className="h-[72vh] min-h-[600px] overflow-hidden rounded-2xl bg-slate-100">
<Canvas
  camera={{ position: [0, 0.25, 3.0], fov: 35, near: 0.01, far: 100 }}
  gl={{ preserveDrawingBuffer: true }}
  onCreated={({ gl }) => {
    canvasRef.current = gl.domElement
  }}
>                <ambientLight intensity={1.2} />
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
                  enablePan={false}
                  enableZoom
                  minDistance={0.45}
                  maxDistance={12}
                  target={[0, 0, 0]}
                />
              </Canvas>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Region Details
            </h2>

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
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Selected Region
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">
                    {selectedLandmark.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedLandmark.subtitle}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Clinical Relevance
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {selectedLandmark.clinical}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Owner-Friendly Explanation
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {selectedLandmark.ownerFriendly}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Active Layers
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(selectedLandmark.layers)
                      .filter(([, isOn]) => isOn)
                      .map(([name]) => (
                        <span
                          key={name}
                          className="rounded-2xl bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                        >
                          {name}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Notes for Selected Region
                    </p>
                    {loadingVisitNotes ? (
                      <span className="text-xs text-slate-500">Loading…</span>
                    ) : null}
                  </div>

                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    className="mt-3 min-h-[140px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
                    placeholder="Enter findings, restriction notes, tenderness, adjustments performed, or follow-up thoughts for this region..."
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={saveRegionNotes}
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                    >
                      Save Notes
                    </button>
                    <button
                      onClick={clearRegionNotes}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                    >
                      Clear Notes
                    </button>
                  </div>

                  {noteMessage ? (
                    <p className="mt-3 text-sm text-slate-600">{noteMessage}</p>
                  ) : null}
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