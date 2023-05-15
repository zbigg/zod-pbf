import {
  ZodArray,
  ZodBoolean,
  ZodLiteral,
  ZodNull,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodString,
  ZodTypeAny,
  ZodUndefined,
  ZodUnion,
} from "zod";

export interface ZodTypeTreeVisitor {
  undefined(
    zodType: ZodUndefined,
    process: (zodType: ZodTypeAny) => void
  ): void;
  null(zodType: ZodNull, process: (zodType: ZodTypeAny) => void): void;
  literal(
    zodType: ZodLiteral<any>,
    process: (zodType: ZodTypeAny) => void
  ): void;
  object(zodType: ZodObject<any>, process: (zodType: ZodTypeAny) => void): void;
  boolean(zodType: ZodBoolean, process: (zodType: ZodTypeAny) => void): void;
  number(zodType: ZodNumber, process: (zodType: ZodTypeAny) => void): void;
  string(zodType: ZodString, process: (zodType: ZodTypeAny) => void): void;
  optional(
    zodType: ZodOptional<any>,
    process: (zodType: ZodTypeAny) => void
  ): void;
  array(zodType: ZodArray<any>, process: (zodType: ZodTypeAny) => void): void;
  union(zodType: ZodUnion<any>, process: (zodType: ZodTypeAny) => void): void;
}

export function visitZodType<TypeT extends ZodTypeAny>(
  zodType: TypeT,
  visitor: ZodTypeTreeVisitor
) {
  const process = (zodType: ZodTypeAny) => {
    visitZodType(zodType, visitor);
  };
  switch (zodType._def.typeName) {
    case "ZodUndefined": {
      visitor.undefined(zodType, process);
      break;
    }
    case "ZodNull": {
      visitor.null(zodType, process);
      break;
    }
    case "ZodLiteral": {
      visitor.literal(zodType as unknown as ZodLiteral<any>, process);
      break;
    }
    case "ZodBoolean": {
      visitor.boolean(zodType, process);
      break;
    }
    case "ZodNumber": {
      visitor.number(zodType as unknown as ZodNumber, process);
      break;
    }
    case "ZodString": {
      visitor.string(zodType as unknown as ZodString, process);
      break;
    }
    case "ZodObject": {
      visitor.object(zodType as unknown as ZodObject<any>, process);
      break;
    }
    case "ZodArray": {
      visitor.array(zodType as unknown as ZodArray<any>, process);
      break;
    }
    case "ZodOptional": {
      visitor.optional(zodType as unknown as ZodOptional<any>, process);
      break;
    }
    case "ZodUnion": {
      visitor.union(zodType as unknown as ZodUnion<any>, process);
      break;
    }
    default:
      console.log("processSchema unknown type", zodType._def.typeName);
      break;
  }
}
