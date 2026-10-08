/** A page of results with the total count across all pages. */
export type Paged<T> = { items: T[]; total: number };
