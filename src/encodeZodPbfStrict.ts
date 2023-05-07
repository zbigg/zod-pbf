import Pbf from "pbf";
import { ZodType, ZodTypeAny } from "zod";
import { ZodTypeTreeVisitor, visitZodType } from "./zodTypeTreeVisitor";

export function encodeZodPbfStrict<T>(
  value: T,
  type: ZodType<T>
): [number, Uint8Array] {
  const pbfWriter = new Pbf();
  let currentNode: any = value;
  const pbfSchemaVisitor: ZodTypeTreeVisitor = {
    undefined() {
      // we don't have wo write undefineds at all, because they are always part of some tagged union
    },
    null() {
      // we don't have wo write nulls at all, because they are always part of union
    },
    literal() {
        // we don't have wo write literals at all, because they are always part of union and
        // they don't contain no info at all
    },
    boolean() {
      pbfWriter.writeBoolean(currentNode);
    },
    number(zodType) {
      if (zodType._def.checks.some((check) => check.kind === "int")) {
        pbfWriter.writeVarint(currentNode);
      } else {
        pbfWriter.writeFloat(currentNode);
      }
    },
    string() {
      pbfWriter.writeString(currentNode);
    },
    object(zodType, process) {
      let iteratedObject = currentNode;
      for (const [name, property] of Object.entries(zodType._def.shape())) {
        const value = iteratedObject[name];
        currentNode = value;
        process(property as ZodTypeAny);
      }
      currentNode = iteratedObject;
    },
    array(zodType, process) {
      const currentArray = currentNode as any[];
      pbfWriter.writeVarint(currentArray.length);
      for (const value of currentArray) {
        currentNode = value;
        process(zodType._def.type);
      }
    },
    optional(zodType, process) {
      const present = currentNode !== undefined;
      pbfWriter.writeBoolean(present);
      if (present) {
        process(zodType._def.innerType);
      }
    },
    union(zodType, process) {
      const options: ZodTypeAny[] = zodType._def.options;
      let variantTag = 0;
      let alreadyEmitted = false;
      for (const optionType of options) {
        if (optionType.safeParse(currentNode).success) {
          if (alreadyEmitted) {
            // now, this is hard take - if union is not discrimiated and has ambiguos, multiple resolutions like
            //  {name: string} | { name: "xxx", value: number }
            throw new Error(
              `encodeZodPbf.union: unable to encode ambiguous union: ${currentNode} in ${options
                .map((x) => x._def.typeName)
                .join(" | ")}`
            );
          }
          pbfWriter.writeVarint(variantTag);
          process(optionType);
          alreadyEmitted = true;
        }
        variantTag++;
      }
      if (!alreadyEmitted) {
        throw new Error(
          `encodeZodPbf.union: unable to find proper definition for ${currentNode} in ${options
            .map((x) => x._def.typeName)
            .join(" | ")}`
        );
      }
    },
  };
  visitZodType(type, pbfSchemaVisitor);
  return [pbfWriter.pos, pbfWriter.buf];
}
