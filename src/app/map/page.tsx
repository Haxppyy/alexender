"use client";

import { useState } from "react";
import { CampaignMap } from "@/components/CampaignMap";
import { Segmented } from "@/components/ui";
import { addDays } from "@/lib/date";
import { useClock } from "@/lib/store";

type Day = "today" | "tomorrow";

/** Campaign — your day's tasks as places to conquer on an old map, from camp to the citadel. */
export default function MapPage() {
  const today = useClock((s) => s.today);
  const [day, setDay] = useState<Day>("today");
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex justify-center">
        <Segmented<Day>
          value={day}
          onChange={setDay}
          options={[
            { value: "today", label: "Today" },
            { value: "tomorrow", label: "Tomorrow" },
          ]}
        />
      </div>
      <CampaignMap date={day === "today" ? today : addDays(today, 1)} />
    </div>
  );
}
