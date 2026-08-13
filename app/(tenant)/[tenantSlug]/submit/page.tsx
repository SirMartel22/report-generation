'use client';

import { useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { FileText, Mic, Image as ImageIcon, Sparkles, Send, CheckCircle2, AlertCircle, Loader2, Tag, Square } from 'lucide-react';
import { SyncManager } from '@/lib/offline/syncManager';

export default function SubmitReportPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const tenantSlug = (params?.tenantSlug as string) || 'bhbc';
  const initialType = (searchParams?.get('type') || 'TEXT').toUpperCase() as 'TEXT' | 'VOICE' | 'IMAGE';

  const [subunit, setSubunit] = useState('Livestream');
  const [reportType, setReportType] = useState<'TEXT' | 'VOICE' | 'IMAGE'>(initialType);
  const [textContent, setTextContent] = useState('');
  const [tagsInput, setTagsInput] = useState('SundayService, Metrics');
  const [imageUrl, setImageUrl] = useState('');
  const [imageDescription, setImageDescription] = useState('');

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const subunitsList = ['Livestream', 'Socials', 'Videography', 'Photography'];

  // Trigger Gemma AI Audio Transcription
  const handleAiTranscribe = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/transcribe', { method: 'POST' });
      const data = await res.json();
      setTextContent((prev) => (prev ? `${prev}\n\n${data.transcription}` : data.transcription));
    } catch {
      // fallback
    } finally {
      setAiLoading(false);
    }
  };

  // Trigger Gemma AI Image Captioning
  const handleAiDescribeImage = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/describe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      setImageDescription(data.description);
    } catch {
      // fallback
    } finally {
      setAiLoading(false);
    }
  };

  // Simulate Audio Recording toggle
  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
    } else {
      setIsRecording(false);
      setAudioUrl('/audio/sample_voice_report.mp3');
      handleAiTranscribe();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const syncManager = new SyncManager(tenantSlug);

      const parsedTags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);

      const result = await syncManager.submitReport({
        userId: 'current-user',
        subunit,
        reportType,
        textContent: textContent || imageDescription,
        imageUrl: imageUrl || undefined,
        imageDescription: imageDescription || undefined,
        audioUrl: audioUrl || undefined,
        tags: parsedTags,
      });

      if (result.synced) {
        setSuccessMsg('Report submitted & synced to cloud database!');
      } else {
        setSuccessMsg('Report saved locally to IndexedDB! Will sync automatically when online.');
      }

      setTimeout(() => {
        router.push(`/${tenantSlug}/dashboard`);
      }, 1500);
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Submit Subunit Operational Report</h1>
          <p className="text-xs text-slate-400">Offline-capable form. Works with or without internet connectivity.</p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-xs font-semibold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs font-semibold flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-6">
        {/* Mode Selector Tabs */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">Report Content Type</label>
          <div className="grid grid-cols-3 gap-3 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setReportType('TEXT')}
              className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                reportType === 'TEXT'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              Text Report
            </button>
            <button
              type="button"
              onClick={() => setReportType('VOICE')}
              className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                reportType === 'VOICE'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mic className="w-4 h-4" />
              Voice Note
            </button>
            <button
              type="button"
              onClick={() => setReportType('IMAGE')}
              className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                reportType === 'IMAGE'
                  ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Photo Evidence
            </button>
          </div>
        </div>

        {/* Subunit Picker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Target Subunit</label>
            <select
              value={subunit}
              onChange={(e) => setSubunit(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {subunitsList.map((sub) => (
                <option key={sub} value={sub} className="bg-slate-900 text-white">
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Tags (comma separated)</label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="SundayService, Audio, Metrics"
                className="w-full bg-slate-900/90 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Voice Note Recorder Section */}
        {reportType === 'VOICE' && (
          <div className="bg-purple-950/20 border border-purple-500/20 p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-purple-300 flex items-center gap-2">
                  <Mic className="w-4 h-4" /> Voice Note Recorder
                </h4>
                <p className="text-xs text-slate-400">Record audio notes and auto-transcribe with Gemma 4 AI</p>
              </div>

              <button
                type="button"
                onClick={toggleRecording}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md ${
                  isRecording
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4" /> Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" /> Start Recording
                  </>
                )}
              </button>
            </div>

            {audioUrl && (
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">Recorded Voice Track (12s)</span>
                <button
                  type="button"
                  onClick={handleAiTranscribe}
                  disabled={aiLoading}
                  className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                >
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  AI Transcribe with Gemma
                </button>
              </div>
            )}
          </div>
        )}

        {/* Photo Evidence Section */}
        {reportType === 'IMAGE' && (
          <div className="bg-pink-950/20 border border-pink-500/20 p-6 rounded-2xl space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Photo Image URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-1611162617474-5b21e879e113"
                  className="flex-1 bg-slate-900/90 border border-slate-800 focus:border-pink-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAiDescribeImage}
                  disabled={aiLoading}
                  className="bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-1.5 shrink-0"
                >
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  AI Caption
                </button>
              </div>
            </div>

            {imageDescription && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-pink-300">AI Generated Caption</label>
                <div className="bg-slate-900 p-3 rounded-xl text-xs text-slate-300 border border-slate-800">
                  {imageDescription}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Text Content Area */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">Detailed Report Text</label>
            <button
              type="button"
              onClick={handleAiTranscribe}
              disabled={aiLoading}
              className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Enhance with Gemma AI
            </button>
          </div>

          <textarea
            required
            rows={5}
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Document daily/weekly operational activities, viewer metrics, equipment status..."
            className="w-full bg-slate-900/90 border border-slate-800 focus:border-blue-500 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600 leading-relaxed"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 text-sm"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Operational Report (Offline-First)
            </>
          )}
        </button>
      </form>
    </div>
  );
}
