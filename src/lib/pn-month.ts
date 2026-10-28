const MONTHS: Record<string, string> = {
  jan: "Jan", ja: "Jan",
  feb: "Feb", fe: "Feb",
  mar: "Mar", ma: "Mar",
  apr: "Apr", ap: "Apr",
  may: "May", my: "May",
  jun: "Jun", ju: "Jun",
  jul: "Jul", jl: "Jul",
  aug: "Aug", au: "Aug", ag: "Aug",
  sep: "Sep", se: "Sep", sp: "Sep",
  oct: "Oct", oc: "Oct",
  nov: "Nov", no: "Nov",
  dec: "Dec", de: "Dec",
};

/**
 * Month label from a PN number: ap25-1, apr25-1, may26-08, jul26-15, ju26-15-4/7 ...
 * Match the whole prefix first. Cutting it to two letters filed "may" under Mar and "jul" under Jun.
 */
export function parseMonth(pnNo: string): string {
  const match = pnNo.match(/^([a-z]{2,4})(\d{2,4})-/i);
  if (!match) return "";
  const prefix = match[1].toLowerCase();
  const yearRaw = match[2];
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  const name = MONTHS[prefix] ?? MONTHS[prefix.slice(0, 3)] ?? MONTHS[prefix.slice(0, 2)];
  return `${name ?? match[1]} ${year}`;
}
