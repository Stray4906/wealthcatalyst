/**
 * Local browser-backed data store.
 * Mimics the small slice of the Supabase query builder the app uses, so every
 * page works without authentication. Data lives in localStorage.
 */

const STORAGE_KEY = "cfo-ai-local-db";

export type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

type Result<T> = { data: T; error: null };

class QueryBuilder implements PromiseLike<Result<Row[] | Row | null>> {
  private op: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private payload: Row[] = [];
  private filters: [string, unknown][] = [];
  private sort: { column: string; ascending: boolean } | null = null;
  private single = false;
  private conflict: string | null = null;

  constructor(private table: string) {}

  select(_columns?: string) {
    if (this.op === "select") this.op = "select";
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sort = { column, ascending: options?.ascending !== false };
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  insert(rows: Row | Row[]) {
    this.op = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  upsert(rows: Row | Row[], options?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflict = options?.onConflict ?? "id";
    return this;
  }

  update(row: Row) {
    this.op = "update";
    this.payload = [row];
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  private run(): Result<Row[] | Row | null> {
    const store = read();
    const rows = store[this.table] ?? [];
    const matches = (row: Row) => this.filters.every(([c, v]) => row[c] === v);
    const stamp = () => new Date().toISOString();

    let output: Row[] = [];

    if (this.op === "insert") {
      const created = this.payload.map((r) => ({ id: uid(), created_at: stamp(), ...r }));
      store[this.table] = [...rows, ...created];
      output = created;
    } else if (this.op === "upsert") {
      const key = this.conflict ?? "id";
      const next = [...rows];
      const created: Row[] = [];
      for (const item of this.payload) {
        const index = next.findIndex((r) => r[key] !== undefined && r[key] === item[key]);
        if (index >= 0) {
          next[index] = { ...next[index], ...item };
          created.push(next[index] as Row);
        } else {
          const row = { id: uid(), created_at: stamp(), ...item };
          next.push(row);
          created.push(row);
        }
      }
      store[this.table] = next;
      output = created;
    } else if (this.op === "update") {
      const [patch] = this.payload;
      const next = rows.map((r) => (matches(r) ? { ...r, ...patch } : r));
      store[this.table] = next;
      output = next.filter(matches);
    } else if (this.op === "delete") {
      store[this.table] = rows.filter((r) => !matches(r));
      output = [];
    } else {
      output = rows.filter(matches);
      if (this.sort) {
        const { column, ascending } = this.sort;
        output = [...output].sort((a, b) => {
          const av = a[column] as string | number | null;
          const bv = b[column] as string | number | null;
          if (av === bv) return 0;
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
        });
      }
    }

    if (this.op !== "select") write(store);
    if (this.single) return { data: output[0] ?? null, error: null };
    return { data: output, error: null };
  }

  then<TResult1 = Result<Row[] | Row | null>, TResult2 = never>(
    onfulfilled?:
      | ((value: Result<Row[] | Row | null>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    } catch (error) {
      return Promise.reject(error).then(onfulfilled, onrejected);
    }
  }
}

export const localDb = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  clear() {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  },
};
