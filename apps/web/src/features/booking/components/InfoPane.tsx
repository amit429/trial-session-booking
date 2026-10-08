import { MENTOR_AVATARS } from "./mentor-avatars";
import { formatDay, formatDayLong, formatTime, zoneAbbreviation, type TransitionDto } from "@shared";
import { AlertTriangle, Clock, Globe, UserRound, Video } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { TimezonePicker } from "./TimezonePicker";

export function InfoPane({
  tz,
  setTz,
  isDetected,
  transition,
  picked,
  onChangeTime,
  h24
}: {
  tz: string | null;
  setTz: (z: string) => void;
  isDetected: boolean;
  transition?: TransitionDto;
  picked?: string | null;
  onChangeTime?: () => void;
  h24: boolean;
}) {
  return (
    <div className="min-w-0 p-6">
      <div className="flex" aria-hidden>
        {MENTOR_AVATARS.map((n, i) => (
          <Avatar key={n} name={n} className={i ? "-ml-2" : ""} />
        ))}
        <span className="-ml-2 grid size-9 place-items-center rounded-full border-2 border-card bg-muted text-[13px] font-semibold text-muted-foreground">
          +6
        </span>
      </div>
      <h1 className="mt-3.5 text-[22px] font-semibold">Free 1:1 trial class</h1>
      <p className="mt-2 text-muted-foreground">
        Coding or Maths with an expert mentor. Pick a time that suits your family and we'll match a mentor who's free then.
      </p>
      <div className="mt-[22px] flex flex-col gap-3 font-medium text-muted-foreground [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
        <div className="flex gap-2.5">
          <Clock />
          <span>60 minutes</span>
        </div>
        <div className="flex gap-2.5">
          <Video />
          <span>Online. You'll get the class link right away.</span>
        </div>
        <div className="flex gap-2.5">
          <UserRound />
          <span>Mentor assigned automatically</span>
        </div>
        <div className="flex gap-2.5">
          <Globe />
          <div className="min-w-0">
            <TimezonePicker tz={tz} onChange={setTz} defaultOpen={!tz} />
            {tz && isDetected && <p className="text-xs">Detected from your browser</p>}
            {!tz && <p className="text-xs">We couldn't detect it.</p>}
          </div>
        </div>
      </div>
      {picked && tz && (
        <div className="mt-[22px] flex flex-col gap-1 rounded-xl bg-brand-soft p-3.5">
          <span className="text-xs font-medium text-muted-foreground">Your trial</span>
          <span className="font-semibold text-brand-text">{formatDayLong(new Date(picked), tz)}</span>
          <span className="font-semibold tabular-nums">
            {formatTime(picked, tz, h24)} – {formatTime(new Date(picked).getTime() + 3_600_000, tz, h24)}{" "}
            {zoneAbbreviation(tz, new Date(picked))}
          </span>
          {onChangeTime && (
            <button
              type="button"
              onClick={onChangeTime}
              className="mt-1.5 cursor-pointer self-start text-[13px] font-medium underline underline-offset-4"
            >
              Change time
            </button>
          )}
        </div>
      )}
      {transition && tz && (
        <Alert
          className="mt-[22px]"
          variant="warning"
          icon={<AlertTriangle />}
          title={`Clocks ${transition.back ? "go back" : "go forward"} ${formatDay(transition.atUtc, tz)}`}
        >
          Times from then are in {zoneAbbreviation(tz, new Date(transition.atUtc))}. The calendar already accounts for it.
        </Alert>
      )}
    </div>
  );
}
