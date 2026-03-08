"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import {
    Volume2, VolumeX, AudioWaveform, Wand2, RotateCcw, Play, Pause, Download
} from "lucide-react"

// ─── PRESETS ────────────────────────────────────────────────────────
const PRESETS = [
    { name: "Raw", noiseGate: 0, gain: 0, lowCut: 20, highCut: 20000, description: "No processing" },
    { name: "Voice Clarity", noiseGate: -40, gain: 6, lowCut: 200, highCut: 4000, description: "Isolate human speech" },
    { name: "Indoor", noiseGate: -45, gain: 3, lowCut: 80, highCut: 12000, description: "Reduce room hum" },
    { name: "Outdoor", noiseGate: -35, gain: 4, lowCut: 150, highCut: 8000, description: "Cut wind & traffic" },
    { name: "Phone Call", noiseGate: -38, gain: 8, lowCut: 300, highCut: 3400, description: "Phone bandwidth" },
    { name: "Forensic Max", noiseGate: -50, gain: 10, lowCut: 50, highCut: 16000, description: "Max enhancement" },
]

interface AudioEnhancerProps {
    audioData: any
}

export default function AudioEnhancer({ audioData }: AudioEnhancerProps) {
    // Enhancement state
    const [noiseGate, setNoiseGate] = useState(0)    // dB threshold
    const [gain, setGain] = useState(0)               // dB boost
    const [lowCut, setLowCut] = useState(20)           // Hz
    const [highCut, setHighCut] = useState(20000)      // Hz
    const [activePreset, setActivePreset] = useState("Raw")
    const [isProcessing, setIsProcessing] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const [enhanced, setEnhanced] = useState(false)

    // Audio context refs
    const audioCtxRef = useRef<AudioContext | null>(null)
    const sourceRef = useRef<AudioBufferSourceNode | null>(null)
    const gainNodeRef = useRef<GainNode | null>(null)
    const lowFilterRef = useRef<BiquadFilterNode | null>(null)
    const highFilterRef = useRef<BiquadFilterNode | null>(null)
    const bufferRef = useRef<AudioBuffer | null>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)

    // Load audio buffer
    useEffect(() => {
        if (!audioData?.url) return
        const ctx = new AudioContext()
        audioCtxRef.current = ctx

        fetch(audioData.url)
            .then(r => r.arrayBuffer())
            .then(buf => ctx.decodeAudioData(buf))
            .then(decoded => { bufferRef.current = decoded })
            .catch(() => { })

        return () => { ctx.close() }
    }, [audioData?.url])

    // Apply preset
    const applyPreset = (preset: typeof PRESETS[0]) => {
        setNoiseGate(preset.noiseGate)
        setGain(preset.gain)
        setLowCut(preset.lowCut)
        setHighCut(preset.highCut)
        setActivePreset(preset.name)
        setEnhanced(preset.name !== "Raw")
    }

    // Play enhanced audio
    const togglePlay = () => {
        if (!bufferRef.current || !audioCtxRef.current) return
        const ctx = audioCtxRef.current

        if (isPlaying && sourceRef.current) {
            sourceRef.current.stop()
            setIsPlaying(false)
            return
        }

        const source = ctx.createBufferSource()
        source.buffer = bufferRef.current

        // Gain
        const gainNode = ctx.createGain()
        gainNode.gain.value = Math.pow(10, gain / 20) // dB to linear

        // High-pass (low cut)
        const hpf = ctx.createBiquadFilter()
        hpf.type = "highpass"
        hpf.frequency.value = lowCut
        hpf.Q.value = 0.707

        // Low-pass (high cut)
        const lpf = ctx.createBiquadFilter()
        lpf.type = "lowpass"
        lpf.frequency.value = highCut
        lpf.Q.value = 0.707

        // Connect chain
        source.connect(hpf)
        hpf.connect(lpf)
        lpf.connect(gainNode)
        gainNode.connect(ctx.destination)

        sourceRef.current = source
        gainNodeRef.current = gainNode
        lowFilterRef.current = hpf
        highFilterRef.current = lpf

        source.start()
        source.onended = () => setIsPlaying(false)
        setIsPlaying(true)
        setEnhanced(true)
    }

    // Draw before/after comparison
    const drawComparison = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
        ctx.fillStyle = "#020617"
        ctx.fillRect(0, 0, w, h)

        if (!bufferRef.current) {
            ctx.fillStyle = "rgba(148,163,184,0.3)"
            ctx.font = "12px monospace"
            ctx.textAlign = "center"
            ctx.fillText("Upload audio to see waveform comparison", w / 2, h / 2)
            return
        }

        const data = bufferRef.current.getChannelData(0)
        const halfH = h / 2
        const midTop = halfH - 10
        const midBot = halfH + 10

        // Divider
        ctx.fillStyle = "rgba(99,102,241,0.3)"
        ctx.fillRect(0, halfH - 1, w, 2)
        ctx.fillStyle = "rgba(148,163,184,0.6)"
        ctx.font = "bold 9px monospace"
        ctx.textAlign = "left"
        ctx.fillText("ORIGINAL", 8, 16)
        ctx.fillStyle = "#22c55e"
        ctx.fillText("ENHANCED", 8, halfH + 16)

        const step = Math.ceil(data.length / w)
        const gainLinear = Math.pow(10, gain / 20)

        for (let px = 0; px < w; px++) {
            const idx = Math.floor(px * (data.length / w))
            let maxSample = 0
            for (let s = 0; s < step && idx + s < data.length; s++) {
                maxSample = Math.max(maxSample, Math.abs(data[idx + s]))
            }

            // Original (top half)
            const origH = maxSample * (midTop - 20)
            ctx.fillStyle = "rgba(99,102,241,0.5)"
            ctx.fillRect(px, midTop / 2 + 10 - origH / 2, 1, origH)

            // Enhanced (bottom half) — apply gain and gate
            let enhSample = maxSample * gainLinear
            const sampleDB = 20 * Math.log10(Math.max(0.00001, maxSample))
            if (sampleDB < noiseGate) enhSample = 0 // gate

            const enhH = Math.min(enhSample, 1) * (midTop - 20)
            ctx.fillStyle = enhSample > 0 ? "rgba(34,197,94,0.6)" : "rgba(34,197,94,0.1)"
            ctx.fillRect(px, halfH + (halfH - 20) / 2 + 10 - enhH / 2, 1, Math.max(1, enhH))
        }

        // Filter band indicator
        const freqToX = (f: number) => (Math.log10(f) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * w
        const lcX = freqToX(lowCut)
        const hcX = freqToX(highCut)

        // Grayed-out areas (filtered out)
        ctx.fillStyle = "rgba(239,68,68,0.1)"
        ctx.fillRect(0, halfH, lcX, halfH)
        ctx.fillRect(hcX, halfH, w - hcX, halfH)

        // Band lines
        if (lowCut > 20) {
            ctx.strokeStyle = "rgba(239,68,68,0.4)"
            ctx.lineWidth = 1
            ctx.setLineDash([3, 3])
            ctx.beginPath(); ctx.moveTo(lcX, halfH); ctx.lineTo(lcX, h); ctx.stroke()
            ctx.setLineDash([])
            ctx.fillStyle = "#ef4444"
            ctx.font = "8px monospace"
            ctx.textAlign = "center"
            ctx.fillText(`${lowCut}Hz`, lcX, h - 4)
        }
        if (highCut < 20000) {
            ctx.strokeStyle = "rgba(239,68,68,0.4)"
            ctx.lineWidth = 1
            ctx.setLineDash([3, 3])
            ctx.beginPath(); ctx.moveTo(hcX, halfH); ctx.lineTo(hcX, h); ctx.stroke()
            ctx.setLineDash([])
            ctx.fillStyle = "#ef4444"
            ctx.font = "8px monospace"
            ctx.textAlign = "center"
            ctx.fillText(`${highCut}Hz`, hcX, h - 4)
        }

        // Settings HUD
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = "9px monospace"
        ctx.textAlign = "right"
        ctx.fillText(`Gate: ${noiseGate}dB | Gain: +${gain}dB | Band: ${lowCut}-${highCut}Hz`, w - 8, 16)
    }, [noiseGate, gain, lowCut, highCut])

    useEffect(() => {
        const render = () => {
            if (canvasRef.current) drawComparison(canvasRef.current.getContext("2d")!, canvasRef.current.width, canvasRef.current.height)
            animRef.current = requestAnimationFrame(render)
        }
        render()
        return () => cancelAnimationFrame(animRef.current)
    }, [drawComparison])

    return (
        <Card className="bg-slate-950/80 border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 font-black text-[10px] tracking-widest">
                        AUDIO_ENHANCER
                    </Badge>
                    <span className="text-[9px] text-slate-500 font-mono">Noise Reduction & Enhancement</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-[9px]" onClick={togglePlay}>
                        {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        {isPlaying ? "Stop" : "Preview Enhanced"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-[9px]" onClick={() => applyPreset(PRESETS[0])}>
                        <RotateCcw className="w-3 h-3" /> Reset
                    </Button>
                </div>
            </div>

            {/* Presets */}
            <div className="flex gap-2 px-4 py-2 bg-slate-900/40 border-b border-slate-800 overflow-x-auto">
                {PRESETS.map(p => (
                    <Button
                        key={p.name}
                        size="sm"
                        variant={activePreset === p.name ? "default" : "outline"}
                        className={`h-7 text-[9px] whitespace-nowrap ${activePreset === p.name ? "bg-emerald-600" : "border-slate-700"}`}
                        onClick={() => applyPreset(p)}
                    >
                        <Wand2 className="w-3 h-3 mr-1" /> {p.name}
                    </Button>
                ))}
            </div>

            {/* Waveform comparison */}
            <canvas ref={canvasRef} width={900} height={200} className="w-full" style={{ height: "200px" }} />

            {/* Controls */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
                <div className="space-y-2">
                    <label className="text-[9px] font-mono text-slate-400 flex items-center gap-1">
                        <VolumeX className="w-3 h-3" /> NOISE GATE: {noiseGate} dB
                    </label>
                    <Slider value={[noiseGate]} min={-60} max={0} step={1} onValueChange={([v]) => { setNoiseGate(v); setActivePreset("Custom") }} />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-mono text-slate-400 flex items-center gap-1">
                        <Volume2 className="w-3 h-3" /> GAIN: +{gain} dB
                    </label>
                    <Slider value={[gain]} min={0} max={20} step={1} onValueChange={([v]) => { setGain(v); setActivePreset("Custom") }} />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-mono text-slate-400 flex items-center gap-1">
                        <AudioWaveform className="w-3 h-3" /> LOW CUT: {lowCut} Hz
                    </label>
                    <Slider value={[lowCut]} min={20} max={2000} step={10} onValueChange={([v]) => { setLowCut(v); setActivePreset("Custom") }} />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-mono text-slate-400 flex items-center gap-1">
                        <AudioWaveform className="w-3 h-3" /> HIGH CUT: {highCut} Hz
                    </label>
                    <Slider value={[highCut]} min={1000} max={20000} step={100} onValueChange={([v]) => { setHighCut(v); setActivePreset("Custom") }} />
                </div>
            </div>
        </Card>
    )
}
