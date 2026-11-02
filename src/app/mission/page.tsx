"use client";

import { Check, Flag, Plus } from "lucide-react";
import { useState } from "react";
import { ObjectiveCard, ObjectiveForm, ObjectiveView } from "@/components/Objective";
import { SectionProgress } from "@/components/SectionProgress";
import { stepProgress } from "@/components/StepPlanner";
import { SortableList } from "@/components/Sortable";
import { Button, Modal } from "@/components/ui";
import { byOrder, MAX_MISSIONS, useStore } from "@/lib/store";
import type { Mission } from "@/lib/types";

const flag = <Flag className="size-5" strokeWidth={1.5} />;

/** Up to three missions — the few things your life is aimed at. Each has a vision and a plan. */
export default function MissionPage() {
  const missions = useStore((s) => s.missions);
  const { addMission, updateMission, deleteMission, reorder } = useStore.getState();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...missions].sort(byOrder);
  const full = missions.length >= MAX_MISSIONS;
  const current = missions.find((m) => m.id === open);
  const steps = missions.flatMap((m) => m.steps ?? []);
  const overall = missions.length ? missions.reduce((sum, m) => sum + stepProgress(m.steps).pct, 0) / missions.length : 0;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 flex justify-end">
        {!full && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line-strong px-5 text-[14.5px] font-medium text-muted transition-colors hover:border-faint hover:text-fg"
          >
            <Plus className="size-4" /> Add mission
          </button>
        )}
      </header>

      {missions.length > 0 && <SectionProgress value={overall} label="toward your missions" detail={`${steps.filter((s) => s.done).length}/${steps.length} steps`} />}

      {missions.length === 0 && (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full flex-col items-start gap-1 py-4 text-left transition-colors hover:text-fg"
        >
          <span className="text-[16px] font-medium">Add your first mission</span>
          <span className="text-[13px] text-faint">The life you are building — up to three. Give each a title, a description and an icon.</span>
        </button>
      )}

      <SortableList items={sorted} onReorder={(ids) => reorder("missions", ids)} className="space-y-3">
        {(m, handle) => (
          <div className="group relative">
            <div className="absolute top-1/2 -left-9 hidden -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 lg:block">{handle}</div>
            <ObjectiveCard item={toFields(m)} fallbackIcon={flag} meta={m.accomplished ? <span className="text-success">Accomplished</span> : undefined} onOpen={() => setOpen(m.id)} muted={m.accomplished} />
          </div>
        )}
      </SortableList>


      <Modal open={adding} onClose={() => setAdding(false)} title="New mission">
        {adding && (
          <ObjectiveForm
            kind="mission"
            onCancel={() => setAdding(false)}
            onSave={({ title, description, iconId }) => {
              const id = addMission(title, { description, iconId });
              setAdding(false);
              if (id) setOpen(id);
            }}
          />
        )}
      </Modal>

      {current && (
        <ObjectiveView
          kind="mission"
          item={toFields(current)}
          fallbackIcon={flag}
          onPatch={(patch) => updateMission(current.id, fromPatch(patch))}
          onDelete={() => deleteMission(current.id)}
          onClose={() => setOpen(null)}
          details={
            <Button
              size="sm"
              variant={current.accomplished ? "outline" : "primary"}
              onClick={() => updateMission(current.id, current.accomplished ? { accomplished: false, accomplishedAt: undefined } : { accomplished: true, accomplishedAt: Date.now() })}
            >
              <Check className="size-3.5" /> {current.accomplished ? "Accomplished" : "Mark accomplished"}
            </Button>
          }
        />
      )}
    </div>
  );
}

const toFields = (m: Mission) => ({ title: m.text, description: m.description, iconId: m.iconId, images: m.images, steps: m.steps });

function fromPatch({ title, ...rest }: { title?: string } & Partial<Omit<Mission, "text">>): Partial<Mission> {
  return { ...rest, ...(title !== undefined && { text: title }) };
}
