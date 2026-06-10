interface JobDetectionResult {
  isJobPage: boolean;
  inferredCompany: string | null;
  inferredRole: string | null;
}

const JOB_BOARD_HOSTS = [
  "linkedin.com",
  "wellfound.com",
  "naukri.com",
  "internshala.com",
  "greenhouse.io",
  "lever.co",
  "workday.com",
  "instahyre.com",
  "cutshort.io",
];

const JOB_PATH_SEGMENTS = ["job", "career", "opening", "role"];

const JOB_TITLE_KEYWORDS = [
  "engineer",
  "developer",
  "designer",
  "analyst",
  "intern",
  "hiring",
  "manager",
  "lead",
  "architect",
  "specialist",
  "consultant",
  "programmer",
  "administrator",
];

const SEARCH_ENGINE_HOSTS = ["google.com", "bing.com", "duckduckgo.com", "yahoo.com", "baidu.com"];
const PLATFORM_HOSTS = ["greenhouse.io", "lever.co", "workday.com"];

const TITLE_STRIP_PATTERN =
  /\s*[|\u2013\-\u2014]\s*(?:Jobs|Careers|LinkedIn|Internshala|Wellfound|Naukri|Hiring|Instahyre|Cutshort|Home|Indeed|SimplyHired)\s*$/i;

const LOCATION_CLEAN_PATTERN =
  /\s*(?:in\s+)?(?:[A-Z][a-zA-Z\s.]+,\s*[A-Z]{2}|Remote|Hybrid|On-site|United States|US|India|UK|London|San Francisco|New York|New York City|NYC|Bangalore|Bengaluru)$/i;

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith("." + domain);
}

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function cleanString(str: string): string {
  return str.replace(LOCATION_CLEAN_PATTERN, "").trim();
}

function parseTitle(title: string): { company: string | null; role: string | null } {
  let cleaned = title.replace(TITLE_STRIP_PATTERN, "").trim();
  cleaned = cleaned.replace(TITLE_STRIP_PATTERN, "").trim(); // double pass

  if (!cleaned) return { company: null, role: null };

  // 1. "at" pattern: Role at Company
  const atMatch = cleaned.match(/^(.+?)\s+\bat\s+(.+)$/i);
  if (atMatch) {
    return {
      role: cleanString(atMatch[1]),
      company: cleanString(atMatch[2]),
    };
  }

  // 2. "hiring" pattern: Company hiring Role
  const hiringMatch = cleaned.match(/^(.+?)\s+(?:is\s+)?hiring\s+(?:a\s+|an\s+)?(.+)$/i);
  if (hiringMatch) {
    return {
      company: cleanString(hiringMatch[1]),
      role: cleanString(hiringMatch[2]),
    };
  }

  // 3. Delimited pattern: Role - Company - Location
  const parts = cleaned.split(/\s*[|\u2013\-\u2014:]\s*/);
  if (parts.length >= 2) {
    let company: string | null = null;
    let role: string | null = null;

    for (const part of parts) {
      const trimmed = cleanString(part);
      if (trimmed.length <= 1) continue;

      const lower = trimmed.toLowerCase();
      const isRoleLike = JOB_TITLE_KEYWORDS.some((kw) => lower.includes(kw));

      if (isRoleLike && !role) {
        role = trimmed;
      } else if (!isRoleLike && !company) {
        company = trimmed;
      }
    }

    if (company || role) {
      return { company, role };
    }
  }

  // Fallback for role (if whole title contains role keywords)
  const isTitleRoleLike = JOB_TITLE_KEYWORDS.some((kw) => cleaned.toLowerCase().includes(kw));
  return {
    company: null,
    role: isTitleRoleLike ? cleanString(cleaned) : null,
  };
}

function extractCompanyFromHostname(hostname: string): string | null {
  const clean = hostname.replace(/^www\./, "");
  const parts = clean.split(".");
  if (parts.length < 2) return null;

  const isPlatform = PLATFORM_HOSTS.some((d) => hostMatches(hostname, d));
  if (isPlatform) {
    return parts.length >= 3 ? capitalize(parts[0]) : null;
  }

  const name = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
  return capitalize(name);
}

function detectJobPage(url: string, title: string): JobDetectionResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { isJobPage: false, inferredCompany: null, inferredRole: null };
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const lowerTitle = title.toLowerCase();

  const isJobBoard = JOB_BOARD_HOSTS.some((d) => hostMatches(hostname, d));
  const hasJobPath = JOB_PATH_SEGMENTS.some((seg) => pathname.includes(seg));
  const isSearchEngine = SEARCH_ENGINE_HOSTS.some((d) => hostMatches(hostname, d));
  const hasJobTitle =
    !isSearchEngine && JOB_TITLE_KEYWORDS.some((kw) => lowerTitle.includes(kw));

  const isJobPage = isJobBoard || hasJobPath || hasJobTitle;
  if (!isJobPage) {
    return { isJobPage: false, inferredCompany: null, inferredRole: null };
  }

  const parsedData = parseTitle(title);
  const company = parsedData.company ?? extractCompanyFromHostname(hostname);
  const role = parsedData.role;

  return { isJobPage: true, inferredCompany: company, inferredRole: role };
}

export type { JobDetectionResult };
export { detectJobPage };
