import { mutationGeneric } from "convex/server";
import { v } from "convex/values";

function collectCategories(input: { category?: string; categories?: string[] }): string[] {
  const merged = [...(input.categories ?? []), ...(input.category ? [input.category] : [])]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return Array.from(new Set(merged));
}

function categoriesAreEqual(left: string[] | undefined, right: string[]): boolean {
  const normalizedLeft = collectCategories({ categories: left });
  if (normalizedLeft.length !== right.length) {
    return false;
  }
  return normalizedLeft.every((entry, index) => entry === right[index]);
}

export const run = mutationGeneric({
  args: {
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const requestedBatchSize = Math.floor(args.batchSize ?? 200);
    const batchSize = Math.max(1, Math.min(500, requestedBatchSize));

    let scanned = 0;
    let updated = 0;
    let cursor: string | null = null;

    while (true) {
      const page = await ctx.db.query("trainingItems").paginate({
        cursor,
        numItems: batchSize,
      });

      for (const item of page.page) {
        scanned += 1;
        const nextCategories = collectCategories({
          categories: item.categories,
          category: item.category,
        });
        if (nextCategories.length === 0 || categoriesAreEqual(item.categories, nextCategories)) {
          continue;
        }
        if (!dryRun) {
          await ctx.db.patch(item._id, {
            categories: nextCategories,
            updatedAt: Date.now(),
          });
        }
        updated += 1;
      }

      if (page.isDone) {
        break;
      }
      cursor = page.continueCursor;
    }

    return {
      dryRun,
      scanned,
      updated,
      message: dryRun
        ? "Dry run complete. Re-run with { dryRun: false } to apply updates."
        : "Migration complete.",
    };
  },
});
