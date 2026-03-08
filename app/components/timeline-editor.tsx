"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    ZoomIn, ZoomOut, Bookmark, MessageSquarePlus, Scissors, Trash2,
    Play, Pause, SkipBack, SkipForward, Flag, ChevronLeft, ChevronRight
} from "lucide-react"

// ─── TYPES ──────────────────────────────────────────────────────────
interface Annotation {
    id: string
    time: number
    endTime?: number // if region
    text: string
    type: "marker" | "evidence" | "note"
    color: string
}

interface TimelineEditorProps {
    audioData: any
    activeEvents: any[]
    audioRef: React.RefObject<HTMLAudioElement | null>
    currentTime: number
    isPlaying: boolean
    onSeek: (time: number) => void
    onPlayPause: () => void
}

// ─── CATEGORY COLORS ────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
    "Human Voice": "#3b82f6", "Male Voice": "#2563eb", "Female Voice": "#60a5fa",
    "Musical Content": "#a855f7", "Vehicle Sound": "#f97316", "Footsteps": "#eab308",
    "Animal Signal": "#22c55e", "Atmospheric Wind": "#06b6d4",
    "Gunshot / Explosion": "#ef4444", "Scream / Aggression": "#dc2626",
    "Siren / Alarm": "#f43f5e", "Impact / Breach": "#d946ef",
    "Silence": "#6b7280", "Water / Liquid": "#0ea5e9",
    "Electronic Signal": "#8b5cf6", "Tools / Machinery": "#78716c",
    "Domestic Sound": "#a3a3a3", "Crowd / Public": "#fbbf24",
}

const ANNOTATION_TYPES = {
    marker: { label: "Bookmark", color: "#f59e0b", icon: Bookmark },
    evidence: { label: "Evidence", color: "#ef4444", icon: Flag },
    note: { label: "Note", color: "#3b82f6", icon: MessageSquarePlus },
}

