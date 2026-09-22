/**
 * Categorical palette for source provenance.
 *
 * This is deliberately NOT the desaturated pastel family used for chrome in
 * tokens.css. These colours sit on a bone canvas as node borders and fills at
 * roughly 12-26px, so they have to stay separable at small size and against
 * white. Pastels at eight hues collapse into each other there.
 *
 * Hues are spaced around the wheel and held at a mid lightness so that white
 * label text is never needed and the border reads at 1px. Validated for
 * pairwise distinguishability and for at least 3:1 contrast against both
 * #fbfbfa (canvas) and #ffffff (node fill).
 */
export const SOURCE_COLORS = [
  "#1f6c9f", // blue
  "#9f2f2d", // red
  "#346538", // green
  "#8a5a00", // amber
  "#6b4f9e", // violet
  "#0f7070", // teal
  "#a03d6f", // magenta
  "#5c6470", // slate
] as const;
