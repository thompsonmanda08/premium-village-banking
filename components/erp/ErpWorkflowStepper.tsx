import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RotateCcw, 
  ShieldCheck, 
  User, 
  ArrowRight,
  Sparkles,
  FileCheck,
  Lock
} from 'lucide-react';
import { ErpApprovalStep } from '../../types';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

interface ErpWorkflowStepperProps {
  steps: ErpApprovalStep[];
  currentStepIndex: number;
  onApproveStep?: (stepId: string) => void;
  onRequestRevision?: (stepId: string) => void;
  canCurrentUserAct?: boolean;
  compact?: boolean;
}

export const ErpWorkflowStepper: React.FC<ErpWorkflowStepperProps> = ({
  steps,
  currentStepIndex,
  onApproveStep,
  onRequestRevision,
  canCurrentUserAct = true,
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 w-full">
        {steps.map((step, idx) => {
          let dotColor = 'bg-slate-200 dark:bg-zinc-800 text-slate-400';
          if (step.status === 'approved') {
            dotColor = 'bg-emerald-500 text-white';
          } else if (step.status === 'current') {
            dotColor = 'bg-indigo-600 text-white ring-2 ring-indigo-500/30 animate-pulse';
          } else if (step.status === 'rejected') {
            dotColor = 'bg-rose-500 text-white';
          } else if (step.status === 'revision_requested') {
            dotColor = 'bg-amber-500 text-white';
          }

          return (
            <React.Fragment key={step.id}>
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${dotColor} shrink-0`}
                title={`Step ${step.stepNumber}: ${step.stepName} (${step.status})`}
              >
                {step.status === 'approved' ? (
                  <CheckCircle2 size={12} />
                ) : step.status === 'rejected' ? (
                  <AlertCircle size={12} />
                ) : (
                  step.stepNumber
                )}
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 min-w-[12px] ${
                  idx < currentStepIndex ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-zinc-800'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-indigo-600 dark:text-indigo-400" />
            Sequential Verification & Approval Pipeline
          </h4>
          <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
            {steps.filter(s => s.status === 'approved').length} of {steps.length} stages authorized
          </p>
        </div>

        <Badge variant={currentStepIndex >= steps.length ? 'emerald' : 'indigo'} size="sm">
          {currentStepIndex >= steps.length ? 'Fully Approved' : `Stage ${currentStepIndex + 1} of ${steps.length} Active`}
        </Badge>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
        {steps.map((step, idx) => {
          const isApproved = step.status === 'approved';
          const isCurrent = step.status === 'current';
          const isRejected = step.status === 'rejected';
          const isRevision = step.status === 'revision_requested';
          const isPending = step.status === 'pending';

          return (
            <div key={step.id} className="relative group">
              {/* Step Icon Indicator */}
              <div 
                className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isApproved
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                    : isCurrent
                      ? 'bg-indigo-600 border-indigo-600 text-white ring-4 ring-indigo-500/20 shadow-md shadow-indigo-600/30 animate-pulse'
                      : isRejected
                        ? 'bg-rose-500 border-rose-500 text-white'
                        : isRevision
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-400'
                }`}
              >
                {isApproved ? (
                  <CheckCircle2 size={13} />
                ) : isRejected ? (
                  <AlertCircle size={13} />
                ) : isRevision ? (
                  <RotateCcw size={13} />
                ) : (
                  step.stepNumber
                )}
              </div>

              {/* Step Card Content */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                isCurrent
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-500/30 shadow-sm'
                  : isApproved
                    ? 'bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-white/10'
                    : 'bg-slate-50/50 dark:bg-zinc-900/30 border-dashed border-slate-200 dark:border-white/5 opacity-85'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Stage {step.stepNumber}: {step.stepName}
                    </span>
                    {isApproved && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 size={10} /> Verified
                      </span>
                    )}
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex items-center gap-1">
                        <Clock size={10} /> Awaiting Sign-Off
                      </span>
                    )}
                  </div>

                  {step.slaDeadline && (
                    <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                      <Clock size={11} className={step.isOverdue ? 'text-rose-500' : 'text-slate-400'} />
                      SLA: {step.slaDeadline}
                    </span>
                  )}
                </div>

                {/* Assigned Approver Profile */}
                <div className="mt-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {step.assignedApprover.avatar ? (
                      <img 
                        src={step.assignedApprover.avatar} 
                        alt={step.assignedApprover.name}
                        className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-white/10"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold text-[10px] flex items-center justify-center">
                        {step.assignedApprover.initials}
                      </div>
                    )}
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white text-xs">
                        {step.assignedApprover.name}
                      </span>
                      <span className="text-slate-400 dark:text-zinc-500 text-[11px] ml-1.5">
                        ({step.requiredRole})
                      </span>
                    </div>
                  </div>

                  {step.actionDate && (
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                      Signed: {step.actionDate}
                    </span>
                  )}
                </div>

                {/* Approver's Log / Comments */}
                {step.actionComment && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-slate-100/70 dark:bg-zinc-800/60 text-xs text-slate-700 dark:text-zinc-300 border border-slate-200/50 dark:border-white/5 space-y-1">
                    <p className="italic">"{step.actionComment}"</p>
                    {step.signatureHash && (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 pt-1">
                        <Lock size={10} /> Digital Signature: {step.signatureHash}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons if this is the active stage */}
                {isCurrent && canCurrentUserAct && (
                  <div className="mt-3 pt-2.5 border-t border-indigo-100 dark:border-white/5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                      <Sparkles size={12} /> Assigned for your authorization
                    </span>
                    <div className="flex items-center gap-2">
                      {onRequestRevision && (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => onRequestRevision(step.id)}
                          icon={<RotateCcw size={11} />}
                        >
                          Request Revision
                        </Button>
                      )}
                      {onApproveStep && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => onApproveStep(step.id)}
                          icon={<FileCheck size={12} />}
                        >
                          Verify & Sign
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ErpWorkflowStepper;
