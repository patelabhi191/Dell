import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  BarChart,
  BigStat,
  Callout,
  ChapterTabs,
  Checklist,
  Disclaimer,
  EndCard,
  Globe,
  IsoBuilding,
  IsoFloor,
  IsoTree,
  K,
  KitDefs,
  Meter,
  NewsCard,
  ServerRack,
  StatusBar,
  TitleCard,
  VoxelPerson,
  Waveform,
  isoAt,
} from "./index";

/** Kit test sheets: `page` 1 = iso world, 2 = data graphics, 3 = globe + title + end card. */
export const KitGallery: React.FC<{ page: number }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const at = isoAt(540, 640, 3.2);
  return (
    <AbsoluteFill style={{ background: K.bg }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <KitDefs />
        {page === 1 ? (
          <g>
            <IsoFloor t={t} />
            {Array.from({ length: 6 }, (_, i) => (
              <ServerRack key={i} at={at} x={-40 + i * 30} y={20} t={t} state={i < 2 ? "fail" : i === 2 ? "busy" : "ok"} />
            ))}
            {Array.from({ length: 6 }, (_, i) => (
              <ServerRack key={`b${i}`} at={at} x={-40 + i * 30} y={90} t={t} state="ok" h={100} />
            ))}
            <IsoBuilding at={at} x={-170} y={-60} w={40} d={40} h={130} t={t} />
            <IsoTree at={at} x={150} y={200} s={1.4} />
            <IsoTree at={at} x={-150} y={170} s={1.1} />
            <VoxelPerson x={300} y={1180} s={1.3} />
            <StatusBar label="SERVERS" states={["fail", "fail", "warn", "ok", "ok", "ok", "ok", "ok"]} right="FAILED" rightTone="red" />
            <Callout x={330} y={520} tx={300} ty={420} text="FAILED" tone="red" />
            <Callout x={620} y={640} tx={780} ty={520} text="TRAFFIC MOVED" />
            <Disclaimer />
          </g>
        ) : page === 2 ? (
          <g>
            <IsoFloor t={t} opacity={0.6} />
            <ChapterTabs chapters={["SEND", "SIGN", "PACE", "TRACK", "TWIST"]} active={2} />
            <Waveform x={230} y={400} t={t} title="GATE SIGNAL" note="58 kHz ✓" />
            <Meter x={230} y={660} label="Bluetooth" value={0.12} right="SLOW" color={K.amber} />
            <Meter x={230} y={740} label="Wi-Fi Direct" value={0.92} right="FAST" />
            <BarChart x={190} y={820} values={[9, 8, 6, 5, 4, 4, 3, 3, 7]} highlight={8} labels={["10", "11", "12", "13", "14", "15", "16", "17", "19"]} />
            <Checklist x={160} y={1170} items={[{ text: "TECHNICAL ISSUE", ok: true }, { text: "CYBERATTACK", ok: false }]} />
          </g>
        ) : (
          <g>
            <rect x={0} y={0} width={1080} height={1920} fill={K.bg} />
            <Globe cx={540} cy={900} r={360} lon0={-95 + t * 10} t={t} hot={[39.7, -105]} arcs={18} />
            <TitleCard y={420} line1="MILLIONS" line2="DOWNLOADING?!" sub="ONE LAUNCH · ONE SERVER?" />
            <NewsCard x={160} y={1330} w={760} source="example-news.com" headline="Outage froze email for millions, company says it was not a hack" s={0.75} />
          </g>
        )}
        {page === 4 ? null : null}
        <rect x={0} y={0} width={1080} height={1920} fill="url(#kvignette)" />
        {page === 3 ? <BigStat x={540} y={1640} value="22" label="RADAR ROOMS" color={K.green} size={120} /> : null}
      </svg>
    </AbsoluteFill>
  );
};

export const KitEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: K.bg }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <KitDefs />
        <IsoFloor t={frame / fps} opacity={0.5} />
        <EndCard t={frame / fps} />
      </svg>
    </AbsoluteFill>
  );
};
