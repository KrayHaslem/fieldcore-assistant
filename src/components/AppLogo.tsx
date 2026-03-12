import React from "react";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
};

const sizeMap: Record<NonNullable<AppLogoProps["size"]>, string> = {
  sm: "h-10",
  md: "h-14",
  lg: "h-24",
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

