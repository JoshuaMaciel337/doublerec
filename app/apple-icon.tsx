import { ImageResponse } from "next/og";

// iOS só aceita PNG no ícone da tela inicial, então geramos um no build
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 118,
            height: 66,
            border: "8px solid #fbbf24",
            borderRadius: 10,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 66,
            height: 118,
            border: "8px solid #ffffff",
            borderRadius: 10,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 26,
            height: 26,
            borderRadius: 13,
            background: "#ef4444",
          }}
        />
      </div>
    ),
    size,
  );
}
