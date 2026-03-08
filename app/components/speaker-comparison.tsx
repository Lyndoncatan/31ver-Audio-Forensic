"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { UserCheck, Upload, Mic2, BarChart3, CheckCircle, XCircle } from "lucide-react"

interface SpeakerComparisonProps { audioData: any }

export default function SpeakerComparison({ audioData }: SpeakerComparisonProps) {
    const [referenceUrl, setReferenceUrl] = useState<string | null>(null)
    const [referenceName, setReferenceName] = useState("")
    const [isComparing, setIsComparing] = useState(false)
    const [progress, setProgress] = useState(0)
    const [matchResult, setMatchResult] = useState<{ score: number; segments: { time: number; match: number }[] } | null>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setReferenceName(file.name)
        setReferenceUrl(URL.createObjectURL(file))
        setMatchResult(null)
    }

    const runComparison = async () => {
        if (!audioData?.url || !referenceUrl) return
        setIsComparing(true); setProgress(0)

        const ctx = new AudioContext()

        // Load both audio files
        const [mainBuf, refBuf] = await Promise.all([
            fetch(audioData.url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)),
            fetch(referenceUrl).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)),
        ])
        setProgress(30)

        const mainData = mainBuf.getChannelData(0)
        const refData = refBuf.getChannelData(0)

        // Extract MFCC-like features (simplified spectral envelope)
        const extractFeatures = (data: Float32Array, sampleRate: number) => {
            const frameSize = 1024
            const hopSize = 512
            const features: number[][] = []
            for (let i = 0; i + frameSize < data.length; i += hopSize) {
                const frame: number[] = []
                // Compute energy in frequency bands
                for (let band = 0; band < 13; band++) {
                    let energy = 0
                    const lo = Math.floor((band / 13) * frameSize / 2)
                    const hi = Math.floor(((band + 1) / 13) * frameSize / 2)
                    for (let k = lo; k < hi; k++) {
                        const val = data[i + k] || 0
                        energy += val * val
                    }
                    frame.push(Math.log(energy + 1e-10))
                }
                features.push(frame)
            }
            return features
        }

        setProgress(50)
        await new Promise(r => setTimeout(r, 200))

        const mainFeats = extractFeatures(mainData, mainBuf.sampleRate)
        const refFeats = extractFeatures(refData, refBuf.sampleRate)

        setProgress(70)

        // Compute reference centroid
        const refCentroid = Array(13).fill(0)
        refFeats.forEach(f => f.forEach((v, i) => refCentroid[i] += v))
        refCentroid.forEach((_, i) => refCentroid[i] /= refFeats.length)

        // Compare each segment of main audio to reference
        const segmentSize = Math.floor(mainFeats.length / 20) || 1
        const segments: { time: number; match: number }[] = []

        for (let s = 0; s < 20 && s * segmentSize < mainFeats.length; s++) {
            const segStart = s * segmentSize
            const segEnd = Math.min(segStart + segmentSize, mainFeats.length)
            const segCentroid = Array(13).fill(0)
            for (let i = segStart; i < segEnd; i++) mainFeats[i].forEach((v, j) => segCentroid[j] += v)
            segCentroid.forEach((_, i) => segCentroid[i] /= (segEnd - segStart))

            // Cosine similarity
            let dot = 0, magA = 0, magB = 0
            for (let i = 0; i < 13; i++) { dot += segCentroid[i] * refCentroid[i]; magA += segCentroid[i] ** 2; magB += refCentroid[i] ** 2 }
            const similarity = dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-10)
            const matchPct = Math.max(0, Math.min(100, similarity * 100))

            segments.push({ time: (segStart * 512 / mainBuf.sampleRate), match: matchPct })
        }

        setProgress(90)
        await new Promise(r => setTimeout(r, 200))

        const avgScore = segments.reduce((s, seg) => s + seg.match, 0) / segments.length
        setMatchResult({ score: Math.round(avgScore), segments })
        setProgress(100)
        setIsComparing(false)
        ctx.close()
    }

    // Draw comparison visualization
    const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
        ctx.fillStyle = "#020617"
        ctx.fillRect(0, 0, w, h)

        if (!matchResult) {
            ctx.fillStyle = "rgba(148,163,184,0.3)"; ctx.font = "12px monospace"; ctx.textAlign = "center"
            ctx.fillText("Upload reference voice + run comparison to see results", w / 2, h / 2)
            return
        }

        const padL = 40, padR = 20, padT = 30, padB = 30
        const dw = w - padL - padR, dh = h - padT - padB
        const barW = dw / matchResult.segments.length

        // Title
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "bold 10px monospace"; ctx.textAlign = "left"
        ctx.fillText("VOICE MATCH TIMELINE", padL, 16)

        // Threshold line at 70%
        const threshY = padT + dh * 0.3
        ctx.strokeStyle = "rgba(239,68,68,0.3)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
        ctx.beginPath(); ctx.moveTo(padL, threshY); ctx.lineTo(w - padR, threshY); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = "rgba(239,68,68,0.5)"; ctx.font = "8px monospace"; ctx.textAlign = "right"
        ctx.fillText("70% threshold", w - padR - 4, threshY - 4)

        // Bars
        matchResult.segments.forEach((seg, i) => {
            const barH = (seg.match / 100) * dh
            const x = padL + i * barW
            const y = padT + dh - barH

            const color = seg.match > 70 ? "#22c55e" : seg.match > 40 ? "#f59e0b" : "#ef4444"
            ctx.fillStyle = color
            ctx.globalAlpha = 0.7
            ctx.fillRect(x + 2, y, barW - 4, barH)
            ctx.globalAlpha = 1

            // Score label
            ctx.fillStyle = color; ctx.font = "bold 8px monospace"; ctx.textAlign = "center"
            ctx.fillText(`${Math.round(seg.match)}`, x + barW / 2, y - 4)

            // Time label
            ctx.fillStyle = "rgba(148,163,184,0.4)"; ctx.font = "7px monospace"
            ctx.fillText(`${seg.time.toFixed(1)}s`, x + barW / 2, padT + dh + 14)
        })

        // Y axis
        ctx.fillStyle = "rgba(148,163,184,0.4)"; ctx.font = "8px monospace"; ctx.textAlign = "right"
        for (let p = 0; p <= 100; p += 25) {
            const y = padT + dh - (p / 100) * dh
            ctx.fillText(`${p}%`, padL - 6, y + 3)
        }
    }, [matchResult])

    useEffect(() => {
        const render = () => { if (canvasRef.current) draw(canvasRef.current.getContext("2d")!, canvasRef.current.width, canvasRef.current.height); requestAnimationFrame(render) }
        const id = requestAnimationFrame(render); return () => cancelAnimationFrame(id)
    }, [draw])

    return (
        <Card className="bg-slate-950/80 border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <Badge className="bg-violet-600/20 text-violet-400 border-violet-500/30 font-black text-[10px] tracking-widest">SPEAKER_MATCH</Badge>
                    <span className="text-[9px] text-slate-500 font-mono">Compare voice samples</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 flex-wrap">
                <input ref={fileRef} type="file" accept="audio/*" onChange={handleRefUpload} className="hidden" />
                <Button variant="outline" size="sm" className="gap-2 border-slate-700 text-xs" onClick={() => fileRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5" /> {referenceUrl ? referenceName : "Upload Reference Voice"}
                </Button>
                {referenceUrl && (
                    <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30">
                        <Mic2 className="w-3 h-3 mr-1" /> Reference loaded
                    </Badge>
                )}
                <Button size="sm" className="gap-2 bg-violet-600 hover:bg-violet-700 text-xs ml-auto" onClick={runComparison} disabled={isComparing || !audioData?.url || !referenceUrl}>
                    <UserCheck className="w-3.5 h-3.5" /> {isComparing ? "Comparing..." : "Compare Voices"}
                </Button>
            </div>

            {isComparing && <div className="px-4 py-2"><Progress value={progress} className="h-1" /></div>}

            {/* Overall result */}
            {matchResult && (
                <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-800">
                    {matchResult.score > 70 ? <CheckCircle className="w-8 h-8 text-emerald-400" /> : <XCircle className="w-8 h-8 text-red-400" />}
                    <div>
                        <div className={`text-2xl font-black ${matchResult.score > 70 ? "text-emerald-400" : matchResult.score > 40 ? "text-amber-400" : "text-red-400"}`}>
                            {matchResult.score}% Match
                        </div>
                        <div className="text-[10px] text-slate-500">
                            {matchResult.score > 70 ? "High confidence voice match" : matchResult.score > 40 ? "Partial similarity detected" : "Voice does not match reference"}
                        </div>
                    </div>
                </div>
            )}

            <canvas ref={canvasRef} width={900} height={180} className="w-full" style={{ height: "180px" }} />
        </Card>
    )
}
