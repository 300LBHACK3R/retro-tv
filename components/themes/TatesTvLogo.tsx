"use client";

import Image, { type ImageProps } from "next/image";

type LogoProps = Pick<ImageProps, "width" | "height" | "sizes" | "className" | "priority">;

/** Shared Christmas artwork keeps the brand consistent across every theme. */
export default function TatesTvLogo({ className, ...props }: LogoProps) {
  return <Image {...props} className={className} src="/tatestv-logo-christmas.png" alt="Tate's TV" draggable={false} />;
}
