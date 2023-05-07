import Pbf from "pbf";
import { ZodLiteral, ZodType, ZodTypeAny } from "zod";
import { ZodTypeTreeVisitor, visitZodType } from "./zodTypeTreeVisitor";

export function decodeZodPbfStrict<T>(
  buffer: Uint8Array | ArrayBuffer,
  type: ZodType<T>
): [number, Uint8Array] {
  const pbfReader = new Pbf(buffer);
  let currentNode: any;
  const pbfSchemaVisitor: ZodTypeTreeVisitor = {
    undefined() {
      currentNode = undefined;
    },
    null() {
      currentNode = null;
    },
    literal(zodType: ZodLiteral<any>) {
      currentNode = zodType._def.value;
    },
    boolean() {
      currentNode = pbfReader.readBoolean();
    },
    number(zodType) {
      if (zodType._def.checks.some((check) => check.kind === "int")) {
        currentNode = pbfReader.readVarint();
      } else {
        currentNode = pbfReader.readFloat();
      }
    },
    string(zodType) {
      currentNode = pbfReader.readString();
    },
    object(zodType, process) {
      const currentObject: Record<string, any> = {};
      for (const [name, property] of Object.entries(zodType._def.shape())) {
        process(property as ZodTypeAny);
        currentObject[name] = currentNode;
      }
      currentNode = currentObject;
    },
    array(zodType, process) {
      const length = pbfReader.readVarint();
      const currentArray = new Array(length);
      for (let i = 0; i < length; i++) {
        process(zodType._def.type);
        currentArray[i] = currentNode;
      }
      currentNode = currentArray;
    },
    optional(zodType, process) {
      const present = pbfReader.readBoolean();
      if (present) {
        process(zodType._def.innerType);
      } else {
        currentNode = undefined;
      }
    },
    union(zodType, process) {
      const variantTag = pbfReader.readVarint();
      const options: ZodTypeAny[] = zodType._def.options;
      const option = options[variantTag];
      if (!option) {
        // we don't know what was encodeed
        // and this protocol can't work with unknown "subpayload", so we must bail out
        throw new Error(
          `decodeZodPbf: incompatible payload (invalid union tag: ${variantTag})`
        );
      }

      process(option);
    },
  };
  visitZodType(type, pbfSchemaVisitor);
  return currentNode;
}