// ─── COMPONENT ──────────────────────────────────────────────────────
export default function TimelineEditor({
    audioData, activeEvents, audioRef, currentTime, isPlaying, onSeek, onPlayPause
}: TimelineEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)

    // Timeline state
    const [zoom, setZoom] = useState(1) // 1 = fit all, higher = zoomed in
    const [scrollOffset, setScrollOffset] = useState(0) // in seconds
    const [annotations, setAnnotations] = useState<Annotation[]>([])
    const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null)
    const [addMode, setAddMode] = useState<"marker" | "evidence" | "note" | null>(null)
    const [regionStart, setRegionStart] = useState<number | null>(null)
    const [hoveredTime, setHoveredTime] = useState<number | null>(null)
    const [annotationText, setAnnotationText] = useState("")
    const [showAnnotationInput, setShowAnnotationInput] = useState(false)
    const [pendingAnnotationTime, setPendingAnnotationTime] = useState(0)

    const duration = audioData?.duration || audioData?.analysisResults?.duration || 10

    // ── Time/pixel conversion ─────────────────────────────────────────
    const getVisibleDuration = () => duration / zoom
    const timeToX = (t: number, w: number) => {
        const vd = getVisibleDuration()
        return ((t - scrollOffset) / vd) * w
    }
    const xToTime = (x: number, w: number) => {
        const vd = getVisibleDuration()
        return scrollOffset + (x / w) * vd
    }

    // ── Canvas interactions ───────────────────────────────────────────
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const w = e.currentTarget.width
        const t = xToTime(x * (w / rect.width), w)

        if (addMode) {
            if (addMode === "evidence" && regionStart === null) {
                setRegionStart(t)
                return
            }
            setPendingAnnotationTime(t)
            setShowAnnotationInput(true)
            return
        }

        // Check if clicked on an annotation
        const clickedAnno = annotations.find(a => Math.abs(a.time - t) < duration * 0.01)
        if (clickedAnno) {
            setSelectedAnnotation(clickedAnno.id)
            return
        }

        setSelectedAnnotation(null)
        onSeek(Math.max(0, Math.min(duration, t)))
    }

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const w = e.currentTarget.width
        setHoveredTime(xToTime(x * (w / rect.width), w))
    }

    const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault()
        if (e.ctrlKey || e.metaKey) {
            // Zoom
            setZoom(z => Math.max(1, Math.min(50, z + (e.deltaY > 0 ? -0.5 : 0.5))))
        } else {
            // Scroll
            const step = getVisibleDuration() * 0.1
            setScrollOffset(o => Math.max(0, Math.min(duration - getVisibleDuration(), o + (e.deltaY > 0 ? step : -step))))
        }
    }

    // ── Add annotation ────────────────────────────────────────────────
    const confirmAnnotation = () => {
        if (!addMode) return
        const anno: Annotation = {
            id: `ann_${Date.now()}`,
            time: addMode === "evidence" && regionStart !== null ? regionStart : pendingAnnotationTime,
            endTime: addMode === "evidence" ? pendingAnnotationTime : undefined,
            text: annotationText || ANNOTATION_TYPES[addMode].label,
            type: addMode,
            color: ANNOTATION_TYPES[addMode].color,
        }
        setAnnotations(prev => [...prev, anno])
        setShowAnnotationInput(false)
        setAnnotationText("")
        setAddMode(null)
        setRegionStart(null)
    }

    const deleteAnnotation = (id: string) => {
        setAnnotations(prev => prev.filter(a => a.id !== id))
        setSelectedAnnotation(null)
    }

    // ── Draw Timeline ─────────────────────────────────────────────────
    const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
        ctx.fillStyle = "#020617"
        ctx.fillRect(0, 0, w, h)

        const waveTop = 30
        const waveH = h - 70
        const waveBot = waveTop + waveH
        const vd = getVisibleDuration()
        const time = Date.now() / 1000

        // ── Waveform background ─────────────────────────────────────
        ctx.fillStyle = "rgba(30, 41, 59, 0.4)"
        ctx.fillRect(0, waveTop, w, waveH)

        // ── Generate waveform ───────────────────────────────────────
        const barCount = Math.floor(w / 3)
        for (let i = 0; i < barCount; i++) {
            const t = scrollOffset + (i / barCount) * vd
            if (t < 0 || t > duration) continue

            // Pseudo-waveform from events
            let amp = 0.05
            activeEvents.forEach((ev: any) => {
                const evTime = ev.time || 0
                const dist = Math.abs(t - evTime)
                if (dist < 0.5) {
                    amp += (ev.confidence || 0.3) * Math.max(0, 1 - dist * 2) * 0.8
                }
            })
            amp = Math.min(1, amp)

            const x = (i / barCount) * w
            const barH = amp * waveH * 0.45
            const midY = waveTop + waveH / 2

            // Played region tint
            const isPlayed = t <= currentTime
            ctx.fillStyle = isPlayed ? "rgba(99, 102, 241, 0.6)" : "rgba(99, 102, 241, 0.25)"
            ctx.fillRect(x, midY - barH, 2, barH * 2)
        }

        // ── Evidence regions ────────────────────────────────────────
        annotations.filter(a => a.type === "evidence" && a.endTime).forEach(a => {
            const x1 = timeToX(a.time, w)
            const x2 = timeToX(a.endTime!, w)
            ctx.fillStyle = "rgba(239, 68, 68, 0.12)"
            ctx.fillRect(x1, waveTop, x2 - x1, waveH)
            ctx.strokeStyle = "rgba(239, 68, 68, 0.4)"
            ctx.lineWidth = 1
            ctx.setLineDash([4, 4])
            ctx.strokeRect(x1, waveTop, x2 - x1, waveH)
            ctx.setLineDash([])

            // Label
            ctx.fillStyle = "#ef4444"
            ctx.font = "bold 9px monospace"
            ctx.textAlign = "left"
            ctx.fillText(`⚠ ${a.text}`, x1 + 4, waveTop + 12)
        })

        // ── Sound event markers ─────────────────────────────────────
        activeEvents.forEach((ev: any) => {
            const evTime = ev.time || 0
            const x = timeToX(evTime, w)
            if (x < -10 || x > w + 10) return

            const color = CAT_COLORS[ev.type] || "#6366f1"
            const isActive = Math.abs(currentTime - evTime) < 0.3

            // Marker line
            ctx.strokeStyle = `${color}${isActive ? "80" : "30"}`
            ctx.lineWidth = isActive ? 2 : 1
            ctx.beginPath()
            ctx.moveTo(x, waveTop)
            ctx.lineTo(x, waveBot)
            ctx.stroke()

            // Marker dot at top
            ctx.beginPath()
            ctx.arc(x, waveTop - 3, isActive ? 5 : 3, 0, Math.PI * 2)
            ctx.fillStyle = isActive ? "#ffffff" : color
            ctx.fill()

            // Active pulse
            if (isActive) {
                const p = (time % 0.8) / 0.8
                ctx.beginPath()
                ctx.arc(x, waveTop - 3, 3 + p * 12, 0, Math.PI * 2)
                ctx.strokeStyle = color
                ctx.globalAlpha = 1 - p
                ctx.lineWidth = 1.5
                ctx.stroke()
                ctx.globalAlpha = 1
            }

            // Category label (show on hover or active)
            if (isActive && hoveredTime !== null && Math.abs(hoveredTime - evTime) < vd * 0.02) {
                ctx.fillStyle = "#ffffff"
                ctx.font = "bold 9px monospace"
                ctx.textAlign = "center"
                ctx.fillText(ev.type, x, waveBot + 24)
            }
        })

        // ── Annotation markers ──────────────────────────────────────
        annotations.filter(a => a.type !== "evidence" || !a.endTime).forEach(a => {
            const x = timeToX(a.time, w)
            if (x < -20 || x > w + 20) return

            const isSelected = selectedAnnotation === a.id

            // Flag
            ctx.fillStyle = a.color
            ctx.beginPath()
            ctx.moveTo(x, waveTop - 8)
            ctx.lineTo(x + 10, waveTop - 14)
            ctx.lineTo(x + 10, waveTop - 2)
            ctx.closePath()
            ctx.fill()

            // Pole
            ctx.strokeStyle = a.color
            ctx.lineWidth = isSelected ? 2 : 1
            ctx.setLineDash(isSelected ? [] : [3, 3])
            ctx.beginPath()
            ctx.moveTo(x, waveTop - 8)
            ctx.lineTo(x, waveBot)
            ctx.stroke()
            ctx.setLineDash([])

            // Label
            ctx.fillStyle = a.color
            ctx.font = `${isSelected ? "bold " : ""}8px monospace`
            ctx.textAlign = "center"
            ctx.fillText(a.text.substring(0, 20), x, waveBot + 12)
        })

        // ── Playhead ────────────────────────────────────────────────
        const phX = timeToX(currentTime, w)
        if (phX >= 0 && phX <= w) {
            ctx.strokeStyle = "#ffffff"
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(phX, waveTop - 15)
            ctx.lineTo(phX, waveBot + 5)
            ctx.stroke()

            // Playhead triangle
            ctx.fillStyle = "#ffffff"
            ctx.beginPath()
            ctx.moveTo(phX - 6, waveTop - 15)
            ctx.lineTo(phX + 6, waveTop - 15)
            ctx.lineTo(phX, waveTop - 5)
            ctx.closePath()
            ctx.fill()

            // Time label
            ctx.fillStyle = "#ffffff"
            ctx.font = "bold 10px monospace"
            ctx.textAlign = "center"
            const mins = Math.floor(currentTime / 60)
            const secs = (currentTime % 60).toFixed(1)
            ctx.fillText(`${mins}:${secs.padStart(4, "0")}`, phX, waveBot + 38)
        }

        // ── Hover cursor ────────────────────────────────────────────
        if (hoveredTime !== null) {
            const hx = timeToX(hoveredTime, w)
            ctx.strokeStyle = "rgba(255,255,255,0.2)"
            ctx.lineWidth = 1
            ctx.setLineDash([2, 4])
            ctx.beginPath()
            ctx.moveTo(hx, waveTop)
            ctx.lineTo(hx, waveBot)
            ctx.stroke()
            ctx.setLineDash([])
        }

        // ── Region select in progress ───────────────────────────────
        if (addMode === "evidence" && regionStart !== null) {
            const rx = timeToX(regionStart, w)
            const hx = hoveredTime !== null ? timeToX(hoveredTime, w) : rx
            ctx.fillStyle = "rgba(239, 68, 68, 0.15)"
            ctx.fillRect(Math.min(rx, hx), waveTop, Math.abs(hx - rx), waveH)
            ctx.strokeStyle = "#ef4444"
            ctx.lineWidth = 1
            ctx.setLineDash([4, 4])
            ctx.strokeRect(Math.min(rx, hx), waveTop, Math.abs(hx - rx), waveH)
            ctx.setLineDash([])
        }

        // ── Time ruler at bottom ────────────────────────────────────
        const rulerY = waveBot + 42
        ctx.fillStyle = "rgba(30, 41, 59, 0.6)"
        ctx.fillRect(0, rulerY, w, 20)

        const interval = vd > 30 ? 10 : vd > 10 ? 5 : vd > 3 ? 1 : 0.5
        const startT = Math.floor(scrollOffset / interval) * interval
        ctx.fillStyle = "rgba(148, 163, 184, 0.5)"
        ctx.font = "9px monospace"
        ctx.textAlign = "center"
        for (let t = startT; t <= scrollOffset + vd; t += interval) {
            const x = timeToX(t, w)
            if (x < 0 || x > w) continue
            ctx.fillText(`${t.toFixed(1)}s`, x, rulerY + 14)
            ctx.strokeStyle = "rgba(148, 163, 184, 0.2)"
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(x, rulerY)
            ctx.lineTo(x, rulerY + 4)
            ctx.stroke()
        }

        // ── Add mode indicator ──────────────────────────────────────
        if (addMode) {
            const label = addMode === "evidence" && regionStart !== null
                ? "Click to set end of evidence region"
                : `Click to place ${ANNOTATION_TYPES[addMode].label}`
            ctx.fillStyle = ANNOTATION_TYPES[addMode].color
            ctx.font = "bold 10px monospace"
            ctx.textAlign = "right"
            ctx.fillText(`📌 ${label}`, w - 10, 16)
        }
    }, [activeEvents, currentTime, scrollOffset, zoom, duration, annotations, selectedAnnotation, addMode, regionStart, hoveredTime])

    // ── Animation loop ────────────────────────────────────────────────
    useEffect(() => {
        const render = () => {
            if (canvasRef.current) {
                const c = canvasRef.current
                draw(c.getContext("2d")!, c.width, c.height)
            }
            animRef.current = requestAnimationFrame(render)
        }
        render()
        return () => cancelAnimationFrame(animRef.current)
    }, [draw])

    // ── Auto-scroll playhead ──────────────────────────────────────────
    useEffect(() => {
        if (isPlaying) {
            const vd = getVisibleDuration()
            if (currentTime > scrollOffset + vd * 0.9 || currentTime < scrollOffset) {
                setScrollOffset(Math.max(0, currentTime - vd * 0.1))
            }
        }
    }, [currentTime, isPlaying])

    // ── Render ────────────────────────────────────────────────────────
    return (
        <Card className="bg-slate-950/80 border-slate-800 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Badge className="bg-amber-600/20 text-amber-400 border-amber-500/30 font-black text-[10px] tracking-widest">
                        TIMELINE_EDITOR
                    </Badge>
                    <span className="text-[9px] text-slate-500 font-mono">
                        {annotations.length} annotations | Zoom: {zoom.toFixed(1)}x
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    {/* Playback controls */}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSeek(Math.max(0, currentTime - 5))}>
                        <SkipBack className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPlayPause}>
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSeek(Math.min(duration, currentTime + 5))}>
                        <SkipForward className="w-3.5 h-3.5" />
                    </Button>

                    <div className="w-px h-5 bg-slate-700 mx-1" />

                    {/* Zoom */}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(1, z - 1))}>
                        <ZoomOut className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(50, z + 1))}>
                        <ZoomIn className="w-3.5 h-3.5" />
                    </Button>

                    <div className="w-px h-5 bg-slate-700 mx-1" />

                    {/* Scroll */}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScrollOffset(o => Math.max(0, o - getVisibleDuration() * 0.25))}>
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScrollOffset(o => Math.min(duration - getVisibleDuration(), o + getVisibleDuration() * 0.25))}>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Button>

                    <div className="w-px h-5 bg-slate-700 mx-1" />

                    {/* Annotation tools */}
                    {(["marker", "evidence", "note"] as const).map(type => {
                        const cfg = ANNOTATION_TYPES[type]
                        const Icon = cfg.icon
                        return (
                            <Button
                                key={type}
                                variant={addMode === type ? "default" : "ghost"}
                                size="sm"
                                className={`h-7 gap-1 text-[9px] ${addMode === type ? `bg-opacity-80` : ""}`}
                                style={addMode === type ? { backgroundColor: cfg.color } : {}}
                                onClick={() => { setAddMode(addMode === type ? null : type); setRegionStart(null) }}
                            >
                                <Icon className="w-3 h-3" /> {cfg.label}
                            </Button>
                        )
                    })}

                    {selectedAnnotation && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteAnnotation(selectedAnnotation)}>
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                width={1200}
                height={200}
                className="w-full cursor-crosshair"
                style={{ height: "200px" }}
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={() => setHoveredTime(null)}
                onWheel={handleCanvasWheel}
            />

            {/* Annotation text input popup */}
            {showAnnotationInput && (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/90 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono">LABEL:</span>
                    <input
                        autoFocus
                        value={annotationText}
                        onChange={e => setAnnotationText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") confirmAnnotation(); if (e.key === "Escape") { setShowAnnotationInput(false); setAddMode(null); setRegionStart(null) } }}
                        placeholder={addMode ? ANNOTATION_TYPES[addMode].label : "Label..."}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
                    />
                    <Button size="sm" className="h-7 text-xs" onClick={confirmAnnotation}>Add</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAnnotationInput(false); setAddMode(null); setRegionStart(null) }}>Cancel</Button>
                </div>
            )}

            {/* Annotation list */}
            {annotations.length > 0 && (
                <div className="px-4 py-2 bg-slate-900/50 border-t border-slate-800 flex flex-wrap gap-2">
                    {annotations.map(a => (
                        <Badge
                            key={a.id}
                            variant="outline"
                            className={`text-[9px] cursor-pointer transition-all ${selectedAnnotation === a.id ? "ring-1 ring-white scale-105" : "opacity-70 hover:opacity-100"}`}
                            style={{ borderColor: a.color, color: a.color }}
                            onClick={() => { setSelectedAnnotation(a.id); onSeek(a.time) }}
                        >
                            {a.type === "evidence" ? "⚠" : a.type === "marker" ? "🔖" : "📝"} {a.text} @ {a.time.toFixed(1)}s
                        </Badge>
                    ))}
                </div>
            )}
        </Card>
    )
}
