import { ImageResponse } from "next/og";

export const alt = "Norvian — Source from India with Confidence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0b0d",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: "0.22em",
            fontWeight: 600,
            color: "#ffffff",
          }}
        >
          NORVIAN
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 80,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              fontWeight: 600,
            }}
          >
            <span>Source from India.</span>
            <span>Without taking the risk.</span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 28,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.58)",
              maxWidth: 900,
            }}
          >
            Find manufacturers, manage production, and verify every order
            against what you approved — before it ships.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 22,
            color: "rgba(255,255,255,0.42)",
          }}
        >
          <span>Sourcing</span>
          <span>·</span>
          <span>Production Oversight</span>
          <span>·</span>
          <span>Verification</span>
          <span>·</span>
          <span>Logistics</span>
        </div>
      </div>
    ),
    size,
  );
}
