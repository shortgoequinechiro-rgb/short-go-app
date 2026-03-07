'use client'

import Link from 'next/link'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Html, Center } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useState } from 'react'

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

const INITIAL_LAYERS: LayerState = {
  Skin: true,
  Muscles: true,
  Skeleton: false,
  Nerves: false,
  Vascular: false,
  Lymphatic: false,
  Organs: false,
  Cartilage: false,
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
      <primitive object={clonedScene} scale={1.1} />
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

export default function AnatomyPage() {
  const [layers, setLayers] = useState<LayerState>(INITIAL_LAYERS)

  function toggleLayer(layer: keyof LayerState) {
    setLayers((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }))
  }

  function showOnly(layer: keyof LayerState) {
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

  function resetView() {
    setLayers(INITIAL_LAYERS)
  }

  return (
    <main className="min-h-screen bg-slate-400 p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                Short-Go Equine Chiropractic
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">
                Horse Anatomy Viewer
              </h1>
              <p className="mt-2 text-sm text-slate-600 md:text-base">
                Drag to rotate. Scroll to zoom. Toggle anatomy layers on and off.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900"
              >
                Back to Dashboard
              </Link>
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
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[320px_1fr]">
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
          </div>

          <div className="rounded-3xl bg-white p-3 shadow-sm md:p-4">
            <div className="h-[72vh] min-h-[600px] overflow-hidden rounded-2xl bg-slate-100">
              <Canvas camera={{ position: [0, 0, 6], fov: 35 }}>
                <ambientLight intensity={1.2} />
                <directionalLight position={[8, 8, 5]} intensity={1.6} />
                <directionalLight position={[-8, 4, -5]} intensity={0.7} />

                <Suspense fallback={<LoadingFallback />}>
                  <Center>
                    <HorseModel layers={layers} />
                  </Center>
                </Suspense>

                <OrbitControls
                  enablePan={false}
                  enableZoom
                  minDistance={1.5}
                  maxDistance={12}
                  target={[0, 0, 0]}
                />
              </Canvas>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

useGLTF.preload('/models/horse_anatomy_final.glb')