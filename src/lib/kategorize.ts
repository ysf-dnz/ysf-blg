/**
 * Kitapları başlıktan konuya göre kategorilere ayırır (Drive klasör adları
 * yerine). Kurallar sıralıdır: ilk eşleşen kazanır — özel konular önce.
 */
export interface Kategori {
  key: string;
  ad: string;
  renk: string;
}

export const KATEGORILER: Kategori[] = [
  { key: "islami", ad: "İslami · Manevi", renk: "#5cb85c" },
  { key: "kisisel", ad: "Kişisel Gelişim", renk: "#e06fae" },
  { key: "dil", ad: "Dil Öğrenimi", renk: "#e0b15a" },
  { key: "yapay-zeka", ad: "Yapay Zekâ · LLM", renk: "#7c5cff" },
  { key: "veri", ad: "Veri Bilimi", renk: "#f2617a" },
  { key: "kuantum", ad: "Kuantum", renk: "#58b7d6" },
  { key: "siber", ad: "Siber Güvenlik", renk: "#c9524a" },
  { key: "devops", ad: "DevOps · Bulut", renk: "#6fd08c" },
  { key: "web", ad: "Web Geliştirme", renk: "#6f8fd6" },
  { key: "programlama", ad: "Programlama", renk: "#3fb8bc" },
  { key: "tasarim", ad: "Tasarım · UX", renk: "#d98cc1" },
  { key: "is", ad: "İş · Pazarlama", renk: "#d6a756" },
  { key: "diger", ad: "Diğer", renk: "#8a90a0" },
];

const KURALLAR: [string, RegExp][] = [
  ["islami", /islam|kuran|quran|risale|mektubat|umre|hajj|i'?caz|ihya|ulum|iman|nur|tefsir|hadis|fıkıh|mantık sahaeseri|ta.?likat/i],
  ["dil", /grammar|english|vocabulary|ielts|toefl|kelime|ingilizce|short stories/i],
  ["kisisel", /mindset|habit|irade|zihniyet|öğrenme|ogrenme|memory|productivity|focus|deep work|atomic|yaratıcı|creative act|konuş|speak|ted |enneagram|ennegram|kişisel|self|discipline|motivation|world without email|hızlı öğrenme/i],
  ["kuantum", /quantum|qiskit|kuantum/i],
  ["siber", /security|hacking|hacker|kali|cyber|siber|penetration|malware|forensic/i],
  ["yapay-zeka", /\bai\b|artificial intelligence|machine learning|deep learning|neural|llm|gpt|chatgpt|claude|gemini|langchain|langgraph|agent|genai|generative|nlp|transformer|rag\b|mcp\b|model context|prompt|copilot|yapay zek|mistral|openai|hugging|pytorch|tensorflow|keras|scikit|vibe (coding|engineering)|n8n|autogen|crewai|reinforcement|yz\b/i],
  ["veri", /\bdata\b|sql|postgres|mongo|database|spark|kaggle|analytics|pandas|numpy|tableau|power bi|etl|warehouse|veri|statistics|bayesian|time series|cockroach|databricks|kafka|elastic/i],
  ["devops", /docker|kubernetes|devops|cloud|aws|azure|gcp|google cloud|terraform|ansible|ci\/cd|linux|git\b|github actions|podman|argo|serverless|sre\b|observability|finops|platform engineering/i],
  ["web", /\bweb\b|css|html|frontend|front-end|next\.?js|react|vue|svelte|angular|django|flask|fastapi|node|express|javascript|typescript|jquery|wordpress|tailwind|streamlit/i],
  ["programlama", /python|rust|golang|\bgo\b|java\b|c\+\+|c#|swift|kotlin|flutter|programming|coding|code\b|algorithm|software|clean|refactor|design pattern|grpc|api\b|microservice|test|tdd|programlama|yazılım|revit|autocad|blender|davinci/i],
  ["tasarim", /design|ux\b|ui\b|figma|interface|typography|tasarım/i],
  ["is", /business|marketing|seo\b|sales|startup|entrepreneur|dropship|etsy|pinterest|management|jira|agile|scrum|product|finance|invest|crypto|bitcoin|blockchain|ekonomi|satış|pazarlama|girişim|semrush|salesforce|sap\b|excel/i],
];

export function kategorile(title: string): string {
  for (const [key, re] of KURALLAR) {
    if (re.test(title)) return key;
  }
  return "diger";
}
