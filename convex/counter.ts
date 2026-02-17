import { mutationGeneric, queryGeneric } from "convex/server";

export const get = queryGeneric({
  handler: async (ctx) => {
    const counterDoc = await ctx.db.query("counter").first();
    return counterDoc?.value ?? 0;
  },
});

export const increment = mutationGeneric({
  handler: async (ctx) => {
    const counterDoc = await ctx.db.query("counter").first();

    if (!counterDoc) {
      await ctx.db.insert("counter", { value: 1 });
      return 1;
    }

    const nextValue = counterDoc.value + 1;
    await ctx.db.patch(counterDoc._id, { value: nextValue });
    return nextValue;
  },
});
