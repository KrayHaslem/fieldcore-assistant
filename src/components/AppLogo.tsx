import React from "react";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
};

const sizeMap: Record<NonNullable<AppLogoProps["size"]>, string> = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
};

export function AppLogo({ size = "md" }: AppLogoProps) {
  const sizeClass = sizeMap[size];

  return (
    <img
      src="/logo.png"
      alt="FieldCore Resource Systems logo"
      className={`${sizeClass} w-auto object-contain`}
    />
  );
}

