import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type BlogFrontmatter = {
  title: string;
  description: string;
  date: string;
  slug: string;
  cover?: string;
};

export type BlogPost = BlogFrontmatter & {
  content: string;
};

const BLOG_DIR = path.join(process.cwd(), "content/blog");

function validarFrontmatter(data: Record<string, unknown>): BlogFrontmatter {
  const title = data.title;
  const description = data.description;
  const date = data.date;
  const slug = data.slug;
  if (
    typeof title !== "string" ||
    typeof description !== "string" ||
    typeof date !== "string" ||
    typeof slug !== "string"
  ) {
    throw new Error(
      "Frontmatter de blog inválido: title, description, date e slug são obrigatórios",
    );
  }
  return {
    title,
    description,
    date,
    slug,
    cover: typeof data.cover === "string" ? data.cover : undefined,
  };
}

export function listarPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const arquivos = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".mdx"));

  const posts = arquivos.map((arquivo) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, arquivo), "utf8");
    const { data, content } = matter(raw);
    const meta = validarFrontmatter(data as Record<string, unknown>);
    return { ...meta, content };
  });

  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function postPorSlug(slug: string): BlogPost | null {
  return listarPosts().find((p) => p.slug === slug) ?? null;
}
