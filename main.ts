import {
  amountWidget,
  parse,
  percentageWidget,
  pLimit,
  ProgressBar,
} from "./deps.ts";
import { getDomainCSV, getDomainFavicon } from "./src/DomainService.ts";

const flags = parse(Deno.args, {
  boolean: ["help"],
  string: ["domain", "num", "concurency"],
  default: { concurency: 10 },
});

const limit = pLimit(flags.concurency);

async function main() {
  if (flags.domain) {
    const favicon = await getDomainFavicon(flags.domain);
    console.log(favicon);
    return;
  }

  const domainCSV = await getDomainCSV(flags.num);

  const widgets = [percentageWidget, amountWidget];
  const pb = new ProgressBar({ total: domainCSV.length, widgets });

  const results = await Promise.all(
    domainCSV.map((row, i) =>
      limit(() => pb.update(i + 1) && getDomainFavicon(row.domain))
    ),
  );

  const found_amount = results.filter((row) => !row.error).length /
    (+flags.num);

  results.forEach((row) => {
    console.log(row);
  });

  console.log(`\nfound ${found_amount * 100}%\n`);
}

await main();
