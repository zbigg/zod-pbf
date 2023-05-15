import Pbf from "pbf";
import { ZodLiteral, ZodType, ZodTypeAny } from "zod";
import {
  detectNumberNumberWireEncoding,
  NumberWireEncoding,
} from "./compactModeUtils.js";
import { isZodNumber } from "./typeUtils.js";
import { visitZodType } from "./zodTypeTreeVisitor.js";

export function decodeZodPbfCompact<T>(
  buffer: Uint8Array | ArrayBuffer,
  type: ZodType<T>
): [number, Uint8Array] {
  const pbfReader = new Pbf(buffer);
  let currentNode: any;
  visitZodType(type, {
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
      const wireEncoding = detectNumberNumberWireEncoding(zodType);
      switch (wireEncoding) {
        case NumberWireEncoding.Byte:
        case NumberWireEncoding.Varint:
          currentNode = pbfReader.readVarint();
          break;
        default:
          currentNode = pbfReader.readDouble();
          break;
      }
    },
    string() {
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
      let currentArray: any[];
      if (isZodNumber(zodType)) {
        const wireEncoding = detectNumberNumberWireEncoding(zodType);
        switch (wireEncoding) {
          case NumberWireEncoding.Byte: {
            const bytesRaw = pbfReader.readBytes();
            currentArray = new Array(bytesRaw);
            break;
          }
          case NumberWireEncoding.Varint: {
            const length = pbfReader.readVarint();
            currentArray = new Array(length);
            for (let i = 0; i < length; i++) {
              currentArray[i] = pbfReader.readVarint();
            }
            break;
          }
          default: {
            const length = pbfReader.readVarint();
            currentArray = new Array(length);
            for (let i = 0; i < length; i++) {
              currentArray[i] = pbfReader.readDouble();
            }
            break;
          }
        }
      } else {
        const length = pbfReader.readVarint();
        currentArray = new Array(length);

        for (let i = 0; i < length; i++) {
          process(zodType._def.type);
          currentArray[i] = currentNode;
        }
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
  });
  return currentNode;
}
