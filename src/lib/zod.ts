export interface ZodSchema<T> {
  parse: (data: unknown) => T;
  nullable: () => ZodSchema<T | null>;
}

type InferSchema<S> = S extends ZodSchema<infer T> ? T : never;

class Schema<T> implements ZodSchema<T> {
  private readonly parser: (data: unknown) => T;

  constructor(parser: (data: unknown) => T) {
    this.parser = parser;
  }

  parse(data: unknown): T {
    return this.parser(data);
  }

  nullable(): ZodSchema<T | null> {
    return new Schema<T | null>((data) => {
      if (data === null) return null;
      return this.parser(data);
    });
  }
}

function assertNumber(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error("Expected number");
  }
  return value;
}

function assertString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Expected string");
  }
  return value;
}

export const z = {
  string(): ZodSchema<string> {
    return new Schema((value) => assertString(value));
  },
  number(): ZodSchema<number> {
    return new Schema((value) => assertNumber(value));
  },
  coerce: {
    number(): ZodSchema<number> {
      return new Schema((value) => {
        const coerced = Number(value);
        if (!Number.isFinite(coerced)) {
          throw new Error("Expected coercible number");
        }
        return coerced;
      });
    },
  },
  object<Shape extends Record<string, ZodSchema<unknown>>>(shape: Shape): ZodSchema<{ [K in keyof Shape]: InferSchema<Shape[K]> }> {
    return new Schema((value) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("Expected object");
      }
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(shape) as Array<keyof Shape>) {
        result[key as string] = shape[key].parse((value as Record<string, unknown>)[key as string]);
      }
      return result as { [K in keyof Shape]: InferSchema<Shape[K]> };
    });
  },
  array<Item>(schema: ZodSchema<Item>): ZodSchema<Item[]> {
    return new Schema((value) => {
      if (!Array.isArray(value)) {
        throw new Error("Expected array");
      }
      return value.map((item, index) => {
        try {
          return schema.parse(item);
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`Invalid array item at index ${index}: ${error.message}`);
          }
          throw error;
        }
      });
    });
  },
};
