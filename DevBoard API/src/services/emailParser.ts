import { Status } from "@prisma/client";

export interface ParsedEmailResult {
  company: string;
  role: string;
  status: Status;
}

const GENERIC_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "aol.com",
  "icloud.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "mail.com",
  "yandex.com",
  "gmx.com"
]);

const ATS_DOMAINS = new Set([
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workable.com",
  "myworkdayjobs.com",
  "myworkday.com",
  "bamboohr.com",
  "smartrecruiters.com"
]);

export function parseEmail(
  subject: string,
  body: string,
  fromAddress: string
): ParsedEmailResult | null {
  const combinedText = (subject + " " + body).toLowerCase();
  const lowerSubject = subject.toLowerCase();

  // 1. Strict Negative Exclusions (Skip digests, courses, notifications, security, etc.)
  const negativeKeywords = [
    "newsletter",
    "digest",
    "daily",
    "weekly",
    "monthly",
    "course",
    "webinar",
    "tutorial",
    "subscription",
    "receipt",
    "invoice",
    "billing",
    "payment",
    "event",
    "verify your email",
    "one-time link",
    "security alert",
    "password reset",
    "reset your password",
    "otp",
    "login link",
    "marketing",
    "promotion",
    "coupon",
    "discount",
    "suggested spaces",
    "weekly digest",
    "daily digest",
    "doubts session",
    "webinar registration",
    "confirm your account",
    "email verification",
    "your subscription",
    "job alert",
    "weekly update",
    "daily update",
    "dispatch",
    "market research",
    "doubt session",
    "fastrack",
    "advance batch",
    "teens help",
    "weekday trip",
    "hackathon",
    "third place",
    "spotting stock risks",
    "unsubscribe",
    "view in browser",
    "view in app",
    "view on web",
    "view this post",
    "read online",
    "share this post",
    "substack.com",
    "medium.com",
    "manage your subscription",
    "you are receiving this",
    "view online",
    "sponsored",
    "class recording",
    "course overview",
    "privacy policy",
    "terms of service",
    "terms of use",
    "read in the app"
  ];

  if (negativeKeywords.some(kw => combinedText.includes(kw))) {
    return null; // Skip newsletters/digests/promotions immediately
  }

  // 2. Strict Positive Keywords for Job Applications / Recruitment
  // The subject must suggest a clear job application event
  const jobSubjectKeywords = [
    "application",
    "applied",
    "careers",
    "interview",
    "online assessment",
    "hiring",
    "cv",
    "resume",
    "job opportunity",
    "offer",
    "position",
    "assessment",
    "phone screen",
    "rejection",
    "not moving forward",
    "scheduling",
    "status",
    "update",
    "recruiting",
    "talent acquisition"
  ];

  const hasJobSubject = jobSubjectKeywords.some(kw => lowerSubject.includes(kw));
  if (!hasJobSubject) {
    return null; // Skip non-job subjects
  }

  // 3. Clean and parse the sender address
  const emailMatch = fromAddress.match(/[\w\.\-]+@([\w\-]+\.[\w\.\-]+)/i);
  if (!emailMatch) return null;
  const domain = emailMatch[1].toLowerCase();

  // Skip newsletters/blog platforms completely based on domain
  if (
    domain.includes("substack.com") ||
    domain.includes("medium.com") ||
    domain.includes("newsletter") ||
    domain.includes("googlegroups.com")
  ) {
    return null;
  }

  let companyCandidate = "";

  // 4. Try to extract company name from the "From" display name
  const displayNameMatch = fromAddress.match(/^"?([^"<]+)"?\s*</);
  if (displayNameMatch) {
    let displayName = displayNameMatch[1].trim();
    // Remove common words like Careers, Jobs, Recruiting, HR, etc.
    displayName = displayName
      .replace(/(?:careers|jobs|recruiting|team|hr|no-reply|noreply|notifications|hiring|talent acquisition)\b/gi, "")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .trim();
    if (displayName && displayName.length > 1) {
      companyCandidate = displayName;
    }
  }

  // Fallback: If domain is not generic and not an ATS, use the domain name
  if (!companyCandidate) {
    const firstPart = domain.split(".")[0];
    if (!GENERIC_DOMAINS.has(domain) && !ATS_DOMAINS.has(domain) && firstPart.length > 1) {
      companyCandidate = firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
    }
  }

  // Fallback for ATS domains (Greenhouse, Lever, etc.) where email is generic
  const subjectPatterns = [
    /application\s+(?:to|at|with)\s+([A-Za-z0-9\s\.\&\-]{2,30})/i,
    /([A-Za-z0-9\s\.\&\-]{2,30})\s+application/i,
    /thank\s+you\s+for\s+applying\s+(?:to|at|with)\s+([A-Za-z0-9\s\.\&\-]{2,30})/i,
    /update\s+(?:on|regarding)\s+your\s+application\s+(?:to|at|with)\s+([A-Za-z0-9\s\.\&\-]{2,30})/i
  ];

  if (!companyCandidate || ATS_DOMAINS.has(domain)) {
    for (const pattern of subjectPatterns) {
      const match = subject.match(pattern);
      if (match) {
        const matchedName = match[1]
          .replace(/(?:careers|jobs|recruiting|team|hr|no-reply|noreply|notifications|hiring)\b/gi, "")
          .trim();
        if (matchedName && matchedName.length > 1) {
          companyCandidate = matchedName;
          break;
        }
      }
    }
  }

  // If we still don't have a company name, we cannot track it
  if (!companyCandidate) {
    return null;
  }

  // Clean company name (capitalize first letter of each word)
  companyCandidate = companyCandidate
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .trim();

  // 5. Detect status based on robust keyword matching.
  // Since we verified the email is job-related and excluded newsletters above,
  // we can safely use robust keywords that are punctuation-agnostic.
  let status: Status | null = null;

  const rejectionKeywords = [
    "unfortunately",
    "not moving forward",
    "regret to inform",
    "pursue other candidates",
    "decided to go with another",
    "decided to pursue other",
    "not selected",
    "unable to move forward",
    "no longer under consideration",
    "unable to offer you",
    "not be moving you forward"
  ];
  const offerKeywords = [
    "offer letter",
    "pleased to offer",
    "would like to offer",
    "employment agreement",
    "offer details",
    "congratulations on your offer",
    "extend an offer"
  ];
  const onsiteKeywords = [
    "onsite interview",
    "on-site interview",
    "final round interview",
    "panel interview",
    "onsite visit",
    "virtual onsite",
    "interview loop"
  ];
  const technicalKeywords = [
    "technical interview",
    "technical round",
    "coding interview",
    "system design interview",
    "live coding"
  ];
  const oaKeywords = [
    "codesignal",
    "hackerrank",
    "online assessment",
    "take-home assignment",
    "complete your assessment",
    "online test",
    "coding challenge",
    "technical challenge",
    "take-home test"
  ];
  const phoneScreenKeywords = [
    "phone screen",
    "phone interview",
    "schedule a chat",
    "speak with you",
    "calendly",
    "introduction call",
    "recruiter call",
    "chat with our team",
    "chat with us",
    "schedule a phone"
  ];
  const appliedKeywords = [
    "thank you for applying",
    "thanks for applying",
    "your application has been received",
    "received your application",
    "submission confirmation",
    "successfully submitted your application",
    "application received",
    "confirm your application",
    "interest in our team",
    "applying at",
    "application at",
    "application to"
  ];

  if (rejectionKeywords.some(kw => combinedText.includes(kw))) {
    status = Status.REJECTED;
  } else if (offerKeywords.some(kw => combinedText.includes(kw))) {
    status = Status.OFFER;
  } else if (onsiteKeywords.some(kw => combinedText.includes(kw))) {
    status = Status.ONSITE;
  } else if (technicalKeywords.some(kw => combinedText.includes(kw))) {
    status = Status.TECHNICAL;
  } else if (oaKeywords.some(kw => combinedText.includes(kw))) {
    status = Status.OA;
    
    // Distinguish between actual invitations and informational "will be invited/selection process" emails
    const informativeOaKeywords = [
      "will be invited to",
      "would be invited to",
      "may be asked to",
      "depending on the role you are applying for",
      "depends on the role",
      "next step in the process includes",
      "our selection process includes",
      "our hiring process includes",
      "we use the following assessments",
      "information about our assessment",
      "potential match, we’ll contact you"
    ];
    if (informativeOaKeywords.some(kw => combinedText.includes(kw))) {
      status = Status.APPLIED;
    }
  } else if (phoneScreenKeywords.some(kw => combinedText.includes(kw))) {
    status = Status.PHONE_SCREEN;
  } else if (appliedKeywords.some(kw => combinedText.includes(kw))) {
    status = Status.APPLIED;
  } else {
    // Default fallback to APPLIED for general job-related emails
    status = Status.APPLIED;
  }

  // 6. Try to extract the role
  let roleCandidate = "Software Engineer"; // Default fallback
  const rolePatterns = [
    /(?:for|as a|role of|position of)\s+([A-Za-z0-9\s\-\.\/]{2,40})/i
  ];
  for (const pattern of rolePatterns) {
    const match = subject.match(pattern);
    if (match) {
      const matchedRole = match[1].trim();
      if (matchedRole && matchedRole.length > 2) {
        roleCandidate = matchedRole;
        break;
      }
    }
  }

  // Scan common titles as fallback
  const commonTitles = [
    "Software Engineer",
    "Frontend Developer",
    "Frontend Engineer",
    "Backend Engineer",
    "Backend Developer",
    "Fullstack Engineer",
    "Full Stack Developer",
    "Data Scientist",
    "Data Engineer",
    "Product Manager",
    "UX Designer",
    "DevOps Engineer",
    "Systems Engineer",
    "Mobile Developer",
    "iOS Engineer",
    "Android Engineer"
  ];
  for (const title of commonTitles) {
    if (combinedText.includes(title.toLowerCase())) {
      roleCandidate = title;
      break;
    }
  }

  return {
    company: companyCandidate,
    role: roleCandidate.trim(),
    status
  };
}
