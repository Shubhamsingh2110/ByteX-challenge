export interface ActionSuccess<T> {
  ok: true;
  data: T;
}

export interface ActionFailure {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
}

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

/** Raw, unvalidated transaction input as it arrives from the client form. */
export interface RawTransactionInput {
  type: "income" | "expense";
  amount: string | number;
  categoryId: string;
  description?: string;
  occurredAt?: string;
  idempotencyKey?: string;
}
