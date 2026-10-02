/** Check the executables actually used by these converters, including custom commands. */
export function getMissingExecutableEngines(
  findExecutable: (command: string) => string | null = Bun.which,
  imageMagickCommand = process.env.IMAGEMAGICK_COMMAND || "magick",
): string[] {
  const requirements: Record<string, string[]> = {
    inkscape: ["inkscape", "xvfb-run"],
    imagemagick: [imageMagickCommand],
  };
  return Object.entries(requirements)
    .filter(([, commands]) => commands.some((command) => !findExecutable(command)))
    .map(([engine]) => engine);
}
