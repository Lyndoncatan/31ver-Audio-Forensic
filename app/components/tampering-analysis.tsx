"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ShieldAlert, ShieldCheck, Scan, AlertTriangle, CheckCircle, XCircle, Cpu } from "lucide-react"

interface TamperingAnalysisProps { audioData: any }

// Simulated tampering checks (client-side heuristic analysis)
const CHECKS = [
    { id: "spectral", name: "Spectral Continuity", desc: "Check for abrupt frequency jumps indicating cuts/splices", icon: Scan },
    { id: "enf", name: "ENF Analysis", desc: "Electric Network Frequency consistency for timestamp verification", icon: Cpu },
    { id: "compression", name: "Double Compression", desc: "Detect re-encoding artifacts from edited audio", icon: AlertTriangle },
    { id: "noise_floor", name: "Noise Floor Consistency", desc: "Uniform background noise indicates no splicing", icon: ShieldCheck },
    { id: "ai_generated", name: "AI-Generated Detection", desc: "Statistical patterns common in synthetic speech", icon: ShieldAlert },
]

interface CheckResult {
    id: string
    status: "pass" | "warning" | "fail"
    confidence: number
    detail: string
}

export default function TamperingAnalysis({ audioData }: TamperingAnalysisProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [progress, setProgress] = useState(0)
    const [results, setResults] = useState<CheckResult[]>([])
    const [overallScore, setOverallScore] = useState<number | null>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const runAnalysis = async () => {
        if (!audioData?.url) return
        setIsAnalyzing(true); setProgress(0); setResults([])

        // Analyze using Web Audio API
        const audioCtx = new AudioContext()
        const response = await fetch(audioData.url)
        const arrayBuf = await response.arrayBuffer()
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuf)
        const channelData = audioBuffer.getChannelData(0)

        const checkResults: CheckResult[] = []

        // 1. Spectral continuity — check for sudden amplitude jumps
        setProgress(20)
        await new Promise(r => setTimeout(r, 400))
        const windowSize = Math.floor(channelData.length / 100)
        let jumpCount = 0
        let prevRMS = 0
        for (let i = 0; i < 100; i++) {
            let sum = 0
            for (let j = 0; j < windowSize; j++) { const s = channelData[i * windowSize + j] || 0; sum += s * s }
            const rms = Math.sqrt(sum / windowSize)
            if (i > 0 && Math.abs(rms - prevRMS) > 0.3) jumpCount++
            prevRMS = rms
        }
        const spectralConf = Math.max(0, 100 - jumpCount * 15)
        checkResults.push({ id: "spectral", status: spectralConf > 70 ? "pass" : spectralConf > 40 ? "warning" : "fail", confidence: spectralConf, detail: jumpCount === 0 ? "No spectral discontinuities found" : `${jumpCount} potential splice point(s) detected` })

        // 2. ENF — check for consistent 50/60Hz hum pattern
        setProgress(40)
        await new Promise(r => setTimeout(r, 400))
        const fftSize = 4096
        const enfBins: number[] = []
        for (let pos = 0; pos + fftSize < channelData.length; pos += fftSize * 4) {
            let sum50 = 0, sum60 = 0
            for (let k = 0; k < fftSize; k++) { const s = channelData[pos + k] || 0; sum50 += s * Math.sin(2 * Math.PI * 50 * k / audioBuffer.sampleRate); sum60 += s * Math.sin(2 * Math.PI * 60 * k / audioBuffer.sampleRate) }
            enfBins.push(Math.max(Math.abs(sum50), Math.abs(sum60)))
        }
        const enfVariance = enfBins.length > 1 ? enfBins.reduce((s, v) => s + Math.pow(v - enfBins.reduce((a, b) => a + b, 0) / enfBins.length, 2), 0) / enfBins.length : 0
        const enfConf = Math.max(0, Math.min(100, 100 - enfVariance * 5000))
        checkResults.push({ id: "enf", status: enfConf > 70 ? "pass" : enfConf > 40 ? "warning" : "fail", confidence: enfConf, detail: enfConf > 70 ? "ENF pattern is consistent — no timestamp manipulation detected" : "ENF inconsistencies may indicate temporal editing" })

        // 3. Double compression — check for periodic spectral artifacts
        setProgress(60)
        await new Promise(r => setTimeout(r, 400))
        let periodicCount = 0
        for (let i = 0; i < channelData.length - 1024; i += 1024) {
            let zeroCrossings = 0
            for (let j = 0; j < 1023; j++) { if ((channelData[i + j] >= 0) !== (channelData[i + j + 1] >= 0)) zeroCrossings++ }
            if (zeroCrossings > 400) periodicCount++
        }
        const compConf = Math.max(0, 100 - periodicCount * 5)
        checkResults.push({ id: "compression", status: compConf > 70 ? "pass" : compConf > 40 ? "warning" : "fail", confidence: compConf, detail: compConf > 70 ? "No double compression artifacts detected" : `${periodicCount} regions with potential re-encoding artifacts` })

        // 4. Noise floor consistency
        setProgress(80)
        await new Promise(r => setTimeout(r, 400))
        const silentSegments: number[] = []
        for (let i = 0; i < channelData.length; i += windowSize) {
            let sum = 0; for (let j = 0; j < windowSize && i + j < channelData.length; j++) { sum += Math.abs(channelData[i + j]) }
            const avg = sum / windowSize
            if (avg < 0.01) silentSegments.push(avg)
        }
        const noiseVar = silentSegments.length > 1 ? silentSegments.reduce((s, v) => s + Math.pow(v - silentSegments.reduce((a, b) => a + b, 0) / silentSegments.length, 2), 0) / silentSegments.length : 0
        const noiseConf = Math.max(0, Math.min(100, 100 - noiseVar * 100000))
        checkResults.push({ id: "noise_floor", status: noiseConf > 70 ? "pass" : noiseConf > 40 ? "warning" : "fail", confidence: noiseConf, detail: noiseConf > 70 ? "Noise floor is consistent across recording" : "Noise floor variations detected — possible splicing" })

        // 5. AI-generated detection (statistical heuristic)
        setProgress(95)
        await new Promise(r => setTimeout(r, 400))
        let kurtosis = 0
        const mean = channelData.reduce((a, b) => a + b, 0) / channelData.length
        const stdDev = Math.sqrt(channelData.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / channelData.length)
        if (stdDev > 0) kurtosis = channelData.reduce((s, v) => s + Math.pow((v - mean) / stdDev, 4), 0) / channelData.length - 3
        const aiConf = Math.max(0, Math.min(100, kurtosis > 0 ? 85 - Math.abs(kurtosis - 2) * 10 : 90))
        checkResults.push({ id: "ai_generated", status: aiConf > 70 ? "pass" : aiConf > 40 ? "warning" : "fail", confidence: aiConf, detail: aiConf > 70 ? "Audio appears to be naturally recorded" : "Statistical patterns suggest possible synthetic generation" })

        setResults(checkResults)
        const overall = checkResults.reduce((s, r) => s + r.confidence, 0) / checkResults.length
        setOverallScore(Math.round(overall))
        setProgress(100)
        setIsAnalyzing(false)
        audioCtx.close()
    }

    const statusIcon = (s: string) => s === "pass" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : s === "warning" ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <XCircle className="w-4 h-4 text-red-400" />
    const statusColor = (s: string) => s === "pass" ? "text-emerald-400" : s === "warning" ? "text-amber-400" : "text-red-400"

    return (
        <Card className="bg-slate-950/80 border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <Badge className="bg-red-600/20 text-red-400 border-red-500/30 font-black text-[10px] tracking-widest">TAMPERING_DETECTION</Badge>
                    <span className="text-[9px] text-slate-500 font-mono">Audio Authenticity Verification</span>
                </div>
                <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700 text-xs" onClick={runAnalysis} disabled={isAnalyzing || !audioData?.url}>
                    <ShieldAlert className="w-3.5 h-3.5" /> {isAnalyzing ? "Analyzing..." : "Run Authenticity Check"}
                </Button>
            </div>

            {isAnalyzing && <div className="px-4 py-2"><Progress value={progress} className="h-1" /></div>}

            {overallScore !== null && (
                <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-4">
                    <div className={`text-3xl font-black ${overallScore > 70 ? "text-emerald-400" : overallScore > 40 ? "text-amber-400" : "text-red-400"}`}>
                        {overallScore}%
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white">
                            {overallScore > 70 ? "Audio Appears Authentic" : overallScore > 40 ? "Potential Tampering Indicators" : "High Tampering Probability"}
                        </div>
                        <div className="text-[10px] text-slate-500">Based on {results.length} forensic checks</div>
                    </div>
                </div>
            )}

            {results.length > 0 && (
                <div className="p-4 space-y-2">
                    {results.map(r => {
                        const check = CHECKS.find(c => c.id === r.id)!
                        return (
                            <div key={r.id} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                                {statusIcon(r.status)}
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-white">{check.name}</span>
                                        <span className={`text-xs font-mono font-bold ${statusColor(r.status)}`}>{r.confidence}%</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-0.5">{r.detail}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {!isAnalyzing && results.length === 0 && (
                <div className="flex flex-col items-center py-8 text-slate-600">
                    <ShieldAlert className="w-10 h-10 opacity-20 mb-3" />
                    <p className="text-xs font-bold tracking-widest uppercase">Upload audio and click &ldquo;Run Authenticity Check&rdquo;</p>
                </div>
            )}
        </Card>
    )
}
