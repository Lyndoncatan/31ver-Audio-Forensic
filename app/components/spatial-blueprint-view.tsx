"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Upload, MapPin, Building2, Layers, ChevronUp, ChevronDown,
    Crosshair, Image as ImageIcon, Map as MapIcon, Minus, Plus
} from "lucide-react"

// ─── CATEGORY CONFIG ────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { color: string; baseAngle: number }> = {
    "Human Voice": { color: "#3b82f6", baseAngle: 0 },
    "Male Voice": { color: "#2563eb", baseAngle: 15 },
    "Female Voice": { color: "#60a5fa", baseAngle: -15 },
    "Musical Content": { color: "#a855f7", baseAngle: 45 },
    "Vehicle Sound": { color: "#f97316", baseAngle: 90 },
    "Footsteps": { color: "#eab308", baseAngle: 135 },
    "Animal Signal": { color: "#22c55e", baseAngle: 180 },
    "Atmospheric Wind": { color: "#06b6d4", baseAngle: 225 },
    "Gunshot / Explosion": { color: "#ef4444", baseAngle: 270 },
    "Scream / Aggression": { color: "#dc2626", baseAngle: 285 },
    "Siren / Alarm": { color: "#f43f5e", baseAngle: 300 },
    "Impact / Breach": { color: "#d946ef", baseAngle: 315 },
    "Silence": { color: "#6b7280", baseAngle: 160 },
    "Water / Liquid": { color: "#0ea5e9", baseAngle: 200 },
    "Electronic Signal": { color: "#8b5cf6", baseAngle: 350 },
    "Tools / Machinery": { color: "#78716c", baseAngle: 120 },
    "Domestic Sound": { color: "#a3a3a3", baseAngle: 250 },
    "Crowd / Public": { color: "#fbbf24", baseAngle: 70 },
}

// ─── SOUND ATTENUATION CONSTANTS ────────────────────────────────────
const DB_LOSS_PER_10FT = 6  // ~6 dB attenuation per 10 ft of height
const FT_PER_PX = 0.5       // scale factor

// ────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────
interface SpatialBlueprintViewProps {
    audioData: any
    activeEvents: any[]
    currentTime: number
}

