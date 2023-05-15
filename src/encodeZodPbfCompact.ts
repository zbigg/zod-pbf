import Pbf from "pbf";
import { ZodType, ZodTypeAny } from "zod";
import {
  detectNumberNumberWireEncoding,
  NumberWireEncoding,
} from "./compactModeUtils.js";
import { isZodNumber } from "./typeUtils.js";
import { visitZodType } from "./zodTypeTreeVisitor.js";

export function encodeZodPbfCompact<T>(
  value: T,
  type: ZodType<T>
): [Uint8Array, number] {
  const pbfWriter = new Pbf();
  let currentNode: any = value;

  visitZodType(type, {
    undefined() {
      // we don't have wo write undefineds at all, because they are always part of some tagged union
    },
    null() {
      // we don't have wo write nulls at all, because they are always part of union
    },
    literal() {
      // we don't have wo write literals at all, because they are always part of union and
      // actual value is constant and already contained in typedefinition
    },
    boolean() {
      pbfWriter.writeBoolean(currentNode);
    },
    number(zodType) {
      const wireEncoding = detectNumberNumberWireEncoding(zodType);
      switch (wireEncoding) {
        case NumberWireEncoding.Byte:
        // there is no way to write just single byte, so we fall back to varint which max two bytes
        case NumberWireEncoding.Varint:
          pbfWriter.writeVarint(currentNode);
          break;
        default:
          pbfWriter.writeDouble(currentNode);
          break;
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

      // shortcuts for number arrays, not sure if needed at all
      if (isZodNumber(zodType)) {
        const wireEncoding = detectNumberNumberWireEncoding(zodType);
        switch (wireEncoding) {
          case NumberWireEncoding.Byte:
            pbfWriter.writeBytes(currentArray as unknown as Uint8Array); // TODO: pbf typings don't allow bare array, while actual implementation does
            return;
          case NumberWireEncoding.Varint:
            pbfWriter.writeVarint(currentArray.length);
            for (const value of currentArray) {
              pbfWriter.writeVarint(value);
            }
            return;
          default:
            pbfWriter.writeVarint(currentArray.length);
            for (const value of currentArray) {
              pbfWriter.writeDouble(value);
            }
            return;
        }
      }

      pbfWriter.writeVarint(currentArray.length);
      for (const value of currentArray) {
        // TODO: optimization for byte, number, int
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

      // TODO: now, we brute forcifully try all union types :/
      // it would be great to write precompiled matcher for unions, so we're using
      // some smart way to detect proper union type fast.
      // ideas:
      //   discrimiation on `typeof`
      //   extended typeof i.e `typeof` + null vs object vs array
      //   discrimination based on some common field, aka discriminated union
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
  });
  return [pbfWriter.buf, pbfWriter.pos];
}
