import React from "react";

type AppLogoProps = {
  size?: "sm" | "md" | "lg";
};

const sizeMap: Record<NonNullable<AppLogoProps["size"]>, string> = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-28 w-28",
};

export function AppLogo({ size = "md" }: AppLogoProps) {
  const sizeClass = sizeMap[size];

  return (
    <img
      src="/logo.png"
      alt="FieldCore Resource Systems logo"
      className={`${sizeClass} object-cover rounded-lg`}
    />
  );
}