export default function SpatialBlueprintView({ audioData, activeEvents, currentTime }: SpatialBlueprintViewProps) {
    // ── State ───────────────────────────────────────────────────────
    const [mode, setMode] = useState<"blueprint" | "map">("blueprint")
    const [blueprintImg, setBlueprintImg] = useState<HTMLImageElement | null>(null)
    const [blueprintFileName, setBlueprintFileName] = useState<string>("")
    const [recPosition, setRecPosition] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 })
    const [isDraggingPin, setIsDraggingPin] = useState(false)

    // Map state
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [mapLoading, setMapLoading] = useState(false)

    // Vertical propagation state (in feet)
    const [totalHeight, setTotalHeight] = useState(50) // total height in ft
    const [recordingHeight, setRecordingHeight] = useState(5) // recording mic height in ft

    // Refs
    const blueprintCanvasRef = useRef<HTMLCanvasElement>(null)
    const verticalCanvasRef = useRef<HTMLCanvasElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const animFrameRef = useRef<number>(0)

    // ── Blueprint Upload ────────────────────────────────────────────
    const handleBlueprintUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setBlueprintFileName(file.name)
        const img = new window.Image()
        img.onload = () => setBlueprintImg(img)
        img.src = URL.createObjectURL(file)
    }

    // ── Geolocation ─────────────────────────────────────────────────
    const requestLocation = () => {
        setMapLoading(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                setMapLoading(false)
                setMode("map")
            },
            () => {
                // Fallback: Manila
                setUserLocation({ lat: 14.5995, lng: 120.9842 })
                setMapLoading(false)
                setMode("map")
            },
            { enableHighAccuracy: true }
        )
    }

    // ── Blueprint canvas: drag recording position ───────────────────
    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const nx = (e.clientX - rect.left) / rect.width
        const ny = (e.clientY - rect.top) / rect.height
        const dx = nx - recPosition.x
        const dy = ny - recPosition.y
        if (Math.sqrt(dx * dx + dy * dy) < 0.04) setIsDraggingPin(true)
    }
    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDraggingPin) return
        const rect = e.currentTarget.getBoundingClientRect()
        setRecPosition({
            x: Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width)),
            y: Math.max(0.02, Math.min(0.98, (e.clientY - rect.top) / rect.height)),
        })
    }
    const handleCanvasMouseUp = () => setIsDraggingPin(false)

    // ── Draw Blueprint Canvas ──────────────────────────────────────
    const drawBlueprint = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
        // Background
        ctx.fillStyle = "#020617"
        ctx.fillRect(0, 0, w, h)

        // Blueprint image or placeholder grid
        if (blueprintImg) {
            ctx.globalAlpha = 0.55
            const imgAspect = blueprintImg.width / blueprintImg.height
            const canvasAspect = w / h
            let dw = w, dh = h, dx = 0, dy = 0
            if (imgAspect > canvasAspect) { dh = w / imgAspect; dy = (h - dh) / 2 }
            else { dw = h * imgAspect; dx = (w - dw) / 2 }
            ctx.drawImage(blueprintImg, dx, dy, dw, dh)
            ctx.globalAlpha = 1

            // Blueprint border glow
            ctx.strokeStyle = "rgba(99, 102, 241, 0.4)"
            ctx.lineWidth = 2
            ctx.strokeRect(dx + 1, dy + 1, dw - 2, dh - 2)
        } else {
            // Grid placeholder
            ctx.strokeStyle = "rgba(99, 102, 241, 0.12)"
            ctx.lineWidth = 1
            for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
            for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
            // "Upload" hint
            ctx.fillStyle = "rgba(148, 163, 184, 0.25)"
            ctx.font = "bold 14px monospace"
            ctx.textAlign = "center"
            ctx.fillText("UPLOAD A FLOOR PLAN TO OVERLAY SOUNDS", w / 2, h / 2 - 10)
            ctx.font = "11px monospace"
            ctx.fillText("or switch to Map Mode ↗", w / 2, h / 2 + 12)
        }

        const cx = recPosition.x * w
        const cy = recPosition.y * h
        const time = Date.now() / 1000

        // Recording position marker
        ctx.save()
        // Outer pulse
        const pulse = (time % 1.5) / 1.5
        ctx.beginPath()
        ctx.arc(cx, cy, 8 + pulse * 30, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.6 - pulse * 0.6})`
        ctx.lineWidth = 2
        ctx.stroke()

        // Inner crosshair
        ctx.strokeStyle = "#ef4444"
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12); ctx.stroke()
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fillStyle = "#ef4444"; ctx.fill()

        // Label
        ctx.fillStyle = "#ef4444"
        ctx.font = "bold 9px monospace"
        ctx.textAlign = "center"
        ctx.fillText("REC POSITION", cx, cy - 18)
        ctx.fillText("(drag to move)", cx, cy + 28)
        ctx.restore()

        // Maximum radius for sound placement
        const maxR = Math.min(w, h) * 0.4

        // Track category counts for spreading
        const categoryCount: Record<string, number> = {}

        // Draw sound events
        activeEvents.forEach((ev: any, i: number) => {
            const cat = ev.type || "Unknown"
            const config = CATEGORY_CONFIG[cat] || { color: "#6366f1", baseAngle: (i * 37) % 360 }

            categoryCount[cat] = (categoryCount[cat] || 0) + 1
            const catIdx = categoryCount[cat]

            // Angle from category base + spread
            const spread = (catIdx % 5) * 7 - 14
            const jitter = ((i * 7 + catIdx * 13) % 10 - 5) * 1.2
            const angleDeg = config.baseAngle + spread + jitter
            const a = (angleDeg * Math.PI) / 180

            // Distance from confidence
            const confidence = ev.confidence || 0.5
            const d = (1.0 - Math.max(0.15, Math.min(0.9, confidence))) * maxR * 0.9 + maxR * 0.1

            const ex = cx + Math.cos(a) * d
            const ey = cy + Math.sin(a) * d
            const isActive = Math.abs(currentTime - (ev.time || 0)) < 0.3

            // Direction line from center
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            ctx.lineTo(ex, ey)
            ctx.strokeStyle = `${config.color}${isActive ? "60" : "20"}`
            ctx.lineWidth = isActive ? 2 : 1
            ctx.setLineDash([4, 6])
            ctx.stroke()
            ctx.setLineDash([])

            // Glow ring
            ctx.beginPath()
            ctx.arc(ex, ey, 12, 0, Math.PI * 2)
            ctx.fillStyle = `${config.color}25`
            ctx.fill()

            // Active pulse
            if (isActive) {
                const ep = (time % 1)
                ctx.beginPath()
                ctx.arc(ex, ey, 5 + ep * 25, 0, Math.PI * 2)
                ctx.strokeStyle = config.color
                ctx.globalAlpha = 1 - ep
                ctx.lineWidth = 2
                ctx.stroke()
                ctx.globalAlpha = 1
            }

            // Dot
            ctx.beginPath()
            ctx.arc(ex, ey, isActive ? 7 : 5, 0, Math.PI * 2)
            ctx.fillStyle = isActive ? "#ffffff" : config.color
            ctx.shadowBlur = 10
            ctx.shadowColor = config.color
            ctx.fill()
            ctx.shadowBlur = 0

            // Label (always show for clarity on blueprint)
            if (isActive || blueprintImg) {
                ctx.fillStyle = "#ffffff"
                ctx.font = `bold ${isActive ? 11 : 9}px monospace`
                ctx.textAlign = "left"
                ctx.fillText(cat, ex + 12, ey - 2)
                ctx.fillStyle = "rgba(255,255,255,0.6)"
                ctx.font = "9px monospace"
                ctx.fillText(`${((ev.confidence || 0) * 100).toFixed(0)}% | ${Math.abs(Number(ev.decibels || -60)).toFixed(0)}dB`, ex + 12, ey + 10)
            }
        })

        // Range circles (subtle distance indicator from recording position)
        ctx.setLineDash([3, 6])
        for (let ring = 1; ring <= 3; ring++) {
            const r = maxR * (ring / 3)
            ctx.beginPath()
            ctx.arc(cx, cy, r, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 - ring * 0.03})`
            ctx.lineWidth = 1
            ctx.stroke()
            // distance label
            ctx.fillStyle = "rgba(99, 102, 241, 0.4)"
            ctx.font = "9px monospace"
            ctx.textAlign = "left"
            ctx.fillText(`~${ring * 10}m`, cx + r + 4, cy + 3)
        }
        ctx.setLineDash([])

        // Top-left HUD
        ctx.fillStyle = "rgba(255,255,255,0.6)"
        ctx.font = "bold 10px monospace"
        ctx.textAlign = "left"
        ctx.fillText(`EVENTS: ${activeEvents.length}`, 12, 20)
        if (blueprintImg) ctx.fillText(`PLAN: ${blueprintFileName}`, 12, 34)
    }, [blueprintImg, blueprintFileName, recPosition, activeEvents, currentTime])

    // ── Draw Vertical Propagation Canvas (ft-based, shattered particles) ──
    const shardSeedRef = useRef<number[]>([])
    if (shardSeedRef.current.length === 0) {
        // Pre-generate 500 deterministic shard seeds for consistent rendering
        for (let i = 0; i < 500; i++) shardSeedRef.current.push(Math.random())
    }

    const drawVertical = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
        ctx.fillStyle = "#020617"
        ctx.fillRect(0, 0, w, h)

        const padL = 70, padR = 30, padT = 50, padB = 40
        const drawW = w - padL - padR
        const drawH = h - padT - padB
        const time = Date.now() / 1000

        // Height axis: 0 ft at bottom, totalHeight ft at top
        const ftToY = (ft: number) => padT + drawH - (ft / totalHeight) * drawH
        const recY = ftToY(recordingHeight)

        // ── Draw height scale & grid ──
        const tickInterval = totalHeight <= 30 ? 5 : totalHeight <= 60 ? 10 : 20
        ctx.textAlign = "right"
        for (let ft = 0; ft <= totalHeight; ft += tickInterval) {
            const y = ftToY(ft)
            const isRec = Math.abs(ft - recordingHeight) < tickInterval / 2
            ctx.strokeStyle = isRec ? "rgba(239,68,68,0.3)" : "rgba(99,102,241,0.12)"
            ctx.lineWidth = isRec ? 1.5 : 0.5
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + drawW, y); ctx.stroke()
            ctx.fillStyle = isRec ? "#ef4444" : "rgba(148,163,184,0.5)"
            ctx.font = `${isRec ? "bold " : ""}10px monospace`
            ctx.fillText(`${ft} ft`, padL - 8, y + 4)
        }

        // Building outline
        ctx.strokeStyle = "rgba(99,102,241,0.35)"
        ctx.lineWidth = 2
        ctx.strokeRect(padL, padT, drawW, drawH)

        // Recording height line
        ctx.strokeStyle = "#ef4444"
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        ctx.beginPath(); ctx.moveTo(padL, recY); ctx.lineTo(padL + drawW, recY); ctx.stroke()
        ctx.setLineDash([])

        // Rec marker
        ctx.beginPath(); ctx.arc(padL + 20, recY, 7, 0, Math.PI * 2)
        ctx.fillStyle = "#ef4444"; ctx.fill()
        ctx.fillStyle = "#fff"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center"
        ctx.fillText("🎙", padL + 20, recY + 3)
        ctx.fillStyle = "#ef4444"; ctx.font = "bold 9px monospace"; ctx.textAlign = "left"
        ctx.fillText(`REC @ ${recordingHeight} ft`, padL + 32, recY + 4)

        // Title
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"
        ctx.fillText("VERTICAL SOUND PROPAGATION", w / 2, 18)
        ctx.font = "9px monospace"; ctx.fillStyle = "rgba(148,163,184,0.5)"
        ctx.fillText(`Height: ${totalHeight} ft  |  ~${DB_LOSS_PER_10FT} dB loss per 10 ft  |  Shattered particle view`, w / 2, 32)

        // ── Aggregate strongest events per category ──
        const categoryBest: Record<string, { confidence: number; dB: number; color: string }> = {}
        activeEvents.forEach((ev: any) => {
            const cat = ev.type || "Unknown"
            const conf = ev.confidence || 0
            const dB = Number(ev.decibels || -60)
            if (!categoryBest[cat] || conf > categoryBest[cat].confidence) {
                categoryBest[cat] = { confidence: conf, dB, color: CATEGORY_CONFIG[cat]?.color || "#6366f1" }
            }
        })

        const categories = Object.entries(categoryBest)
        const colW = drawW / Math.max(categories.length, 1)
        const seeds = shardSeedRef.current

        categories.forEach(([cat, { confidence, dB, color }], catIdx) => {
            const xCenter = padL + colW * catIdx + colW / 2
            const effectiveDB = Math.abs(dB)
            // Max reach in ft based on dB
            const maxReachFt = Math.min(totalHeight, (effectiveDB / DB_LOSS_PER_10FT) * 10)

            // ── Draw shattered particles up and down from recording height ──
            for (let dir = -1; dir <= 1; dir += 2) {
                const shardCount = Math.floor(12 + confidence * 20)
                for (let s = 0; s < shardCount; s++) {
                    const seedIdx = (catIdx * 67 + s * 31 + (dir > 0 ? 200 : 0)) % seeds.length
                    const r1 = seeds[seedIdx], r2 = seeds[(seedIdx + 1) % seeds.length]
                    const r3 = seeds[(seedIdx + 2) % seeds.length], r4 = seeds[(seedIdx + 3) % seeds.length]

                    // How far this shard travels (in ft)
                    const distFt = r1 * maxReachFt
                    const ftPos = recordingHeight + dir * distFt
                    if (ftPos < 0 || ftPos > totalHeight) continue

                    const sy = ftToY(ftPos)
                    // Horizontal scatter — more scatter as distance increases
                    const scatter = (distFt / maxReachFt) * (colW * 0.4)
                    const sx = xCenter + (r2 - 0.5) * scatter * 2

                    // Attenuation
                    const attDB = (distFt / 10) * DB_LOSS_PER_10FT
                    const remaining = effectiveDB - attDB
                    if (remaining <= 0) continue
                    const alpha = Math.max(0.04, Math.min(0.9, remaining / effectiveDB))

                    // Shard size — smaller as they travel further (shattering)
                    const baseSize = 3 + confidence * 4
                    const sizeFactor = Math.max(0.2, 1 - (distFt / maxReachFt) * 0.8)
                    const size = baseSize * sizeFactor

                    // Shard rotation animation
                    const rot = time * (1 + r3 * 3) + r4 * Math.PI * 2

                    ctx.save()
                    ctx.translate(sx, sy)
                    ctx.rotate(rot)
                    ctx.globalAlpha = alpha

                    // Random shard shapes (triangle, diamond, line fragment)
                    const shapeType = Math.floor(r3 * 4)
                    ctx.fillStyle = color
                    ctx.strokeStyle = color
                    ctx.lineWidth = 1

                    if (shapeType === 0) {
                        // Triangle shard
                        ctx.beginPath()
                        ctx.moveTo(0, -size); ctx.lineTo(size * 0.6, size * 0.5)
                        ctx.lineTo(-size * 0.6, size * 0.5); ctx.closePath(); ctx.fill()
                    } else if (shapeType === 1) {
                        // Diamond shard
                        ctx.beginPath()
                        ctx.moveTo(0, -size); ctx.lineTo(size * 0.5, 0)
                        ctx.lineTo(0, size); ctx.lineTo(-size * 0.5, 0); ctx.closePath(); ctx.fill()
                    } else if (shapeType === 2) {
                        // Line fragment
                        ctx.beginPath()
                        ctx.moveTo(-size, 0); ctx.lineTo(size, 0)
                        ctx.lineWidth = 1.5; ctx.stroke()
                    } else {
                        // Dot fragment
                        ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.fill()
                    }

                    ctx.restore()
                }

                // Fading beam line
                const reachY = ftToY(Math.max(0, Math.min(totalHeight, recordingHeight + dir * maxReachFt)))
                const grad = ctx.createLinearGradient(0, recY, 0, reachY)
                grad.addColorStop(0, `${color}50`)
                grad.addColorStop(1, `${color}00`)
                ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.4
                ctx.beginPath(); ctx.moveTo(xCenter, recY); ctx.lineTo(xCenter, reachY); ctx.stroke()
                ctx.globalAlpha = 1
            }

            // Source orb at recording height
            const pulse = (time * 1.5 + catIdx * 0.4) % 1
            ctx.beginPath(); ctx.arc(xCenter, recY, 4 + pulse * 8, 0, Math.PI * 2)
            ctx.strokeStyle = color; ctx.globalAlpha = 1 - pulse; ctx.lineWidth = 1.5; ctx.stroke()
            ctx.globalAlpha = 1
            ctx.beginPath(); ctx.arc(xCenter, recY, 4, 0, Math.PI * 2)
            ctx.fillStyle = color; ctx.fill()

            // Category label
            ctx.save()
            ctx.fillStyle = color; ctx.font = "bold 8px monospace"; ctx.textAlign = "center"
            ctx.fillText(cat.length > 14 ? cat.substring(0, 14) + ".." : cat, xCenter, padT - 8)
            ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "7px monospace"
            ctx.fillText(`↕${Math.round(maxReachFt)} ft`, xCenter, padT + drawH + 16)
            ctx.restore()
        })
    }, [activeEvents, currentTime, totalHeight, recordingHeight])

    // ── Animation Loop ─────────────────────────────────────────────
    useEffect(() => {
        const render = () => {
            if (mode === "blueprint" && blueprintCanvasRef.current) {
                const c = blueprintCanvasRef.current
                drawBlueprint(c.getContext("2d")!, c.width, c.height)
            }
            if (verticalCanvasRef.current) {
                const c = verticalCanvasRef.current
                drawVertical(c.getContext("2d")!, c.width, c.height)
            }
            animFrameRef.current = requestAnimationFrame(render)
        }
        render()
        return () => cancelAnimationFrame(animFrameRef.current)
    }, [drawBlueprint, drawVertical, mode])

    // ── Render ─────────────────────────────────────────────────────
    return (
        <div className="space-y-6 mt-6">
            {/* Section Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                    <Building2 className="w-8 h-8 text-indigo-500" />
                    <div>
                        <h2 className="text-xl font-black italic tracking-tighter uppercase">Spatial Structure View</h2>
                        <span className="text-[10px] text-slate-500 tracking-widest uppercase font-mono">Blueprint / Map Overlay + Vertical Sound Reach</span>
                    </div>
                </div>
            </div>

            {/* ── BLUEPRINT / MAP VIEW ────────────────────────────────── */}
            <Card className="bg-slate-950/80 border-slate-800 overflow-hidden">
                {/* Controls bar */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <Badge className="bg-indigo-600/20 text-indigo-400 border-indigo-500/30 font-black text-[10px] tracking-widest">
                            {mode === "blueprint" ? "BLUEPRINT_OVERLAY" : "MAP_OVERLAY"}
                        </Badge>
                        {blueprintImg && (
                            <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-700">
                                {blueprintFileName}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleBlueprintUpload} className="hidden" />
                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 border-slate-700 hover:bg-slate-800 text-xs font-bold"
                        >
                            <ImageIcon className="w-3.5 h-3.5" /> Upload Floor Plan
                        </Button>
                        <Button
                            onClick={requestLocation}
                            variant="outline"
                            size="sm"
                            disabled={mapLoading}
                            className="h-8 gap-2 border-slate-700 hover:bg-slate-800 text-xs font-bold"
                        >
                            <MapIcon className="w-3.5 h-3.5" /> {mapLoading ? "Locating..." : "Use Map"}
                        </Button>
                        <Button
                            onClick={() => setMode(mode === "blueprint" ? "map" : "blueprint")}
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-[10px] text-slate-500"
                        >
                            <Layers className="w-3 h-3" /> Toggle
                        </Button>
                    </div>
                </div>

                {/* Canvas / Map */}
                {mode === "blueprint" ? (
                    <div className="relative">
                        <canvas
                            ref={blueprintCanvasRef}
                            width={900}
                            height={600}
                            className="w-full aspect-[3/2] cursor-crosshair"
                            onMouseDown={handleCanvasMouseDown}
                            onMouseMove={handleCanvasMouseMove}
                            onMouseUp={handleCanvasMouseUp}
                            onMouseLeave={handleCanvasMouseUp}
                        />
                    </div>
                ) : (
                    <div className="relative w-full aspect-[3/2] bg-slate-950">
                        {userLocation ? (
                            <div className="relative w-full h-full">
                                {/* OpenStreetMap iframe (no API key needed) */}
                                <iframe
                                    className="w-full h-full border-0 opacity-60"
                                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${userLocation.lng - 0.005}%2C${userLocation.lat - 0.003}%2C${userLocation.lng + 0.005}%2C${userLocation.lat + 0.003}&layer=mapnik&marker=${userLocation.lat}%2C${userLocation.lng}`}
                                    loading="lazy"
                                />
                                {/* Overlay canvas on top of map */}
                                <canvas
                                    ref={blueprintCanvasRef}
                                    width={900}
                                    height={600}
                                    className="absolute inset-0 w-full h-full cursor-crosshair"
                                    style={{ pointerEvents: "all" }}
                                    onMouseDown={handleCanvasMouseDown}
                                    onMouseMove={handleCanvasMouseMove}
                                    onMouseUp={handleCanvasMouseUp}
                                    onMouseLeave={handleCanvasMouseUp}
                                />
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-4">
                                <MapPin className="w-12 h-12 opacity-30" />
                                <p className="text-xs font-bold tracking-widest uppercase">Click &quot;Use Map&quot; to load your location</p>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* ── VERTICAL SOUND PROPAGATION ──────────────────────────── */}
            <Card className="bg-slate-950/80 border-slate-800 overflow-hidden">
                {/* Controls */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 font-black text-[10px] tracking-widest">
                            VERTICAL_PROPAGATION
                        </Badge>
                        <span className="text-[9px] text-slate-500 font-mono">How tall can the sound reach? (shattered particle view)</span>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Total height control */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                            <span>HEIGHT:</span>
                            <Button
                                variant="outline" size="icon"
                                className="h-6 w-6 border-slate-700"
                                onClick={() => setTotalHeight((h: number) => Math.max(20, h - 10))}
                            ><Minus className="w-3 h-3" /></Button>
                            <span className="w-10 text-center font-bold text-white">{totalHeight} ft</span>
                            <Button
                                variant="outline" size="icon"
                                className="h-6 w-6 border-slate-700"
                                onClick={() => setTotalHeight((h: number) => Math.min(200, h + 10))}
                            ><Plus className="w-3 h-3" /></Button>
                        </div>

                        {/* Recording height control */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                            <span>REC HEIGHT:</span>
                            <Button
                                variant="outline" size="icon"
                                className="h-6 w-6 border-slate-700"
                                onClick={() => setRecordingHeight((h: number) => Math.max(0, h - 5))}
                            ><ChevronDown className="w-3 h-3" /></Button>
                            <span className="w-10 text-center font-bold text-red-400">{recordingHeight} ft</span>
                            <Button
                                variant="outline" size="icon"
                                className="h-6 w-6 border-slate-700"
                                onClick={() => setRecordingHeight((h: number) => Math.min(totalHeight, h + 5))}
                            ><ChevronUp className="w-3 h-3" /></Button>
                        </div>
                    </div>
                </div>

                <canvas
                    ref={verticalCanvasRef}
                    width={900}
                    height={450}
                    className="w-full"
                    style={{ height: "450px" }}
                />
            </Card>
        </div>
    )
}

