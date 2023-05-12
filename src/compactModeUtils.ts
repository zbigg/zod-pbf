import { ZodNumber } from "zod";

export enum NumberWireEncoding {
  Byte,
  Varint,
  Double,
}
export function detectNumberNumberWireEncoding(
  type: ZodNumber
): NumberWireEncoding {
  const checks = type._def.checks;
  if (checks.some((check) => check.kind === "int")) {
    const minCheck = checks.find((check) => check.kind === "min");
    const maxCheck = checks.find((check) => check.kind === "max");

    if (
      minCheck?.kind === "min" &&
      maxCheck?.kind === "max" &&
      minCheck.inclusive === true &&
      maxCheck.inclusive === true
    ) {
      const minValue = minCheck.value;
      const maxValue = maxCheck.value;
      if (minValue === 0 && maxValue === 255) {
        return NumberWireEncoding.Byte;
      }
    }

    return NumberWireEncoding.Varint;
  } else {
    return NumberWireEncoding.Double;
  }
}
