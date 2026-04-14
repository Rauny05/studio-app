export interface ScriptTemplate {
  id: string;
  name: string;
  deliverable: string;
  description: string;
  content: string;
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: "youtube",
    name: "YouTube Video",
    deliverable: "YouTube",
    description: "Hook + intro + body + CTA",
    content: `# Hook\nStrong opening line that makes them stay...\n\n# Intro\nBriefly introduce yourself and the topic...\n\n# Main Content\n\n## Point 1\n\n## Point 2\n\n## Point 3\n\n# CTA\nLike, subscribe, and comment below...`,
  },
  {
    id: "reel",
    name: "Reel / Short",
    deliverable: "Reel",
    description: "3-sec hook + value + CTA",
    content: `# Hook (0–3s)\nStrong opening line...\n\n# Value (4–25s)\nCore insight or tip...\n\n# CTA (26–30s)\nFollow for more...`,
  },
  {
    id: "podcast",
    name: "Podcast Episode",
    deliverable: "Podcast",
    description: "Intro + topics + outro",
    content: `# Opening\nWelcome and episode intro...\n\n# Topic 1\n\n# Topic 2\n\n# Topic 3\n\n# Closing\nThanks + next episode teaser + CTA`,
  },
  {
    id: "thread",
    name: "Twitter/X Thread",
    deliverable: "Post",
    description: "Hook tweet + body tweets",
    content: `# Tweet 1 — Hook\nControversial or surprising opener...\n\n# Tweet 2\n\n# Tweet 3\n\n# Tweet 4\n\n# Final Tweet — CTA\nFollow for more + RT if useful`,
  },
  {
    id: "blog",
    name: "Blog Post",
    deliverable: "Blog",
    description: "Standard long-form structure",
    content: `# Introduction\nSet up the problem...\n\n## Section 1\n\n## Section 2\n\n## Section 3\n\n## Conclusion\nKey takeaway + CTA`,
  },
];
