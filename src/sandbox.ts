import * as z from "zod";
import { encodeZodPbfCompact } from "./encodeZodPbfCompact";
import { decodeZodPbfCompact } from "./decodeZodPbfCompact";

export const personSchema = z.object({
  foo: z.union([z.undefined(), z.null(), z.string()]),
  bool: z.boolean(),
  firstName: z.string(),
  lastName: z.string(),
  age: z.number().int().gte(0).describe("Age in years").optional(),
  height: z.union([z.number(), z.null()]).optional(),
  favoriteFoods: z.array(z.string()).min(0).max(2).optional(),
  likesDogs: z.boolean().optional(),
  x: z.union([z.literal("a"), z.literal("b"), z.literal(22)]),
});

type Person = z.infer<typeof personSchema>;

const samplePerson: Person = {
  bool: false,
  firstName: "aaa",
  lastName: "bbb",
  age: 123,
  height: 2.2,
  favoriteFoods: ["x", "z"],
  foo: null,
  x: "b",
};

console.log("XXX", encodeZodPbfCompact(samplePerson, personSchema));
console.log(
  "YYY",
  decodeZodPbfCompact(
    encodeZodPbfCompact(samplePerson, personSchema)[0],
    personSchema
  )
);

// const ambiguousSchema = z.union([
//   z.object({ name: z.string() }),
//   z.object({ name: z.string(), value: z.number() }),
// ]);

// const ambiguosValue = { name: "x", value: 123 };

// console.log("AMB", encodeZodPbfStrict(ambiguosValue, ambiguousSchema));
