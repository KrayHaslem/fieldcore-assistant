import React from "react";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
};

const sizeMap: Record<NonNullable<AppLogoProps["size"]>, string> = {
  sm: "h-10",
  md: "h-12",
  lg: "h-20",
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

