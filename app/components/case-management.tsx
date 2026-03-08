"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    FolderPlus, FileAudio, Trash2, Edit3, Calendar, MapPin, Search,
    ChevronRight, Download, Clock, File, CheckCircle
} from "lucide-react"

// ─── TYPES ──────────────────────────────────────────────────────────
interface CaseFile {
    id: string
    name: string
    addedAt: string
    duration: number
    analyzed: boolean
    analysisResults?: any
}

interface ForensicCase {
    id: string
    name: string
    description: string
    location: string
    createdAt: string
    updatedAt: string
    status: "open" | "closed" | "archived"
    files: CaseFile[]
    notes: string
}

// ─── STORAGE ────────────────────────────────────────────────────────
const STORAGE_KEY = "forensic_cases_v1"

const loadCases = (): ForensicCase[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY)
        return data ? JSON.parse(data) : []
    } catch { return [] }
}

const saveCases = (cases: ForensicCase[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases))
}

// ─── COMPONENT ──────────────────────────────────────────────────────
interface CaseManagementProps {
    audioData?: any
    onLoadCase?: (caseData: ForensicCase) => void
}

export default function CaseManagement({ audioData, onLoadCase }: CaseManagementProps) {
    const [cases, setCases] = useState<ForensicCase[]>([])
    const [selectedCase, setSelectedCase] = useState<string | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [editingNotes, setEditingNotes] = useState(false)

    // Form state
    const [newName, setNewName] = useState("")
    const [newDesc, setNewDesc] = useState("")
    const [newLocation, setNewLocation] = useState("")

    useEffect(() => { setCases(loadCases()) }, [])

    const saveAndUpdate = (updated: ForensicCase[]) => {
        setCases(updated)
        saveCases(updated)
    }

    const createCase = () => {
        if (!newName.trim()) return
        const newCase: ForensicCase = {
            id: `case_${Date.now()}`,
            name: newName,
            description: newDesc,
            location: newLocation,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: "open",
            files: [],
            notes: "",
        }
        saveAndUpdate([newCase, ...cases])
        setNewName(""); setNewDesc(""); setNewLocation("")
        setShowCreate(false)
        setSelectedCase(newCase.id)
    }

    const deleteCase = (id: string) => {
        saveAndUpdate(cases.filter(c => c.id !== id))
        if (selectedCase === id) setSelectedCase(null)
    }

    const attachCurrentAudio = () => {
        if (!audioData || !selectedCase) return
        const updated = cases.map(c => {
            if (c.id !== selectedCase) return c
            return {
                ...c,
                updatedAt: new Date().toISOString(),
                files: [...c.files, {
                    id: `file_${Date.now()}`,
                    name: audioData.name || "Recording",
                    addedAt: new Date().toISOString(),
                    duration: audioData.duration || 0,
                    analyzed: !!audioData.analysisResults,
                    analysisResults: audioData.analysisResults,
                }]
            }
        })
        saveAndUpdate(updated)
    }

    const updateNotes = (notes: string) => {
        const updated = cases.map(c => c.id === selectedCase ? { ...c, notes, updatedAt: new Date().toISOString() } : c)
        saveAndUpdate(updated)
    }

    const toggleStatus = (id: string) => {
        const updated = cases.map(c => {
            if (c.id !== id) return c
            const nextStatus = (c.status === "open" ? "closed" : c.status === "closed" ? "archived" : "open") as "open" | "closed" | "archived"
            return { ...c, status: nextStatus, updatedAt: new Date().toISOString() }
        })
        saveAndUpdate(updated)
    }

    const removeFile = (caseId: string, fileId: string) => {
        const updated = cases.map(c => c.id === caseId ? { ...c, files: c.files.filter(f => f.id !== fileId) } : c)
        saveAndUpdate(updated)
    }

    const activeCase = cases.find(c => c.id === selectedCase)
    const filtered = cases.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.location.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const statusColors = { open: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", closed: "text-blue-400 bg-blue-500/10 border-blue-500/30", archived: "text-slate-400 bg-slate-500/10 border-slate-500/30" }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black italic tracking-tighter uppercase">Case Management</h2>
                    <span className="text-[10px] text-slate-500 tracking-widest uppercase font-mono">Organize forensic evidence by case</span>
                </div>
                <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowCreate(!showCreate)}>
                    <FolderPlus className="w-4 h-4" /> New Case
                </Button>
            </div>

            {/* Create form */}
            {showCreate && (
                <Card className="bg-slate-900/80 border-slate-700 p-4 space-y-3">
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Case Name (e.g. Case #2024-0087)" className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
                    <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description" className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
                    <input value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="Location (optional)" className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
                    <div className="flex gap-2">
                        <Button size="sm" className="bg-emerald-600" onClick={createCase}>Create Case</Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                    </div>
                </Card>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search cases..." className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-indigo-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Case list */}
                <div className="lg:col-span-1 space-y-2 max-h-[500px] overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="text-center py-8 text-slate-600 text-sm">No cases yet. Create one to get started.</div>
                    ) : filtered.map(c => (
                        <Card
                            key={c.id}
                            className={`cursor-pointer transition-all border ${selectedCase === c.id ? "border-indigo-500 bg-indigo-950/30" : "border-slate-800 bg-slate-950/60 hover:border-slate-700"}`}
                            onClick={() => setSelectedCase(c.id)}
                        >
                            <div className="p-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-sm text-white truncate">{c.name}</span>
                                    <Badge variant="outline" className={`text-[8px] ${statusColors[c.status]}`}>
                                        {c.status.toUpperCase()}
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1 truncate">{c.description || "No description"}</p>
                                <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-600">
                                    {c.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>}
                                    <span className="flex items-center gap-1"><FileAudio className="w-3 h-3" />{c.files.length} files</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(c.updatedAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Case detail */}
                <div className="lg:col-span-2">
                    {activeCase ? (
                        <Card className="bg-slate-950/80 border-slate-800">
                            <CardHeader className="pb-2 border-b border-slate-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg font-black">{activeCase.name}</CardTitle>
                                        <p className="text-xs text-slate-500 mt-1">{activeCase.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" className="h-7 text-[9px] border-slate-700" onClick={() => toggleStatus(activeCase.id)}>
                                            {activeCase.status === "open" ? "Close" : activeCase.status === "closed" ? "Archive" : "Reopen"}
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteCase(activeCase.id)}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                {/* Attach audio */}
                                {audioData && (
                                    <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 w-full" onClick={attachCurrentAudio}>
                                        <FileAudio className="w-4 h-4" /> Attach Current Audio to Case
                                    </Button>
                                )}

                                {/* Evidence files */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Evidence Files ({activeCase.files.length})</h3>
                                    {activeCase.files.length === 0 ? (
                                        <p className="text-xs text-slate-600 text-center py-4">No files attached. Upload & analyze audio, then attach it.</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {activeCase.files.map(f => (
                                                <div key={f.id} className="flex items-center justify-between p-2 bg-slate-900/60 rounded text-xs border border-slate-800">
                                                    <div className="flex items-center gap-2">
                                                        <File className="w-3.5 h-3.5 text-indigo-400" />
                                                        <span className="text-white font-semibold">{f.name}</span>
                                                        <span className="text-slate-500">{f.duration.toFixed(1)}s</span>
                                                        {f.analyzed && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-500 hover:text-red-400" onClick={() => removeFile(activeCase.id, f.id)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Notes */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Case Notes</h3>
                                        <Button variant="ghost" size="sm" className="h-6 text-[9px]" onClick={() => setEditingNotes(!editingNotes)}>
                                            <Edit3 className="w-3 h-3 mr-1" /> {editingNotes ? "Done" : "Edit"}
                                        </Button>
                                    </div>
                                    {editingNotes ? (
                                        <textarea
                                            value={activeCase.notes}
                                            onChange={e => updateNotes(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-xs text-white outline-none focus:border-indigo-500 min-h-[100px]"
                                            placeholder="Add investigation notes..."
                                        />
                                    ) : (
                                        <p className="text-xs text-slate-400 bg-slate-900/40 rounded p-3 min-h-[60px]">
                                            {activeCase.notes || "No notes yet. Click Edit to add."}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600 py-16">
                            <FolderPlus className="w-12 h-12 opacity-20 mb-4" />
                            <p className="text-sm font-bold">Select a case or create a new one</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
