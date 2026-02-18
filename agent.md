# Text Clipping on Native (Root Cause + Fix)

## Why this happens

In this app, UI text goes through the shared `Text` wrapper at `components/ui/text/index.tsx`, which applies default typography variants (for example, default `size="md"`).  
When a screen sets a large `fontSize` via inline style but does not also set a matching `lineHeight`, the final computed text metrics can be too tight for the glyphs and get clipped.

This shows up most on:

- Big uppercase labels/buttons (heavy font weight like `700-900`)
- Android native rendering (different font metrics than web)
- Text inside compact containers/buttons where vertical room is tight

## Fix pattern (use every time for large text)

For any custom large text style:

1. Set `fontSize` and `lineHeight` together.
2. Keep `lineHeight >= fontSize * 1.2` for bold uppercase text.
3. Add `textAlign: "center"` for button labels.
4. For Android button labels, add:
   - `includeFontPadding: false`
   - `textAlignVertical: "center"`
5. Ensure parent containers do not clip (`overflow: "visible"` when needed) and have enough vertical padding/min-height.

## Recommended examples

```ts
const styles = StyleSheet.create({
  bigLabel: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  bigButton: {
    minHeight: 88,
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

## Applied fix in timer

`app/timer.tsx` (`readyBtnText`) now explicitly uses:

- `fontSize: 26`
- `lineHeight: 34`
- `includeFontPadding: false`
- `textAlignVertical: "center"`
- `textAlign: "center"`

This prevents clipping for the `I'M READY` button label.
