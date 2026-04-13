'use client';

import { CreativeContext } from '@/lib/gates/creativeContextAggregator';
import { getAvailableContentOptions } from '@/lib/templates/contentInjector';

interface VariableMapperProps {
  detectedVars: string[];
  variableMap: Record<string, string>;
  creativeCtx: CreativeContext | null;
  onChange: (newMap: Record<string, string>) => void;
}

export default function VariableMapper({ detectedVars, variableMap, creativeCtx, onChange }: VariableMapperProps) {
  const options = creativeCtx ? getAvailableContentOptions(creativeCtx) : [];

  const handleChange = (varName: string, path: string) => {
    onChange({ ...variableMap, [varName]: path });
  };

  if (detectedVars.length === 0) {
    return (
      <div className="text-xs text-text-muted p-2">
        No Liquid variables detected. Use {'{{ variable_name }}'} in your template.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {detectedVars.map(varName => {
        const mapped = variableMap[varName];
        return (
          <div key={varName} className="flex items-center gap-2">
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
              mapped ? 'bg-accent-teal/20 text-accent-teal' : 'bg-warning/20 text-warning'
            }`}>
              {varName}
            </span>
            <span className="text-text-muted text-[10px]">&rarr;</span>
            <select
              value={mapped || ''}
              onChange={e => handleChange(varName, e.target.value)}
              className="flex-1 px-2 py-1 bg-bg-input border border-border rounded text-xs text-text-primary focus:outline-none focus:border-accent-teal"
            >
              <option value="">-- not mapped --</option>
              {options.map(group => (
                <optgroup key={group.group} label={group.group}>
                  {group.options.map(opt => (
                    <option key={opt.path} value={opt.path}>
                      {opt.label}: {opt.preview}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
