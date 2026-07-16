import { getLedgerData } from "../lib/data";
import { LedgerApp } from "../components/LedgerApp";

// Always render fresh data; the ledger changes on every mutation.
export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getLedgerData();
  return <LedgerApp initial={data} />;
}
