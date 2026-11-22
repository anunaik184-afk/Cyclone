import React, {useState} from 'react';
import {Phone, ShieldCheck} from 'lucide-react';
import {INDIA_HELPLINES, SAFETY_PROTOCOLS} from '../lib/location';

interface GuidelinesServicesViewProps {
  mode: 'guidelines' | 'services';
}

export function GuidelinesServicesView({mode}: GuidelinesServicesViewProps) {
  const [selectedHazard, setSelectedHazard] = useState(SAFETY_PROTOCOLS[0].id);

  if (mode === 'services') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Indian Emergency Services &amp; Helplines
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Official toll-free national and state disaster emergency numbers across India.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {INDIA_HELPLINES.map((h) => (
            <div
              key={h.number}
              className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4"
            >
              <div>
                <p className="text-xs font-mono text-slate-500">{h.coverage}</p>
                <h2 className="font-display text-base font-bold text-slate-900 mt-0.5">
                  {h.service}
                </h2>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {h.description}
                </p>
              </div>
              <a
                href={`tel:${h.number}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-mono text-sm font-bold rounded-lg shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{h.number}</span>
              </a>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeProtocol =
    SAFETY_PROTOCOLS.find((p) => p.id === selectedHazard) ?? SAFETY_PROTOCOLS[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Disaster Safety Guidelines
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Standard NDMA-aligned immediate response actions and household preparedness.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SAFETY_PROTOCOLS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedHazard(p.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              selectedHazard === p.id
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {p.hazard}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-900 font-display font-semibold text-base mb-3">
            <ShieldCheck className="w-4 h-4 text-red-600" />
            <h2>Immediate Response Actions</h2>
          </div>
          <ul className="space-y-2.5 text-sm text-slate-700">
            {activeProtocol.immediateActions.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="font-mono text-xs font-semibold text-slate-500 mt-0.5">
                  0{idx + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-display font-semibold text-base text-slate-900 mb-3">
            Preparedness Checklist
          </h2>
          <ul className="space-y-2.5 text-sm text-slate-700">
            {activeProtocol.preparednessChecklist.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="font-mono text-xs font-semibold text-emerald-700 mt-0.5">
                  0{idx + 1}.
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
