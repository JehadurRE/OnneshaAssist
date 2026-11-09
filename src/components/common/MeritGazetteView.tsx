import React, { useMemo, useState } from 'react';
import { MeritParticipant } from '@/lib/types';
import { db } from '@/lib/db';
import { useBranding } from '@/hooks/use-branding';
import { MapPin, Printer, Shield, X } from 'lucide-react';
import onnesha from '@/assets/onnesha.jpg.asset.json';

interface MeritGazetteViewProps {
  quizTitle: string;
  participants: MeritParticipant[];
  onClose: () => void;
}

export const MeritGazetteView: React.FC<MeritGazetteViewProps> = ({
  quizTitle,
  participants,
  onClose,
}) => {
  const regions = db.getRegions();
  const branding = useBranding();
  const [selectedRegionId, setSelectedRegionId] = useState<string>('all');

  const filtered = useMemo(() => {
    const base =
      selectedRegionId === 'all'
        ? participants
        : participants.filter(
            (p) => p.regionId === selectedRegionId || p.regionName === selectedRegionId
          );
    return [...base].sort((a, b) => b.finalScore - a.finalScore);
  }, [participants, selectedRegionId]);

  const activeRegionLabel =
    selectedRegionId === 'all'
      ? 'All Regions (National Merit List)'
      : regions.find((r) => r.id === selectedRegionId)?.nameEn || selectedRegionId;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-start">
      <div className="relative w-full max-w-4xl bg-white text-black rounded-2xl shadow-2xl p-6 sm:p-10 my-6 print:m-0 print:p-4 print:shadow-none print:w-full print:max-w-none">
        {/* Floating Action Controls (Hidden on Print) */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 pb-6 mb-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-700" />
            <h2 className="font-bold text-lg text-gray-900">
              Official Merit Gazette &amp; Regional Notice Board Report
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs">
              <MapPin className="h-3.5 w-3.5 text-emerald-700" />
              <select
                value={selectedRegionId}
                onChange={(e) => setSelectedRegionId(e.target.value)}
                className="bg-transparent font-bold text-gray-900 outline-none"
              >
                <option value="all">All Regions ({participants.length})</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nameEn} ({r.nameBn})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-800 transition"
            >
              <Printer className="h-4 w-4" />
              <span>Print Official Gazette</span>
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE GAZETTE DOCUMENT CONTENT */}
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex items-center justify-between border-b-2 border-black pb-4">
            <div className="flex items-center gap-2">
              <img src={onnesha.url} alt="Onnesha" className="h-12 object-contain" />
              {branding.showPartnerLogo && branding.partnerLogoUrl && (
                <img
                  src={branding.partnerLogoUrl}
                  alt={branding.partnerName || 'Partner'}
                  className="h-12 max-w-[120px] object-contain"
                />
              )}
            </div>
            <div className="text-center flex-1 px-4">
              <div className="text-xs font-bold uppercase tracking-widest text-gray-600">
                {branding.showPartnerLogo && branding.partnerName
                  ? `${branding.partnerName.toUpperCase()} · ONNESHA ASSESSMENT`
                  : (branding.institutionTitle || 'ONNESHA ASSESSMENT ARENA').toUpperCase()}
              </div>
              <h1 className="text-xl font-black uppercase text-black tracking-tight mt-0.5">
                EXAMINATION EVALUATION GAZETTE
              </h1>
              <div className="text-xs font-bold text-gray-800 mt-1">
                Examination: {quizTitle} · Scope: {activeRegionLabel}
              </div>
            </div>
            <div className="text-right border border-black p-2 rounded text-[10px] font-mono leading-tight">
              <div>
                GAZETTE: <strong>ONN-2026-GZ</strong>
              </div>
              <div>
                DATE: <strong>{new Date().toLocaleDateString()}</strong>
              </div>
              <div>
                CANDIDATES: <strong>{filtered.length}</strong>
              </div>
            </div>
          </div>

          {/* Notice Declaration */}
          <div className="border border-black p-3 rounded-lg text-xs leading-relaxed bg-gray-50">
            <strong>NOTICE FOR CANDIDATES ({activeRegionLabel.toUpperCase()}):</strong> The following
            merit list contains verified final rankings based on raw marks, speed velocity, and
            applicable negative marking (-0.25 penalty). This gazette is officially certified for
            public notice boards and regional archives.
          </div>

          {/* Merit Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-black text-xs">
              <thead>
                <tr className="bg-gray-100 text-black border-b border-black text-left font-bold">
                  <th className="border border-black p-2 text-center w-12">Rank</th>
                  <th className="border border-black p-2">Roll Number</th>
                  <th className="border border-black p-2">Candidate Name</th>
                  <th className="border border-black p-2">Region / Range</th>
                  <th className="border border-black p-2 text-center">Correct</th>
                  <th className="border border-black p-2 text-center">Wrong</th>
                  <th className="border border-black p-2 text-center">Net Score</th>
                  <th className="border border-black p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => {
                  const isPassed = p.finalScore >= 500;
                  return (
                    <tr key={p.id} className={idx < 3 ? 'bg-amber-50/60 font-semibold' : ''}>
                      <td className="border border-black p-2 text-center font-bold font-mono">
                        #{idx + 1}
                      </td>
                      <td className="border border-black p-2 font-mono">
                        {p.rollNumber || `2026-${100 + idx}`}
                      </td>
                      <td className="border border-black p-2 font-bold">{p.nickname}</td>
                      <td className="border border-black p-2 font-semibold">
                        {p.regionName || 'Dhaka Range'}
                      </td>
                      <td className="border border-black p-2 text-center text-emerald-700 font-bold">
                        {p.correctCount}
                      </td>
                      <td className="border border-black p-2 text-center text-red-700 font-bold">
                        {p.incorrectCount}
                      </td>
                      <td className="border border-black p-2 text-center font-mono font-black">
                        {p.finalScore}
                      </td>
                      <td className="border border-black p-2 text-center font-bold">
                        {isPassed ? (
                          <span className="text-emerald-700">QUALIFIED</span>
                        ) : (
                          <span className="text-gray-500">STANDBY</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Authority Signatures */}
          <div className="flex justify-between items-end border-t border-black pt-10 text-xs mt-8">
            <div className="text-center">
              <div className="w-48 border-b border-black mb-1"></div>
              <span className="font-bold">Prepared by Examiner</span>
            </div>
            <div className="text-center">
              <div className="w-48 border-b border-black mb-1"></div>
              <span className="font-bold">Controller of Examinations</span>
              <div className="text-[10px] text-gray-600">
                {branding.showPartnerLogo && branding.partnerName
                  ? `${branding.partnerName} / Onnesha`
                  : branding.institutionTitle || 'Onnesha Assessment Arena'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
