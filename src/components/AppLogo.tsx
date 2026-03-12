import React from "react";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
};

const sizeMap: Record<NonNullable<AppLogoProps["size"]>, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

export function AppLogo({ size = "md" }: AppLogoProps) {
  const sizeClass = sizeMap[size];

  return (
    <div className={`inline-flex items-center justify-center rounded-xl bg-transparent ${sizeClass}`}>
      <img
        src="/logo.png"
        alt="FieldCore Resource Systems logo"
        className="h-full w-full object-contain"
      />
    </div>
  );
}

