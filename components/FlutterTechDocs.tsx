
import React from 'react';
import { FLUTTER_VERSION_REQS } from '../constants';

interface Props {
  onBack: () => void;
}

const FlutterTechDocs: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-white overflow-hidden">
      <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 text-slate-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold">Flutter Architecture Specs</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <section>
          <h3 className="text-blue-400 font-bold text-xs uppercase tracking-widest mb-4">Required pubspec.yaml</h3>
          <pre className="bg-black/50 p-4 rounded-xl text-[10px] font-mono leading-relaxed overflow-x-auto text-blue-200">
            {Object.entries(FLUTTER_VERSION_REQS).map(([name, version]) => `${name}: ${version}`).join('\n')}
          </pre>
        </section>

        <section>
          <h3 className="text-blue-400 font-bold text-xs uppercase tracking-widest mb-4">Folder Structure (/lib)</h3>
          <pre className="bg-black/50 p-4 rounded-xl text-[10px] font-mono leading-relaxed overflow-x-auto text-emerald-200">
{`lib/
├── main.dart
├── core/
│   ├── constants/
│   ├── theme/
│   └── utils/
├── data/
│   ├── models/           # DispatchModel, ScanRecord
│   ├── providers/        # SQLite database_helper.dart
│   └── services/         # OCR, Export, Camera services
├── logic/                # Business logic
│   ├── auth_notifier.dart
│   ├── dispatch_notifier.dart
│   └── scan_notifier.dart
└── ui/                   # Screen widgets
    ├── common/           # Custom buttons, modals
    └── screens/
        ├── login/
        ├── home/
        ├── scan/
        └── history/`}
          </pre>
        </section>

        <section>
          <h3 className="text-blue-400 font-bold text-xs uppercase tracking-widest mb-4">Acceptance Tests (Core)</h3>
          <ul className="text-xs space-y-3 text-slate-300">
            <li className="flex gap-2">
              <span className="text-blue-500 font-bold">01.</span>
              <span>Camera lifecycle: Ensure camera resumes instantly after OCR without black frame.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500 font-bold">02.</span>
              <span>Duplicate detection: Block identical scan within 5s with audible/haptic warning.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500 font-bold">03.</span>
              <span>OCR Robustness: Extract Alphanumeric Part No (3B0005299) correctly from noisy background.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500 font-bold">04.</span>
              <span>Performance: Maintain smooth scrolling with >1000 scan records in local SQLite.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500 font-bold">05.</span>
              <span>Offline exports: Regenerate PDF/Excel from DB while Airplane mode is ON.</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default FlutterTechDocs;
