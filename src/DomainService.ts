import { cheerio, readCSVObjects } from "../deps.ts";

const request_headers = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
};

const CSVPath = "./data/favicon-finder-top-1k-domains.csv";

type DomainCSVRow = { row_num: string; domain: string };

enum FailReason {
  Unreachable = "The domain was unreachable",
  NoFaviconFound = "No favicon found",
}

type DomainResult = {
  error?: FailReason;
  faviconUrl?: string;
  domain: string;
};

/**
 * Scrapes a domain for its favicon.
 * Optimisitcally looks at /favicon.ico, then falls back to scraping HTML
 */
async function getDomainFavicon(domain: string): Promise<DomainResult> {
  const favicon_path = `https://${domain}/favicon.ico`;
  let resp;

  try {
    resp = await fetch(favicon_path, {
      headers: request_headers,
      redirect: "follow",
      signal: AbortSignal.timeout(3000),
    });
  } catch (_) {
    return scrapeFaviconFromHtml(domain);
  }

  const content_type = resp.headers.get("Content-Type") || "";

  const type = content_type.split("/")[0];

  if (type == "image") {
    return {
      domain: domain,
      faviconUrl: favicon_path,
    };
  }

  return scrapeFaviconFromHtml(domain);
}

/**
 * Scrapes the HTML of a page for link[rel="shortcut icon"], link[rel="icon"]
 */
async function scrapeFaviconFromHtml(domain: string): Promise<DomainResult> {
  const domain_path = `https://${domain}`;
  let resp;

  try {
    resp = await fetch(domain_path, {
      headers: request_headers,
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    return {
      domain: domain,
      error: FailReason.Unreachable,
    };
  }

  if (!resp.ok) {
    return {
      domain: domain,
      error: FailReason.Unreachable,
    };
  }

  const $ = cheerio.load(await resp.text());
  let link = $('link[rel="shortcut icon"], link[rel="icon"]').attr("href");

  if (!link) {
    return {
      domain: domain,
      error: FailReason.NoFaviconFound,
    };
  }

  if (!/^http/.test(link)) {
    link = `https://${domain}${link}`;
  }

  return {
    domain: domain,
    faviconUrl: link,
  };
}

/**
 * Loads the CSV, returns an array of the rows
 */
async function getDomainCSV(num?: number): Promise<DomainCSVRow[]> {
  const f = await Deno.open(CSVPath);

  const domainObjects: DomainCSVRow[] = [];

  for await (const obj of readCSVObjects(f)) {
    domainObjects.push(obj);
  }
  f.close();

  return num ? domainObjects.slice(0, num) : domainObjects;
}

export { getDomainCSV, getDomainFavicon };
